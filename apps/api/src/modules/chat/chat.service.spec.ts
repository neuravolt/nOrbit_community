import { ChatService } from './chat.service';
import { GuardianDlpService } from './guardian-dlp.service';
import { ChatGateway } from './chat.gateway';
import { ChatConversationType, ChatMessageType } from '@prisma/client';

describe('ChatService', () => {
  let service: ChatService;
  let prismaMock: any;
  let dlpService: GuardianDlpService;
  let gatewayMock: any;

  beforeEach(() => {
    prismaMock = {
      chatMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      chatConversation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      chatMessage: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      chatMessageReaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      task: {
        create: jest.fn(),
      },
      projectTaskCounter: {
        upsert: jest.fn(),
      },
    };

    dlpService = new GuardianDlpService();

    gatewayMock = {
      isUserOnline: jest.fn().mockReturnValue(true),
      broadcastToRoom: jest.fn(),
      broadcastToUser: jest.fn(),
      broadcastPresence: jest.fn(),
    };

    service = new ChatService(prismaMock, dlpService, gatewayMock);
  });

  describe('postMessage', () => {
    it('should sanitize content through Guardian DLP before persisting and broadcasting', async () => {
      const senderId = 'user-1';
      const conversationId = 'conv-1';
      const rawContent = 'Check this AWS token: AKIAIOSFODNN7EXAMPLE';

      prismaMock.chatMember.findUnique.mockResolvedValue({
        conversationId,
        userId: senderId,
        conversation: { id: conversationId },
      });

      prismaMock.chatMessage.create.mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'msg-1',
          ...data,
          createdAt: new Date(),
          sender: { firstName: 'Ajay', lastName: 'Tomar', role: 'SUPER_ADMIN' },
          reactions: [],
        });
      });

      prismaMock.chatConversation.update.mockResolvedValue({});
      prismaMock.chatMember.update.mockResolvedValue({});

      const result = await service.postMessage(senderId, conversationId, {
        content: rawContent,
      });

      // Verify that the stored content does NOT contain raw secret
      expect(result.content).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.content).toContain('REDACTED_AWS_KEY');
      expect(result.hasRedactedData).toBe(true);

      // Verify WebSocket broadcast
      expect(gatewayMock.broadcastToRoom).toHaveBeenCalledWith(
        conversationId,
        'new_message',
        expect.objectContaining({
          id: 'msg-1',
          hasRedactedData: true,
        }),
      );
    });

    it('should disallow posting if user is not a member', async () => {
      prismaMock.chatMember.findUnique.mockResolvedValue(null);

      await expect(
        service.postMessage('attacker-id', 'private-conv', {
          content: 'Hello',
        }),
      ).rejects.toThrow('Not a member of this conversation');
    });
  });

  describe('getOrCreateDirectConversation', () => {
    it('should return existing conversation if one already exists between users', async () => {
      const existingConv = {
        id: 'conv-123',
        type: ChatConversationType.DIRECT,
      };
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prismaMock.chatConversation.findFirst.mockResolvedValue(existingConv);

      const result = await service.getOrCreateDirectConversation(
        'user-1',
        'user-2',
      );
      expect(result).toBe(existingConv);
      expect(prismaMock.chatConversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if none exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prismaMock.chatConversation.findFirst.mockResolvedValue(null);
      prismaMock.chatConversation.create.mockResolvedValue({
        id: 'new-conv',
        type: ChatConversationType.DIRECT,
      });

      const result = await service.getOrCreateDirectConversation(
        'user-1',
        'user-2',
      );
      expect(result.id).toBe('new-conv');
      expect(prismaMock.chatConversation.create).toHaveBeenCalled();
    });
  });

  describe('toggleReaction', () => {
    it('should add reaction if not existing and broadcast update', async () => {
      prismaMock.chatMessage.findUnique.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
      });
      prismaMock.chatMessageReaction.findUnique.mockResolvedValue(null);
      prismaMock.chatMessageReaction.findMany.mockResolvedValue([
        { emoji: '🚀', userId: 'user-1' },
      ]);

      await service.toggleReaction('user-1', 'msg-1', '🚀');

      expect(prismaMock.chatMessageReaction.create).toHaveBeenCalledWith({
        data: { messageId: 'msg-1', userId: 'user-1', emoji: '🚀' },
      });
      expect(gatewayMock.broadcastToRoom).toHaveBeenCalledWith(
        'conv-1',
        'reaction_updated',
        expect.anything(),
      );
    });
  });
});
