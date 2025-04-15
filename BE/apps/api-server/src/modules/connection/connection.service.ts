import { MindmapService } from './../mindmap/mindmap.service';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '@app/entity/enum/role.enum';
import { RoleService } from '../role/role.service';

interface BaseConnectionInfo {
  type: 'guest' | 'user';
  aiCount: number;
  title: string;
}

interface GuestConnectionInfo extends BaseConnectionInfo {
  type: 'guest';
}

interface UserConnectionInfo extends BaseConnectionInfo {
  type: 'user';
  mindmapId: number;
  ownerId: number;
}

interface BaseConnectionResponse {
  connectionId: string;
  role: Role;
}

export interface GuestConnectionResponse extends BaseConnectionResponse {
  role: Role.OWNER;
}

export interface UserConnectionResponse extends BaseConnectionResponse {
  mindmapId: number;
}

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);
  private readonly GeneralRedis: Redis | null;

  constructor(
    private readonly redisService: RedisService,
    private readonly mindmapService: MindmapService,
    private readonly roleService: RoleService,
  ) {
    this.GeneralRedis = this.redisService.getOrThrow('general');
  }

  async createConnection(userId: null | number = null) {
    if (userId) {
      return await this.createUserConnection(userId);
    }
    return await this.createGuestConnection();
  }

  private async createUserConnection(userId: number): Promise<UserConnectionResponse> {
    const mindmapId = await this.mindmapService.create(userId);
    return await this.getConnectionInfo(mindmapId, userId);
  }

  private async createGuestConnection(): Promise<GuestConnectionResponse> {
    const connectionId = uuidv4();
    const guestInfo: GuestConnectionInfo = {
      type: 'guest',
      aiCount: 0,
      title: '제목없음',
    };

    await this.cachingConnectionInfo(connectionId, guestInfo);
    return { connectionId, role: Role.OWNER };
  }

  async getConnection(connectionId: string, userId: number): Promise<UserConnectionResponse> {
    const mindmap = await this.mindmapService.getMindmapByConnectionId(connectionId);
    if (!mindmap) {
      this.logger.error(`Mindmap with connectionId ${connectionId} not found`);
      throw new NotFoundException('마인드맵을 찾을 수 없습니다.');
    }
    return await this.getConnectionInfo(mindmap.id, userId);
  }

  async getConnectionInfo(mindmapId: number, userId: number): Promise<UserConnectionResponse> {
    const role = await this.roleService.getUserRole(userId, mindmapId);
    if (!role) {
      this.logger.error(`User ${userId} does not have role for mindmap ${mindmapId}`);
      throw new ForbiddenException('권한이 없습니다.');
    }

    const ownerResult = await this.roleService.getMindmapOwner(mindmapId);
    if (ownerResult.length === 0) {
      this.logger.error(`Owner not found for mindmap ${mindmapId} where user ${userId} has role ${role}`);
      throw new NotFoundException('마인드맵 소유자 정보를 찾을 수 없습니다.');
    }
    const ownerInfo = ownerResult[0];

    const mindmapData = await this.mindmapService.getDataByMindmapId(mindmapId);

    const userInfo: UserConnectionInfo = {
      type: 'user',
      mindmapId,
      aiCount: mindmapData.aiCount,
      title: mindmapData.title,
      ownerId: ownerInfo.userId,
    };

    await this.cachingConnectionInfo(mindmapData.connectionId, userInfo, mindmapData.nodes, mindmapData.content);

    return {
      mindmapId,
      connectionId: mindmapData.connectionId,
      role,
    };
  }

  private async cachingConnectionInfo<T extends BaseConnectionInfo>(
    connectionId: string,
    info: T,
    nodes: object = {},
    content: string = '',
  ) {
    if (await this.isCachedConnection(connectionId)) {
      return;
    }

    await Promise.all([
      this.GeneralRedis.hset(connectionId, info),
      this.GeneralRedis.set(`mindmapState:${connectionId}`, JSON.stringify(nodes)),
      this.GeneralRedis.set(`content:${connectionId}`, content),
    ]);
  }

  private async isCachedConnection(connectionId: string) {
    const cachedInfo = await this.GeneralRedis.hgetall(connectionId);
    return Object.keys(cachedInfo).length > 0;
  }
}
