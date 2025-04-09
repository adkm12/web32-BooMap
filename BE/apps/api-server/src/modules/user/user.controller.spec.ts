import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from '@app/entity';
describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    getUserInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserInfo', () => {
    it('유저 정보를 조회해야 한다', async () => {
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      mockUserService.getUserInfo.mockResolvedValue(mockUser);

      const result = await controller.getUserInfo(mockUser);

      expect(result).toEqual(mockUser);
      expect(mockUserService.getUserInfo).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
