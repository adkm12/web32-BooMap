import { Node } from '@app/entity';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, TreeRepository } from 'typeorm';
import { NodeDto } from './dto/node.dto';
import { UpdateNodeDto } from './dto/update.node.dto';
import { TextAiResponse } from '../ai/ai.service';

type NodeTreeObject = {
  [key: number]: NodeDto;
};
const ROOT_DEPTH = 1;

@Injectable()
export class NodeService {
  private readonly logger = new Logger(NodeService.name);
  constructor(@InjectRepository(Node) private nodeRepository: TreeRepository<Node>) {}

  async findKeywordByMindmapId(mindmapId: number) {
    const nodeList = await this.nodeRepository.find({ where: { mindmap: { id: mindmapId } } });
    return nodeList.map((node) => node.keyword);
  }

  async getNodeTreeObject(mindmapId: number) {
    const rootNode = await this.findRootNode(mindmapId);
    if (!rootNode) return {};
    const nodeTree = await this.nodeRepository.findDescendants(rootNode, { relations: ['children'] });
    return nodeTree.reduce((result, node) => {
      result[node.id] = this.toCanvas(node);
      return result;
    }, {} as NodeTreeObject);
  }

  private toCanvas(node: Node): NodeDto {
    return {
      id: node.id,
      keyword: node.keyword,
      depth: node.depth,
      location: { x: node.locationX, y: node.locationY },
      children: node.children.map((child) => child.id),
    };
  }

  async updateNodeTree(canvasData: NodeTreeObject, mindmapId: number) {
    try {
      const currentNodes = await this.nodeRepository.find({
        where: { mindmap: { id: mindmapId } },
        select: ['id'],
      });

      const [nodesToDelete, updateNodeDtos] = this.prepareNodeUpdates(currentNodes, canvasData);
      await this.executeNodeUpdates(nodesToDelete, updateNodeDtos);
    } catch (error: any) {
      const message = `노드 트리 업데이트 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`;
      this.logger.error(message);
    }
  }

  private prepareNodeUpdates(currentNodes: Pick<Node, 'id'>[], canvasData: NodeTreeObject) {
    const currentNodeIds = currentNodes.map((node) => node.id);
    const receivedNodeIds = Object.keys(canvasData).map(Number);

    return [
      this.findNodesToDelete(currentNodeIds, receivedNodeIds),
      this.convertCanvasDataToUpdateDto(canvasData),
    ] as const;
  }

  private async executeNodeUpdates(nodesToDelete: Pick<Node, 'id'>[], updateNodeDtos: UpdateNodeDto[]) {
    await this.nodeRepository.manager.transaction(async (transactionalEntityManager) => {
      if (nodesToDelete.length > 0) {
        await transactionalEntityManager.softRemove(Node, nodesToDelete);
      }

      if (updateNodeDtos.length > 0) {
        await Promise.all(updateNodeDtos.map((dto) => transactionalEntityManager.update(Node, dto.id, dto)));
      }
    });
  }

  private findNodesToDelete(currentNodeIds: number[], receivedNodeIds: number[]) {
    const deleteNodeIds = currentNodeIds.filter((id) => !receivedNodeIds.includes(id));
    if (deleteNodeIds.length === 0) return [];

    return deleteNodeIds.map((id) => ({ id })) as Pick<Node, 'id'>[];
  }

  private convertCanvasDataToUpdateDto(canvasData: NodeTreeObject) {
    return Object.values(canvasData).map(
      (node) =>
        ({
          id: node.id,
          keyword: node.keyword,
          locationX: node.location.x,
          locationY: node.location.y,
          depth: node.depth,
        }) as UpdateNodeDto,
    );
  }

  private async findRootNode(mindmapId: number) {
    return this.nodeRepository.findOne({ where: { mindmap: { id: mindmapId }, depth: ROOT_DEPTH } });
  }

  async aiCreateNode(aiResponse: TextAiResponse, mindmapId: number, depth = ROOT_DEPTH): Promise<NodeTreeObject> {
    try {
      await this.createNodeTreeRecursively(aiResponse, mindmapId, depth);
      return this.getNodeTreeObject(mindmapId);
    } catch (error) {
      const message = `마인드맵 ${mindmapId}의 AI 노드 트리 생성 중 오류가 발생했습니다`;
      this.logger.error(message, error);
      throw error;
    }
  }

  private async createNodeTreeRecursively(
    response: TextAiResponse,
    mindmapId: number,
    currentDepth: number,
    parentNode?: Node,
  ) {
    const node =
      currentDepth === ROOT_DEPTH
        ? await this.updateOrCreateRootNode(response, mindmapId)
        : await this.createChildNode(parentNode, response, currentDepth, mindmapId);

    await Promise.all(
      response.children.map((child) => this.createNodeTreeRecursively(child, mindmapId, currentDepth + 1, node)),
    );
  }

  private async updateOrCreateRootNode(aiResponse: TextAiResponse, mindmapId: number) {
    const existingRoot = await this.findRootNode(mindmapId);

    if (existingRoot) {
      existingRoot.keyword = aiResponse.keyword;
      return this.nodeRepository.save(existingRoot);
    }

    return this.nodeRepository.save({
      keyword: aiResponse.keyword,
      depth: ROOT_DEPTH,
      mindmap: { id: mindmapId },
    });
  }

  private async createChildNode(
    parentNode: Node,
    childResponse: TextAiResponse,
    depth: number,
    mindmapId: number,
  ): Promise<Node> {
    return this.nodeRepository.save({
      keyword: childResponse.keyword,
      depth,
      parent: { id: parentNode.id },
      mindmap: { id: mindmapId },
    });
  }
}
