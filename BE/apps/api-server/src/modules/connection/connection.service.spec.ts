import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService } from './connection.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { MindmapService } from '../mindmap/mindmap.service';
import { Role } from '@app/entity/enum/role.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Mindmap } from '@app/entity';
import { RoleService } from '../role/role.service';

describe('ConnectionService', () => {
  let service: ConnectionService;
  let redisService: jest.Mocked<RedisService>;
  let redisMock: jest.Mocked<Redis>;
  let mindmapService: jest.Mocked<MindmapService>;
  let roleService: jest.Mocked<RoleService>;

  beforeEach(async () => {
    redisMock = {
      sadd: jest.fn(),
      srem: jest.fn(),
      sismember: jest.fn(),
      hset: jest.fn(),
      set: jest.fn(),
      hgetall: jest.fn(),
    } as any;

    redisService = {
      getOrThrow: jest.fn().mockReturnValue(redisMock),
    } as any;

    mindmapService = {
      create: jest.fn(),
      getMindmapByConnectionId: jest.fn(),
      getDataByMindmapId: jest.fn(),
    } as any;

    roleService = {
      getUserRole: jest.fn(),
      getMindmapOwner: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionService,
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: MindmapService,
          useValue: mindmapService,
        },
        {
          provide: RoleService,
          useValue: roleService,
        },
      ],
    }).compile();

    service = module.get<ConnectionService>(ConnectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConnection', () => {
    it('유저 연결을 생성해야 한다', async () => {
      const userId = 1;
      const mindmapId = 123;
      const connectionId = 'test-connection-id';

      mindmapService.create.mockResolvedValue(mindmapId);
      roleService.getUserRole.mockResolvedValue(Role.OWNER);
      roleService.getMindmapOwner.mockResolvedValue([{ mindmapId, userId, ownerName: 'Test User' }]);
      mindmapService.getDataByMindmapId.mockResolvedValue({
        connectionId,
        aiCount: 0,
        title: '제목없음',
        nodes: {},
        content: '',
      });
      redisMock.hgetall.mockResolvedValue({});

      const result = await service.createConnection(userId);

      expect(result).toEqual({
        mindmapId,
        connectionId,
        role: Role.OWNER,
      });
    });

    it('게스트 연결을 생성해야 한다', async () => {
      redisMock.hgetall.mockResolvedValue({});
      const result = await service.createConnection();

      expect(result).toHaveProperty('connectionId');
      expect(result.role).toBe(Role.OWNER);
      expect(redisMock.hset).toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConnection', () => {
    it('마인드맵을 찾을 수 없을 때 NotFoundException을 던져야 한다', async () => {
      mindmapService.getMindmapByConnectionId.mockResolvedValue(null);

      await expect(service.getConnection('invalid-id', 1)).rejects.toThrow(NotFoundException);
    });

    it('유저가 권한이 없을 때 ForbiddenException을 던져야 한다', async () => {
      const mindmapId = 123;
      mindmapService.getMindmapByConnectionId.mockResolvedValue({
        id: mindmapId,
      } as Mindmap);
      roleService.getUserRole.mockResolvedValue(null);

      await expect(service.getConnection('connection-id', 1)).rejects.toThrow(ForbiddenException);
    });

    it('유효한 연결 정보를 반환해야 한다', async () => {
      const mindmapId = 123;
      const userId = 1;
      const connectionId = 'test-connection-id';

      mindmapService.getMindmapByConnectionId.mockResolvedValue({
        id: mindmapId,
      } as Mindmap);
      roleService.getUserRole.mockResolvedValue(Role.EDITOR);
      roleService.getMindmapOwner.mockResolvedValue([{ mindmapId, userId, ownerName: 'Test User' }]);
      mindmapService.getDataByMindmapId.mockResolvedValue({
        connectionId,
        aiCount: 0,
        title: '테스트',
        nodes: {},
        content: '',
      });
      redisMock.hgetall.mockResolvedValue({});

      const result = await service.getConnection(connectionId, userId);

      expect(result).toEqual({
        mindmapId,
        connectionId,
        role: Role.EDITOR,
      });
    });
  });
});
