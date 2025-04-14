import { Test, TestingModule } from '@nestjs/testing';
import { NodeService } from './node.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Node } from '@app/entity';
import { In } from 'typeorm';

describe('NodeService', () => {
  let service: NodeService;

  const mockNodeRepository = {
    find: jest.fn(),
    findDescendants: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findBy: jest.fn(),
    softRemove: jest.fn(),
    update: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NodeService, { provide: getRepositoryToken(Node), useValue: mockNodeRepository }],
    }).compile();

    service = module.get<NodeService>(NodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findKeywordByMindmapId', () => {
    const mockMindmapId = 1;

    it('mindmapId에 해당하는 모든 노드의 키워드를 배열로 반환해야 한다', async () => {
      const mockNodes = [
        { id: 1, keyword: 'node1', mindmapId: mockMindmapId },
        { id: 2, keyword: 'node2', mindmapId: mockMindmapId },
        { id: 3, keyword: 'node3', mindmapId: mockMindmapId },
      ];

      mockNodeRepository.find.mockResolvedValue(mockNodes);

      const result = await service.findKeywordByMindmapId(mockMindmapId);

      expect(result).toEqual(['node1', 'node2', 'node3']);
    });

    it('mindmapId에 해당하는 노드가 없으면 빈 배열을 반환해야 한다', async () => {
      mockNodeRepository.find.mockResolvedValue([]);

      const result = await service.findKeywordByMindmapId(mockMindmapId);

      expect(result).toEqual([]);
    });
  });

  describe('getNodeTreeObject', () => {
    const mockMindmapId = 1;

    it('루트 노드가 없을 경우 빈 객체를 반환해야 한다', async () => {
      mockNodeRepository.findOne.mockResolvedValue(null);

      const result = await service.getNodeTreeObject(mockMindmapId);

      expect(result).toEqual({});
      expect(mockNodeRepository.findOne).toHaveBeenCalledWith({
        where: { mindmap: { id: mockMindmapId }, depth: 1 },
      });
      expect(mockNodeRepository.findDescendants).not.toHaveBeenCalled();
    });

    it('마인드맵의 모든 노드를 캔버스 형식으로 변환해야 한다', async () => {
      // 루트 노드 Mock
      const mockRootNode = {
        id: 1,
        keyword: '루트',
        depth: 1,
        locationX: 100,
        locationY: 100,
      };

      // 전체 트리 구조 Mock
      const mockNodeTree = [
        {
          id: 1,
          keyword: '루트',
          depth: 1,
          locationX: 100,
          locationY: 100,
          children: [
            {
              id: 2,
              keyword: '자식1',
              depth: 2,
              locationX: 200,
              locationY: 50,
            },
            {
              id: 3,
              keyword: '자식2',
              depth: 2,
              locationX: 200,
              locationY: 150,
            },
          ],
        },
        {
          id: 2,
          keyword: '자식1',
          depth: 2,
          locationX: 200,
          locationY: 50,
          children: [
            {
              id: 4,
              keyword: '손자1',
              depth: 3,
              locationX: 300,
              locationY: 50,
            },
          ],
        },
        {
          id: 3,
          keyword: '자식2',
          depth: 2,
          locationX: 200,
          locationY: 150,
          children: [],
        },
        {
          id: 4,
          keyword: '손자1',
          depth: 3,
          locationX: 300,
          locationY: 50,
          children: [],
        },
      ];

      // Mock 설정
      mockNodeRepository.findOne.mockResolvedValue(mockRootNode);
      mockNodeRepository.findDescendants.mockResolvedValue(mockNodeTree);

      const expectedResult = {
        1: {
          id: 1,
          keyword: '루트',
          depth: 1,
          location: { x: 100, y: 100 },
          children: [2, 3],
        },
        2: {
          id: 2,
          keyword: '자식1',
          depth: 2,
          location: { x: 200, y: 50 },
          children: [4],
        },
        3: {
          id: 3,
          keyword: '자식2',
          depth: 2,
          location: { x: 200, y: 150 },
          children: [],
        },
        4: {
          id: 4,
          keyword: '손자1',
          depth: 3,
          location: { x: 300, y: 50 },
          children: [],
        },
      };

      const result = await service.getNodeTreeObject(mockMindmapId);

      expect(result).toEqual(expectedResult);
      expect(mockNodeRepository.findOne).toHaveBeenCalledWith({
        where: { mindmap: { id: mockMindmapId }, depth: 1 },
      });
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledWith(mockRootNode, { relations: ['children'] });
    });

    it('단일 노드만 있는 경우를 처리해야 한다', async () => {
      const mockSingleNode = {
        id: 1,
        keyword: '단일노드',
        depth: 1,
        locationX: 100,
        locationY: 100,
        children: [],
      };

      mockNodeRepository.findOne.mockResolvedValue(mockSingleNode);
      mockNodeRepository.findDescendants.mockResolvedValue([mockSingleNode]);

      const expectedResult = {
        1: {
          id: 1,
          keyword: '단일노드',
          depth: 1,
          location: { x: 100, y: 100 },
          children: [],
        },
      };

      const result = await service.getNodeTreeObject(mockMindmapId);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateNodeTree', () => {
    const mockMindmapId = 1;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('노드 삭제와 업데이트를 모두 수행해야 한다', async () => {
      // 현재 DB의 노드들
      const mockCurrentNodes = [
        { id: 1, keyword: '기존루트' },
        { id: 2, keyword: '삭제될노드' },
      ];

      // 캔버스에서 전달된 데이터
      const mockCanvasData = {
        1: {
          id: 1,
          keyword: '수정된루트',
          depth: 1,
          location: { x: 100, y: 100 },
          children: [],
        },
      };

      // Mock 설정
      mockNodeRepository.find.mockResolvedValue(mockCurrentNodes);
      mockNodeRepository.manager = {
        transaction: jest.fn((callback) =>
          callback({
            softRemove: jest.fn(),
            update: jest.fn(),
          }),
        ),
      };

      await service.updateNodeTree(mockCanvasData, mockMindmapId);

      // 트랜잭션 내에서의 동작 확인
      const transactionCallback = mockNodeRepository.manager.transaction.mock.calls[0][0];
      const mockEntityManager = {
        softRemove: jest.fn(),
        update: jest.fn(),
      };
      await transactionCallback(mockEntityManager);

      // 삭제 동작 확인
      expect(mockEntityManager.softRemove).toHaveBeenCalledWith(Node, [{ id: 2 }]);

      // 업데이트 동작 확인
      expect(mockEntityManager.update).toHaveBeenCalledWith(Node, 1, {
        id: 1,
        keyword: '수정된루트',
        locationX: 100,
        locationY: 100,
        depth: 1,
      });
    });

    it('노드 업데이트만 수행해야 한다', async () => {
      // 현재 DB의 노드들
      const mockCurrentNodes = [{ id: 1, keyword: '기존루트' }];

      // 캔버스에서 전달된 데이터
      const mockCanvasData = {
        1: {
          id: 1,
          keyword: '수정된루트',
          depth: 1,
          location: { x: 100, y: 100 },
          children: [],
        },
      };

      // Mock 설정
      mockNodeRepository.find.mockResolvedValue(mockCurrentNodes);
      mockNodeRepository.manager = {
        transaction: jest.fn((callback) =>
          callback({
            softRemove: jest.fn(),
            update: jest.fn(),
          }),
        ),
      };

      await service.updateNodeTree(mockCanvasData, mockMindmapId);

      // 현재 노드 조회 확인
      expect(mockNodeRepository.find).toHaveBeenCalledWith({
        where: { mindmap: { id: mockMindmapId } },
        select: ['id'],
      });

      // 트랜잭션 내에서 update 호출 확인
      const transactionCallback = mockNodeRepository.manager.transaction.mock.calls[0][0];
      const mockEntityManager = {
        softRemove: jest.fn(),
        update: jest.fn(),
      };
      await transactionCallback(mockEntityManager);

      expect(mockEntityManager.softRemove).not.toHaveBeenCalled();
      expect(mockEntityManager.update).toHaveBeenCalledWith(Node, 1, {
        id: 1,
        keyword: '수정된루트',
        locationX: 100,
        locationY: 100,
        depth: 1,
      });
    });

    it('빈 캔버스 데이터가 전달되면 모든 노드를 삭제해야 한다', async () => {
      // 현재 DB의 노드들
      const mockCurrentNodes = [
        { id: 1, keyword: '삭제될노드1' },
        { id: 2, keyword: '삭제될노드2' },
      ];

      // Mock 설정
      mockNodeRepository.find.mockResolvedValue(mockCurrentNodes);
      mockNodeRepository.manager = {
        transaction: jest.fn((callback) =>
          callback({
            softRemove: jest.fn(),
            update: jest.fn(),
          }),
        ),
      };

      await service.updateNodeTree({}, mockMindmapId);

      // 트랜잭션 내에서의 동작 확인
      const transactionCallback = mockNodeRepository.manager.transaction.mock.calls[0][0];
      const mockEntityManager = {
        softRemove: jest.fn(),
        update: jest.fn(),
      };
      await transactionCallback(mockEntityManager);

      // 모든 노드 삭제 확인
      expect(mockEntityManager.softRemove).toHaveBeenCalledWith(Node, [{ id: 1 }, { id: 2 }]);
      expect(mockEntityManager.update).not.toHaveBeenCalled();
    });

    it('에러가 발생하면 로그를 남겨야 한다', async () => {
      const mockError = new Error('데이터베이스 에러');
      mockNodeRepository.find.mockRejectedValue(mockError);

      const mockLogger = jest.spyOn(service['logger'], 'error');

      await service.updateNodeTree({}, mockMindmapId);

      expect(mockLogger).toHaveBeenCalledWith('노드 트리 업데이트 중 오류가 발생했습니다: 데이터베이스 에러');
    });
  });

  describe('aiCreateNode', () => {
    const mockMindmapId = 1;

    const mockRootNode = {
      id: 1,
      keyword: '루트',
      depth: 1,
      locationX: 100,
      locationY: 100,
      parent: null,
      mindmap: { id: mockMindmapId },
      children: [],
    };
    const mockChildNode1 = {
      id: 2,
      keyword: '자식1',
      depth: 2,
      locationX: 200,
      locationY: 50,
      parent: { id: 1 },
      mindmap: { id: mockMindmapId },
      children: [],
    };
    const mockChildNode2 = {
      id: 3,
      keyword: '자식2',
      depth: 2,
      locationX: 200,
      locationY: 150,
      parent: { id: 1 },
      mindmap: { id: mockMindmapId },
      children: [],
    };
    const mockGrandChildNode1 = {
      id: 4,
      keyword: '손자1',
      depth: 3,
      locationX: 300,
      locationY: 50,
      parent: { id: 2 },
      mindmap: { id: mockMindmapId },
      children: [],
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('aiResponse에 따라 노드를 저장하고, getNodeTreeObject를 호출하여 최종 결과를 반환해야 한다 (루트 없는 경우)', async () => {
      const mockAiResponse = {
        keyword: '루트',
        children: [
          { keyword: '자식1', children: [{ keyword: '손자1', children: [] }] },
          { keyword: '자식2', children: [] },
        ],
      };

      // --- Mock Setup ---
      // 1. findRootNode (처음에는 없음)
      mockNodeRepository.findOne.mockResolvedValueOnce(null);
      // 2. save (루트, 자식1, 자식2 생성)
      mockNodeRepository.save
        .mockResolvedValueOnce({ ...mockRootNode })
        .mockResolvedValueOnce({ ...mockChildNode1 })
        .mockResolvedValueOnce({ ...mockChildNode2 })
        .mockResolvedValueOnce({ ...mockGrandChildNode1 });
      // 3. getNodeTreeObject 호출 시 내부 동작 Mock
      // 3.1 findRootNode (생성된 루트 반환)
      mockNodeRepository.findOne.mockResolvedValueOnce({ ...mockRootNode });
      // 3.2 findDescendants (생성된 노드 트리 반환 - children 관계 포함)
      const mockCreatedTree = [
        { ...mockRootNode, children: [mockChildNode1, mockChildNode2] }, // findDescendants는 children 로드
        { ...mockChildNode1, children: [mockGrandChildNode1] },
        { ...mockChildNode2, children: [] },
        { ...mockGrandChildNode1, children: [] },
      ];
      mockNodeRepository.findDescendants.mockResolvedValue(mockCreatedTree);
      // --- End Mock Setup ---

      const result = await service.aiCreateNode(mockAiResponse, mockMindmapId);

      // --- Assertions ---
      // findRootNode 호출 확인 (루트 생성 시도 1번, getNodeTreeObject 내부 1번)
      expect(mockNodeRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockNodeRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: { mindmap: { id: mockMindmapId }, depth: 1 },
      });
      expect(mockNodeRepository.findOne).toHaveBeenNthCalledWith(2, {
        where: { mindmap: { id: mockMindmapId }, depth: 1 },
      });
      // save 호출 확인 (루트, 자식1, 자식2)
      expect(mockNodeRepository.save).toHaveBeenCalledTimes(4);
      expect(mockNodeRepository.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ keyword: '루트', depth: 1 }),
      );
      expect(mockNodeRepository.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ keyword: '자식1', depth: 2, parent: { id: 1 } }),
      );
      expect(mockNodeRepository.save).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ keyword: '자식2', depth: 2, parent: { id: 1 } }),
      );
      expect(mockNodeRepository.save).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ keyword: '손자1', depth: 3, parent: { id: 2 } }),
      );
      // findDescendants 호출 확인 (getNodeTreeObject 내부)
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledTimes(1);
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        relations: ['children'],
      });
      // 최종 결과 확인 (getNodeTreeObject의 변환 결과)
      expect(result).toEqual({
        1: { id: 1, keyword: '루트', depth: 1, location: { x: 100, y: 100 }, children: [2, 3] },
        2: { id: 2, keyword: '자식1', depth: 2, location: { x: 200, y: 50 }, children: [4] },
        3: { id: 3, keyword: '자식2', depth: 2, location: { x: 200, y: 150 }, children: [] },
        4: { id: 4, keyword: '손자1', depth: 3, location: { x: 300, y: 50 }, children: [] },
      });
      // --- End Assertions ---
    });

    it('기존 루트 노드를 업데이트하고 새 자식을 저장한 후, getNodeTreeObject를 호출하여 최종 결과를 반환해야 한다', async () => {
      const mockAiResponse = {
        keyword: '수정된루트',
        children: [{ keyword: '새자식', children: [] }],
      };
      const mockExistingRoot = { ...mockRootNode, keyword: '기존루트', children: [] }; // 기존 루트
      const mockUpdatedRoot = { ...mockRootNode, keyword: '수정된루트' }; // 업데이트될 루트
      const mockNewChild = { ...mockChildNode1, id: 4, keyword: '새자식' }; // 새로 생성될 자식

      // --- Mock Setup ---
      // 1. findRootNode (기존 루트 반환)
      mockNodeRepository.findOne.mockResolvedValueOnce(mockExistingRoot);
      // 2. save (루트 업데이트, 새 자식 생성)
      mockNodeRepository.save.mockResolvedValueOnce({ ...mockUpdatedRoot }).mockResolvedValueOnce({ ...mockNewChild });
      // 3. getNodeTreeObject 호출 시 내부 동작 Mock
      // 3.1 findRootNode (업데이트된 루트 반환)
      mockNodeRepository.findOne.mockResolvedValueOnce({ ...mockUpdatedRoot });
      // 3.2 findDescendants (업데이트된 노드 트리 반환)
      const mockUpdatedTree = [
        { ...mockUpdatedRoot, children: [mockNewChild] }, // findDescendants는 children 로드
        { ...mockNewChild, children: [] },
      ];
      mockNodeRepository.findDescendants.mockResolvedValue(mockUpdatedTree);
      // --- End Mock Setup ---

      const result = await service.aiCreateNode(mockAiResponse, mockMindmapId);

      // --- Assertions ---
      expect(mockNodeRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockNodeRepository.save).toHaveBeenCalledTimes(2);
      expect(mockNodeRepository.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: 1, keyword: '수정된루트' }),
      );
      expect(mockNodeRepository.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ keyword: '새자식', depth: 2, parent: { id: 1 } }),
      );
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledTimes(1);
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        relations: ['children'],
      });
      expect(result).toEqual({
        1: { id: 1, keyword: '수정된루트', depth: 1, location: { x: 100, y: 100 }, children: [4] },
        4: { id: 4, keyword: '새자식', depth: 2, location: { x: 200, y: 50 }, children: [] },
      });
      // --- End Assertions ---
    });

    it('여러 깊이의 노드를 저장하고 getNodeTreeObject를 호출하여 최종 결과를 반환해야 한다', async () => {
      const mockAiResponse = {
        keyword: '루트',
        children: [{ keyword: '자식1', children: [{ keyword: '손자1', children: [] }] }],
      };

      // --- Mock Setup ---
      mockNodeRepository.findOne.mockResolvedValueOnce(null); // 루트 없음
      mockNodeRepository.save
        .mockResolvedValueOnce({ ...mockRootNode })
        .mockResolvedValueOnce({ ...mockChildNode1 })
        .mockResolvedValueOnce({ ...mockGrandChildNode1 });

      // getNodeTreeObject 내부 Mock
      mockNodeRepository.findOne.mockResolvedValueOnce({ ...mockRootNode });
      const mockCreatedTree = [
        { ...mockRootNode, children: [mockChildNode1] },
        { ...mockChildNode1, children: [mockGrandChildNode1] },
        { ...mockGrandChildNode1, children: [] },
      ];
      mockNodeRepository.findDescendants.mockResolvedValue(mockCreatedTree);
      // --- End Mock Setup ---

      const result = await service.aiCreateNode(mockAiResponse, mockMindmapId);

      // --- Assertions ---
      expect(mockNodeRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockNodeRepository.save).toHaveBeenCalledTimes(3);
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledTimes(1);
      expect(mockNodeRepository.findDescendants).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        relations: ['children'],
      });
      expect(result).toEqual({
        1: { id: 1, keyword: '루트', depth: 1, location: { x: 100, y: 100 }, children: [2] },
        2: { id: 2, keyword: '자식1', depth: 2, location: { x: 200, y: 50 }, children: [4] },
        4: { id: 4, keyword: '손자1', depth: 3, location: { x: 300, y: 50 }, children: [] },
      });
      // --- End Assertions ---
    });
  });
});
