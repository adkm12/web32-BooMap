import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '@app/entity';
import { authException } from '../../exceptions';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let redisService: RedisService;

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
  } as User;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockRedisService = {
    getOrThrow: jest.fn().mockReturnValue({
      set: jest.fn(),
      get: jest.fn(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('access token을 생성해야 한다', () => {
      const mockToken = 'mock.access.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = service.generateAccessToken(mockUser);

      expect(result).toBe(mockToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ email: 'test@example.com', id: 1 }, { expiresIn: 60 * 30 });
    });
  });

  describe('generateRefreshToken', () => {
    it('refresh token을 생성해야 한다', () => {
      const mockToken = 'mock.refresh.token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = service.generateRefreshToken(mockUser);

      expect(result).toBe(mockToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { id: mockUser.id, email: mockUser.email },
        { expiresIn: '14d' },
      );
    });
  });

  describe('verifiedRefreshToken', () => {
    const mockRefreshToken = 'mock.refresh.token';
    const mockAccessToken = 'mock.access.token';

    it('refresh token을 검증하고 새로운 access token을 반환해야 한다', async () => {
      const mockPayload = { id: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockJwtService.sign.mockReturnValue(mockAccessToken);

      const result = await service.verifiedRefreshToken(mockRefreshToken);

      expect(result).toBe(mockAccessToken);
      expect(mockJwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { email: mockUser.email, id: mockUser.id },
        { expiresIn: 60 * 30 },
      );
    });

    it('토큰이 유효하지 않을 때 authException을 발생시켜야 한다', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifiedRefreshToken(mockRefreshToken)).rejects.toThrow(authException);
    });
  });

  describe('logout', () => {
    const mockRefreshToken = 'mock.refresh.token';

    it('refresh token을 블랙리스트에 추가해야 한다', async () => {
      const mockRedis = mockRedisService.getOrThrow();
      await service.logout(mockRefreshToken);

      expect(mockRedis.set).toHaveBeenCalledWith(mockRefreshToken, 'true', 'EX', 60 * 60 * 24 * 3);
    });

    it('로그아웃이 실패할 때 authException을 발생시켜야 한다', async () => {
      const mockRedis = mockRedisService.getOrThrow();
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.logout(mockRefreshToken)).rejects.toThrow(authException);
    });
  });

  describe('checkBlackList', () => {
    const mockRefreshToken = 'mock.refresh.token';

    it('토큰이 블랙리스트에 있을 때 UnauthorizedException을 발생시켜야 한다', async () => {
      const mockRedis = mockRedisService.getOrThrow();
      mockRedis.get.mockResolvedValue('true');

      await expect(service['checkBlackList'](mockRefreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('토큰이 블랙리스트에 없을 때 예외를 발생시키지 않아야 한다', async () => {
      const mockRedis = mockRedisService.getOrThrow();
      mockRedis.get.mockResolvedValue(null);

      await expect(service['checkBlackList'](mockRefreshToken)).resolves.not.toThrow();
    });
  });
});
