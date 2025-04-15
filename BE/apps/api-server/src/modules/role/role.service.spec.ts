import { Test, TestingModule } from '@nestjs/testing';
import { RoleService } from './role.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserMindmapRole } from '@app/entity';
import { Repository } from 'typeorm';
import { Role } from '@app/entity/enum/role.enum';

describe('RoleService', () => {
  let service: RoleService;
  let repository: Repository<UserMindmapRole>;

  const mockUserMindmapRole = {
    id: 1,
    user: { id: 1, name: '테스트 유저' },
    mindmap: { id: 1 },
    role: Role.OWNER,
  };

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getRepositoryToken(UserMindmapRole),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    repository = module.get<Repository<UserMindmapRole>>(getRepositoryToken(UserMindmapRole));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRole', () => {
    it('사용자의 마인드맵 역할을 반환해야 한다', async () => {
      mockRepository.findOne.mockResolvedValue(mockUserMindmapRole);

      const result = await service.getUserRole(1, 1);
      expect(result).toBe(Role.OWNER);
    });

    it('역할이 없는 경우 null을 반환해야 한다', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserRole(1, 1);
      expect(result).toBeNull();
    });
  });

  describe('assignRole', () => {
    it('새로운 역할을 할당해야 한다', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUserMindmapRole);
      mockRepository.save.mockResolvedValue(mockUserMindmapRole);

      const result = await service.assignRole(1, 1, Role.OWNER);
      expect(result).toEqual(mockUserMindmapRole);
    });

    it('기존 역할을 업데이트해야 한다', async () => {
      const existingRole = { ...mockUserMindmapRole, role: Role.EDITOR };
      mockRepository.findOne.mockResolvedValue(existingRole);
      mockRepository.save.mockResolvedValue({ ...existingRole, role: Role.OWNER });

      const result = await service.assignRole(1, 1, Role.OWNER);
      expect(result.role).toBe(Role.OWNER);
    });
  });

  describe('getMindmapOwner', () => {
    const ownerInfo = {
      mindmapId: 1,
      userId: 1,
      ownerName: '테스트 유저',
    };

    it('단일 마인드맵의 소유자 정보를 반환해야 한다', async () => {
      mockRepository.findOne.mockResolvedValue(mockUserMindmapRole);

      const result = await service.getMindmapOwner(1);
      expect(result).toEqual([ownerInfo]);
    });

    it('여러 마인드맵의 소유자 정보를 반환해야 한다', async () => {
      mockRepository.find.mockResolvedValue([mockUserMindmapRole]);

      const result = await service.getMindmapOwner([1]);
      expect(result).toEqual([ownerInfo]);
    });
  });

  describe('verifyUserIsOwner', () => {
    it('사용자가 소유자인 경우 true를 반환해야 한다', async () => {
      mockRepository.findOne.mockResolvedValue(mockUserMindmapRole);

      const result = await service.verifyUserIsOwner(1, 1);
      expect(result).toBe(true);
    });

    it('사용자가 소유자가 아닌 경우 false를 반환해야 한다', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUserMindmapRole, role: Role.EDITOR });

      const result = await service.verifyUserIsOwner(1, 1);
      expect(result).toBe(false);
    });
  });
});
