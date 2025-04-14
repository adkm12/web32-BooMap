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

  async canvasToTable(canvasData: Record<number, NodeDto>, mindmapId: number) {
    const dbNodes = await this.nodeRepository.find({ where: { mindmap: { id: mindmapId } } });
    const dbNodeIds = dbNodes.map((node) => node.id);
    const canvasNodeIds = Object.keys(canvasData).map(Number);
    const deleteNodeIds = dbNodeIds.filter((id) => !canvasNodeIds.includes(id));

    const updateData = Object.values(canvasData).map((node) => {
      return {
        id: node.id,
        keyword: node.keyword,
        locationX: node.location.x,
        locationY: node.location.y,
        depth: node.depth,
    }));
  }

  private async findRootNode(mindmapId: number) {
    return this.nodeRepository.findOne({ where: { mindmap: { id: mindmapId }, depth: ROOT_DEPTH } });
  }

  async deleteNodes(deleteNodeId: number[] | number) {
    if (Array.isArray(deleteNodeId)) {
      const nodesToDelete = await this.nodeRepository.findBy({ id: In(deleteNodeId) });
      await this.nodeRepository.softRemove(nodesToDelete);
      return;
    }

    const nodeToDelete = await this.nodeRepository.findOne({ where: { id: deleteNodeId } });
    if (nodeToDelete) {
      await this.nodeRepository.softRemove(nodeToDelete);
    }
  }

  async updateNode(updateData: UpdateNodeDto | UpdateNodeDto[]) {
    if (Array.isArray(updateData)) {
      await Promise.all(updateData.map((data) => this.nodeRepository.update(data.id, data)));
      return;
    }
    await this.nodeRepository.update(updateData.id, updateData);
  }

  async aiCreateNode(aiResponse: TextAiResponse, mindmapId: number, depth = 1) {
    const createdNodes: Node[] = [];

    const processNode = async (
      response: TextAiResponse,
      currentDepth: number,
      parentNodeId?: number,
    ): Promise<void> => {
      let node: Node;

      if (currentDepth === 1) {
        node = await this.nodeRepository.findOne({
          where: { mindmap: { id: mindmapId }, depth: 1 },
        });

        if (node) {
          node.keyword = response.keyword;
          node = await this.nodeRepository.save(node);
        }
      }

      if (!node) {
        node = await this.nodeRepository.save({
          keyword: response.keyword,
          depth: currentDepth,
          parent: parentNodeId ? { id: parentNodeId } : null,
          mindmap: { id: mindmapId },
        });
      }

      createdNodes.push(node);

      for (const child of response.children) {
        await processNode(child, currentDepth + 1, node.id);
      }
    };

    await processNode(aiResponse, depth);

    const nodeData = {};

    createdNodes.forEach((node) => {
      const id = node.id;
      nodeData[id] = {
        id,
        keyword: node.keyword,
        depth: node.depth,
        location: { x: node.locationX, y: node.locationY },
        children: [],
      };
    });

    createdNodes.forEach((node) => {
      const id = node.id;
      if (node.parent && node.parent.id !== undefined) {
        const parentId = node.parent.id;
        if (nodeData[parentId]) {
          nodeData[parentId].children.push(id);
        }
      }
    });

    return nodeData;
  }
}
