import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionController } from './connection.controller';
import { ConnectionService } from './connection.service';
import { BadRequestException } from '@nestjs/common';
import { Role } from '@app/entity/enum/role.enum';

describe('ConnectionController', () => {
  let controller: ConnectionController;
  let connectionService: jest.Mocked<ConnectionService>;

  beforeEach(async () => {
    connectionService = {
      createConnection: jest.fn(),
      getConnection: jest.fn(),
      getConnectionInfo: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectionController],
      providers: [
        {
          provide: ConnectionService,
          useValue: connectionService,
        },
      ],
    }).compile();

    controller = module.get<ConnectionController>(ConnectionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createConnection', () => {
    it('인증된 유저의 연결을 생성해야 한다', async () => {
      const user = { id: 1, email: 'test@test.com' };
      const expectedResult = { mindmapId: 1, connectionId: 'test-id', role: Role.OWNER };

      connectionService.createConnection.mockResolvedValue(expectedResult);

      const result = await controller.createConnection(user);

      expect(result).toEqual(expectedResult);
      expect(connectionService.createConnection).toHaveBeenCalledWith(user.id);
    });

    it('인증되지 않은 유저의 연결을 생성해야 한다', async () => {
      const expectedResult = { connectionId: 'guest-id', role: Role.OWNER as Role.OWNER };

      connectionService.createConnection.mockResolvedValue(expectedResult);

      const result = await controller.createConnection(null);

      expect(result).toEqual(expectedResult);
      expect(connectionService.createConnection).toHaveBeenCalledWith();
    });
  });

  describe('getConnection', () => {
    const user = { id: 1, email: 'test@test.com' };

    it('연결 ID로 연결 정보를 조회해야 한다', async () => {
      const queryDto = { type: 'connection', id: 'test-connection-id' };
      const expectedResult = { mindmapId: 1, connectionId: 'test-connection-id', role: Role.EDITOR };

      connectionService.getConnection.mockResolvedValue(expectedResult);

      const result = await controller.getConnection(queryDto, user);

      expect(result).toEqual(expectedResult);
      expect(connectionService.getConnection).toHaveBeenCalledWith(queryDto.id, user.id);
    });

    it('마인드맵 ID로 연결 정보를 조회해야 한다', async () => {
      const queryDto = { type: 'mindmap', id: 1 };
      const expectedResult = { mindmapId: 1, connectionId: 'test-connection-id', role: Role.EDITOR };

      connectionService.getConnectionInfo.mockResolvedValue(expectedResult);

      const result = await controller.getConnection(queryDto, user);

      expect(result).toEqual(expectedResult);
      expect(connectionService.getConnectionInfo).toHaveBeenCalledWith(queryDto.id, user.id);
    });

    it('유효하지 않은 쿼리 타입에 대해 BadRequestException을 던져야 한다', async () => {
      const queryDto = { type: 'invalid', id: 1 } as any;

      await expect(controller.getConnection(queryDto, user)).rejects.toThrow(BadRequestException);
    });
  });
});
