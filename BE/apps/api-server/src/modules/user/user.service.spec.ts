import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { User } from '@app/entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserMindmapRole } from '@app/entity';
import { Repository } from 'typeorm';
import { UserCreateDto } from './dto';
import { BadRequestException } from '@nestjs/common';

type MockRepository<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;
describe('UserService', () => {
  let userService: UserService;
  let userRepository: MockRepository<User>;
  let userMindmapRoleRepository: MockRepository<UserMindmapRole>;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserMindmapRoleRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserMindmapRole),
          useValue: mockUserMindmapRoleRepository,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<MockRepository<User>>(getRepositoryToken(User));
    userMindmapRoleRepository = module.get<MockRepository<UserMindmapRole>>(getRepositoryToken(UserMindmapRole));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  describe('createbUser', () => {
    it('github 유저를 생성한다', async () => {
      const userDto: UserCreateDto = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const user = { ...userDto, type: 'github' };

      userRepository.create.mockReturnValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await userService.createUser(userDto, 'github');

      expect(userRepository.create).toHaveBeenCalledWith(user);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('kakao 유저를 생성한다', async () => {
      const userDto: UserCreateDto = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const user = { ...userDto, type: 'kakao' };

      userRepository.create.mockReturnValue(user);
      userRepository.save.mockResolvedValue(user);

      const result = await userService.createUser(userDto, 'kakao');

      expect(userRepository.create).toHaveBeenCalledWith(user);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it('DTO가 유효하지 않으면 예외가 발생해야 한다 : 이메일이 없는 경우', async () => {
      const userDto: UserCreateDto = {
        email: '',
        name: 'Test User',
      };

      await expect(userService.createUser(userDto, 'github')).rejects.toThrow(BadRequestException);
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('DTO가 유효하지 않으면 예외가 발생해야 한다 : 이름이 없는 경우', async () => {
      const userDto: UserCreateDto = {
        email: 'test@example.com',
        name: '',
      };

      await expect(userService.createUser(userDto, 'github')).rejects.toThrow(BadRequestException);
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('github 유저를 조회해야 한다', async () => {
      const email = 'test@example.com';
      const user = { id: 1, email, name: 'Test User', type: 'github' };
      userRepository.findOne.mockResolvedValue(user);

      const result = await userService.findByEmail(email, 'github');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email, type: 'github' } });
      expect(result).toEqual(user);
    });

    it('kakao 유저를 조회해야 한다', async () => {
      const email = 'test@example.com';
      const user = { id: 1, email, name: 'Test User', type: 'kakao' };
      userRepository.findOne.mockResolvedValue(user);

      const result = await userService.findByEmail(email, 'kakao');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email, type: 'kakao' } });
      expect(result).toEqual(user);
    });

    it('유저를 찾을 수 없으면 null을 반환해야 한다', async () => {
      const email = 'test@example.com';
      userRepository.findOne.mockResolvedValue(null);

      const result = await userService.findByEmail(email, 'github');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('유저를 조회해야 한다', async () => {
      const userId = 1;
      const user = { id: userId, email: 'test@example.com', name: 'Test User', type: 'github' };
      userRepository.findOne.mockResolvedValue(user);

      const result = await userService.findById(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(result).toEqual(user);
    });

    it('유저를 찾을 수 없으면 null을 반환해야 한다', async () => {
      const userId = 1;
      userRepository.findOne.mockResolvedValue(null);

      const result = await userService.findById(userId);
      expect(result).toBeNull();
    });
  });

  describe('getUserInfo', () => {
    it('유저 정보를 조회해야 한다', async () => {
      const userId = 1;
      const user = { id: userId, email: 'test@example.com', name: 'Test User' };
      userRepository.findOne.mockResolvedValue(user);

      const result = await userService.getUserInfo(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(result).toEqual(user);
    });
  });

  describe('getRole', () => {
    it('유저 역할을 조회해야 한다', async () => {
      const userId = 1;
      const mindmapId = 1;
      const role = 'admin';
      const userMindmapRole = { id: 1, user: { id: userId }, mindmap: { id: mindmapId }, role };
      userMindmapRoleRepository.findOne.mockResolvedValue(userMindmapRole);

      const result = await userService.getRole(userId, mindmapId);

      expect(userMindmapRoleRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, mindmap: { id: mindmapId } },
      });
      expect(result).toEqual(role);
    });

    it('유저 역할을 찾을 수 없으면 null을 반환해야 한다', async () => {
      const userId = 1;
      const mindmapId = 1;
      userMindmapRoleRepository.findOne.mockResolvedValue(null);

      const result = await userService.getRole(userId, mindmapId);
      expect(result).toBeNull();
    });
  });
});
