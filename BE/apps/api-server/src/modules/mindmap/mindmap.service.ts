import { InjectRepository } from '@nestjs/typeorm';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Mindmap } from '@app/entity';
import { v4 as uuidv4 } from 'uuid';
import { UpdateMindmapDto } from './dto/update.mindmap.dto';
import { NodeService } from '../node/node.service';
import { MindmapException } from '../../exceptions';
import { RoleService } from '../role/role.service';

@Injectable()
export class MindmapService {
  private readonly logger = new Logger(MindmapService.name);
  constructor(
    @InjectRepository(Mindmap) private mindmapRepository: Repository<Mindmap>,
    private nodeService: NodeService,
    private roleService: RoleService,
  ) {}

  async create(userId: number) {
    try {
      const uuid = uuidv4();
      const mindmap = this.mindmapRepository.create({ connectionId: uuid, aiContent: '', content: '' });
      const savedMindmap = await this.mindmapRepository.save(mindmap);
      await this.roleService.assignRole(userId, savedMindmap.id);
      return savedMindmap.id;
    } catch (error) {
      this.logger.error(error);
      throw new MindmapException('마인드맵 생성에 실패했습니다.');
    }
  }

  createGuest() {
    const uuid = uuidv4();
    return uuid;
  }

  async findAllByUserId(userId: number) {
    const mindmaps = await this.mindmapRepository.find({
      where: { userMindmapRoles: { user: { id: userId } } },
    });
    return mindmaps;
  }

  async update(mindmapId: number, updateMindmapDto: UpdateMindmapDto) {
    await this.mindmapRepository.update({ id: mindmapId }, updateMindmapDto);
  }

  async delete(mindmapId: number, userId: number) {
    const isOwner = await this.roleService.verifyUserIsOwner(userId, mindmapId);
    if (!isOwner) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const mindmap = await this.mindmapRepository.findOne({
      where: { id: mindmapId },
      relations: ['nodes', 'userMindmapRoles'],
    });

    if (!mindmap) {
      throw new NotFoundException('마인드맵을 찾을 수 없습니다.');
    }

    await this.mindmapRepository.softRemove(mindmap);
  }

  async getDataByMindmapId(mindmapId: number) {
    const mindmap = await this.mindmapRepository.findOne({ where: { id: mindmapId } });
    if (!mindmap) {
      throw new NotFoundException('마인드맵을 찾을 수 없습니다.');
    }

    const nodes = await this.nodeService.getNodeTreeObject(mindmap.id);

    return {
      title: mindmap.title,
      content: mindmap.content,
      aiCount: mindmap.aiCount,
      connectionId: mindmap.connectionId,
      nodes,
    };
  }

  async getMindmapByConnectionId(connectionId: string): Promise<Mindmap | null> {
    return await this.mindmapRepository.findOne({ where: { connectionId } });
  }
}
