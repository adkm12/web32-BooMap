import { Test, TestingModule } from '@nestjs/testing';
import { AuthController, AuthenticatedRequest } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { User } from '@app/entity';
import { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;

  const createMockRequest = (user: Partial<User>, cookies: any = {}) => {
    const req = {
      ...Object.create(Request.prototype),
      user,
      cookies,
    };
    return req as AuthenticatedRequest;
  };

  const createMockResponse = (): Response => {
    const res = {
      ...Object.create(Response.prototype),
      cookie: jest.fn(),
      redirect: jest.fn(),
      clearCookie: jest.fn(),
      json: jest.fn(),
    };
    return res;
  };

  const mockUser: Partial<User> = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockAuthService = {
    generateRefreshToken: jest.fn(),
    verifiedRefreshToken: jest.fn(),
    logout: jest.fn(),
  };

  const mockUserService = {
    findByGithubEmail: jest.fn(),
    createGithubUser: jest.fn(),
    findByKakaoEmail: jest.fn(),
    createKakaoUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('callback', () => {
    describe('githubLoginCallback', () => {
      it('이미 회원인 경우 쿠키에 refreshToken을 저장하고 /auth로 리다이렉트 한다.', async () => {
        // 목 설정
        const mockRefreshToken = 'refresh-token';
        const mockReq = createMockRequest(mockUser);
        const mockRes = createMockResponse();

        mockUserService.findByGithubEmail.mockResolvedValue(mockUser);
        mockAuthService.generateRefreshToken.mockReturnValue(mockRefreshToken);

        // 테스트 실행
        await controller.githubLoginCallback(mockReq, mockRes);

        // 검증
        expect(mockUserService.findByGithubEmail).toHaveBeenCalledWith(mockReq.user.email);
        expect(mockUserService.createGithubUser).not.toHaveBeenCalled();
        expect(mockAuthService.generateRefreshToken).toHaveBeenCalledWith(mockUser);
        expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', mockRefreshToken, {
          httpOnly: true,
          secure: true,
        });
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth');
      });

      it('회원이 아닌경우 회원가입 후 쿠키에 refreshToken을 저장하고 /auth로 리다이렉트 한다.', async () => {
        // 목 설정
        const mockRefreshToken = 'refresh-token';
        const mockReq = createMockRequest(mockUser);
        const mockRes = createMockResponse();

        mockUserService.findByGithubEmail.mockResolvedValue(null);
        mockUserService.createGithubUser.mockResolvedValue(mockUser);
        mockAuthService.generateRefreshToken.mockReturnValue(mockRefreshToken);

        // 테스트 실행
        await controller.githubLoginCallback(mockReq, mockRes);

        // 검증
        expect(mockUserService.findByGithubEmail).toHaveBeenCalledWith(mockReq.user.email);
        expect(mockUserService.createGithubUser).toHaveBeenCalled();
        expect(mockAuthService.generateRefreshToken).toHaveBeenCalledWith(mockUser);
        expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', mockRefreshToken, {
          httpOnly: true,
          secure: true,
        });
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth');
      });
    });

    describe('kakaoLoginCallback', () => {
      it('이미 회원인 경우 쿠키에 refreshToken을 저장하고 /auth로 리다이렉트 한다.', async () => {
        // 목 설정
        const mockRefreshToken = 'refresh-token';
        const mockReq = createMockRequest(mockUser);
        const mockRes = createMockResponse();

        mockUserService.findByKakaoEmail.mockResolvedValue(mockUser);
        mockAuthService.generateRefreshToken.mockReturnValue(mockRefreshToken);

        // 테스트 실행
        await controller.kakaoLoginCallback(mockReq, mockRes);

        // 검증
        expect(mockUserService.findByKakaoEmail).toHaveBeenCalledWith(mockReq.user.email);
        expect(mockUserService.createKakaoUser).not.toHaveBeenCalled();
        expect(mockAuthService.generateRefreshToken).toHaveBeenCalledWith(mockUser);
        expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', mockRefreshToken, {
          httpOnly: true,
          secure: true,
        });
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth');
      });

      it('회원이 아닌경우 회원가입 후 쿠키에 refreshToken을 저장하고 /auth로 리다이렉트 한다.', async () => {
        // 목 설정
        const mockRefreshToken = 'refresh-token';
        const mockReq = createMockRequest(mockUser);
        const mockRes = createMockResponse();

        mockUserService.findByKakaoEmail.mockResolvedValue(null);
        mockUserService.createKakaoUser.mockResolvedValue(mockUser);
        mockAuthService.generateRefreshToken.mockReturnValue(mockRefreshToken);

        // 테스트 실행
        await controller.kakaoLoginCallback(mockReq, mockRes);

        // 검증
        expect(mockUserService.findByKakaoEmail).toHaveBeenCalledWith(mockReq.user.email);
        expect(mockUserService.createKakaoUser).toHaveBeenCalled();
        expect(mockAuthService.generateRefreshToken).toHaveBeenCalledWith(mockUser);
        expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', mockRefreshToken, {
          httpOnly: true,
          secure: true,
        });
        expect(mockRes.redirect).toHaveBeenCalledWith('/auth');
      });
    });
  });

  describe('refresh', () => {
    it('쿠키에 저장된 refreshToken을 검증하고 새로운 accessToken을 발급한다.', async () => {
      // 목 설정
      const mockRefreshToken = 'refresh-token';
      const mockAccessToken = 'access-token';
      const mockReq = createMockRequest(mockUser, {
        refreshToken: mockRefreshToken,
      });
      const mockRes = createMockResponse();

      mockAuthService.verifiedRefreshToken.mockResolvedValue(mockAccessToken);

      // 테스트 실행
      await controller.refresh(mockReq, mockRes);

      // 검증
      expect(mockAuthService.verifiedRefreshToken).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockRes.json).toHaveBeenCalledWith({ accessToken: mockAccessToken });
    });
  });

  describe('logout', () => {
    it('쿠키에 저장된 refreshToken을 삭제하고 로그아웃 한다.', async () => {
      // 목 설정
      const mockRefreshToken = 'refresh-token';
      const mockReq = createMockRequest(mockUser, {
        refreshToken: mockRefreshToken,
      });
      const mockRes = createMockResponse();

      // 테스트 실행
      await controller.logout(mockReq, mockRes);

      // 검증
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'success' });
    });

    it('쿠키에 저장된 refreshToken이 없는 경우 로그아웃 하지 않는다.', async () => {
      // 목 설정
      const mockReq = createMockRequest(mockUser, {
        refreshToken: undefined,
      });
      const mockRes = createMockResponse();

      // 테스트 실행
      await controller.logout(mockReq, mockRes);

      // 검증
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalledWith();
    });
  });
});
