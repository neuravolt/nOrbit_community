import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GuardianDlpService } from './guardian-dlp.service';
import { ChatGateway } from './chat.gateway';
import { WebPushService } from '../guardian/services/web-push.service';
import {
  ChatConversationType,
  ChatMessageType,
  ChatMemberRole,
} from '@prisma/client';

export interface CreateMessageDto {
  content: string;
  type?: ChatMessageType;
  parentId?: string;
  isInternalOnly?: boolean;
  metadata?: any;
}

export interface CreateConversationDto {
  title?: string;
  description?: string;
  type?: ChatConversationType;
  isPrivate?: boolean;
  memberIds?: string[];
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dlpService: GuardianDlpService,
    private readonly gateway: ChatGateway,
    @Optional() private readonly webPushService?: WebPushService,
  ) {}

  /**
   * Lists all conversations for a user with unread counts and recent messages.
   */
  async listUserConversations(userId: string, isClient: boolean = false) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                  },
                },
              },
            },
            messages: {
              where: {
                parentId: null, // Root messages only for last preview
                ...(isClient ? { isInternalOnly: false } : {}),
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    const results = await Promise.all(
      memberships.map(async (m) => {
        const conv = m.conversation;
        const lastMessage = conv.messages[0] || null;

        // Calculate unread count since member's lastReadAt
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: m.lastReadAt },
            senderId: { not: userId },
            ...(isClient ? { isInternalOnly: false } : {}),
          },
        });

        // Determine title and avatar for DIRECT chats
        let displayTitle = conv.title;
        let displayAvatar = conv.avatarUrl;
        let otherUser: any = null;

        if (conv.type === ChatConversationType.DIRECT) {
          const otherMember = conv.members.find((mem) => mem.userId !== userId);
          if (otherMember?.user) {
            otherUser = {
              ...otherMember.user,
              isOnline: this.gateway.isUserOnline(otherMember.user.id),
            };
            displayTitle =
              `${otherMember.user.firstName} ${otherMember.user.lastName}`.trim();
            displayAvatar = otherMember.user.avatarUrl;
          }
        }

        return {
          id: conv.id,
          type: conv.type,
          title: displayTitle || 'Conversation',
          description: conv.description,
          avatarUrl: displayAvatar,
          isPrivate: conv.isPrivate,
          entityType: conv.entityType,
          entityId: conv.entityId,
          lastMessage,
          unreadCount,
          lastReadAt: m.lastReadAt,
          isMuted: m.isMuted,
          role: m.role,
          otherUser,
          memberCount: conv.members.length,
          updatedAt: conv.updatedAt,
        };
      }),
    );

    return results;
  }

  /**
   * Get or create a 1-on-1 direct conversation between two users
   */
  async getOrCreateDirectConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot start direct chat with yourself');
    }

    // Verify target exists
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    if (!target) {
      throw new NotFoundException('Target user not found');
    }

    // Find existing DIRECT conversation shared by both users
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        type: ChatConversationType.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    const conversation = await this.prisma.chatConversation.create({
      data: {
        type: ChatConversationType.DIRECT,
        isPrivate: true,
        createdById: userId,
        members: {
          create: [
            { userId, role: ChatMemberRole.OWNER },
            { userId: targetUserId, role: ChatMemberRole.MEMBER },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  /**
   * Create a channel, group, or project collaboration room
   */
  async createChannelOrGroup(createdById: string, dto: CreateConversationDto) {
    const type = dto.type || ChatConversationType.GROUP;
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException('Conversation title is required');
    }

    const uniqueMemberIds = Array.from(
      new Set([createdById, ...(dto.memberIds || [])]),
    );

    const conversation = await this.prisma.chatConversation.create({
      data: {
        type,
        title,
        description: dto.description || null,
        isPrivate: dto.isPrivate || false,
        entityType: dto.entityType || null,
        entityId: dto.entityId || null,
        createdById,
        members: {
          create: uniqueMemberIds.map((uid) => ({
            userId: uid,
            role:
              uid === createdById
                ? ChatMemberRole.OWNER
                : ChatMemberRole.MEMBER,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Notify connected members
    for (const uid of uniqueMemberIds) {
      this.gateway.broadcastToUser(uid, 'conversation_created', conversation);
    }

    return conversation;
  }

  /**
   * Get messages inside a conversation with threading and DLP safety
   */
  async getMessages(
    userId: string,
    conversationId: string,
    options: {
      cursor?: string;
      limit?: number;
      parentId?: string;
      isClient?: boolean;
    } = {},
  ) {
    // Check membership
    const member = await this.prisma.chatMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!member) {
      // Check if conversation is public channel
      const conv = await this.prisma.chatConversation.findUnique({
        where: { id: conversationId },
      });
      if (!conv || conv.isPrivate) {
        throw new ForbiddenException('Not a member of this conversation');
      }
      // Auto-join public channel
      await this.prisma.chatMember.create({
        data: {
          conversationId,
          userId,
          role: ChatMemberRole.MEMBER,
        },
      });
    }

    const limit = Math.min(options.limit || 50, 100);

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        parentId: options.parentId || null,
        isDeleted: false,
        ...(options.isClient ? { isInternalOnly: false } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return messages;
  }

  /**
   * Post a new message, applying Guardian DLP sanitization, persistence, and real-time broadcast
   */
  async postMessage(
    senderId: string,
    conversationId: string,
    dto: CreateMessageDto,
    isClient: boolean = false,
  ) {
    if (
      !dto.content &&
      dto.type !== ChatMessageType.ATTACHMENT &&
      !dto.metadata
    ) {
      throw new BadRequestException('Message content cannot be empty');
    }

    // Membership check
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: senderId },
      },
      include: {
        conversation: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    // Guardian DLP Scan
    const scan = this.dlpService.sanitize(dto.content || '');

    // Threading check
    if (dto.parentId) {
      const parent = await this.prisma.chatMessage.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.conversationId !== conversationId) {
        throw new BadRequestException('Invalid parent thread message');
      }
    }

    // Persist message
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId,
        parentId: dto.parentId || null,
        type: dto.type || ChatMessageType.TEXT,
        content: scan.sanitizedContent,
        hasRedactedData: scan.hasRedactedData,
        isInternalOnly: isClient ? false : !!dto.isInternalOnly,
        metadata: dto.metadata || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true,
          },
        },
        reactions: true,
      },
    });

    // Update conversation timestamp & parent reply count
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    if (dto.parentId) {
      await this.prisma.chatMessage.update({
        where: { id: dto.parentId },
        data: { replyCount: { increment: 1 } },
      });
    }

    // Mark as read for sender
    await this.prisma.chatMember.update({
      where: {
        conversationId_userId: { conversationId, userId: senderId },
      },
      data: { lastReadAt: new Date() },
    });

    // Real-time broadcast
    this.gateway.broadcastToRoom(conversationId, 'new_message', message);

    // Send Web Push notifications to offline members
    this.sendPushToOfflineMembers(conversationId, senderId, message).catch(
      (err) =>
        this.logger.error(`Error sending push notification: ${err.message}`),
    );

    return message;
  }

  /**
   * Add or toggle emoji reaction on a message
   */
  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const existing = await this.prisma.chatMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji },
      },
    });

    if (existing) {
      await this.prisma.chatMessageReaction.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.chatMessageReaction.create({
        data: { messageId, userId, emoji },
      });
    }

    const allReactions = await this.prisma.chatMessageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.gateway.broadcastToRoom(message.conversationId, 'reaction_updated', {
      messageId,
      reactions: allReactions,
    });

    return allReactions;
  }

  /**
   * Mark all unread messages in conversation as read
   */
  async markAsRead(userId: string, conversationId: string) {
    await this.prisma.chatMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });

    this.gateway.broadcastToRoom(conversationId, 'messages_read', {
      conversationId,
      userId,
      readAt: new Date(),
    });

    return { success: true };
  }

  /**
   * Unified Work Graph: Create a task directly from a chat message/thread
   */
  async createTaskFromMessage(
    userId: string,
    messageId: string,
    taskData: {
      title: string;
      description?: string;
      priority?: string;
      assigneeId?: string;
      dueDate?: string;
      projectId?: string;
    },
  ) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) {
      throw new NotFoundException('Origin message not found');
    }

    // Determine target project
    let projectId = taskData.projectId;
    if (!projectId && message.conversation.entityType === 'PROJECT') {
      projectId = message.conversation.entityId || undefined;
    }

    if (!projectId) {
      // Find default active project
      const firstProject = await this.prisma.project.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      projectId = firstProject?.id;
    }

    if (!projectId) {
      throw new BadRequestException('Project ID is required to create a task');
    }

    // Fetch project info
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, key: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Get next task number
    const counter = await this.prisma.projectTaskCounter.upsert({
      where: { projectId },
      update: { lastNumber: { increment: 1 } },
      create: { projectId, lastNumber: 1 },
    });

    const taskCode = `${project.key || 'TASK'}-${counter.lastNumber}`;

    // Create the task
    const task = await this.prisma.task.create({
      data: {
        title: taskData.title,
        description:
          taskData.description ||
          `Created from chat message: "${message.content.slice(0, 100)}"`,
        projectId,
        taskCode,
        status: 'TODO',
        priority: (taskData.priority as any) || 'MEDIUM',
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        assignments: taskData.assigneeId
          ? {
              create: {
                userId: taskData.assigneeId,
              },
            }
          : undefined,
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    // Post interactive Task Card message in conversation
    const cardMessage = await this.postMessage(userId, message.conversationId, {
      content: `📋 Created Task ${task.taskCode}: ${task.title}`,
      type: ChatMessageType.TASK_CARD,
      parentId: message.parentId || message.id,
      metadata: {
        taskId: task.id,
        taskCode: task.taskCode,
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectName: project.name,
        projectKey: project.key,
        dueDate: task.dueDate,
        assigneeName: task.assignments[0]
          ? `${task.assignments[0].user.firstName} ${task.assignments[0].user.lastName}`
          : 'Unassigned',
      },
    });

    return { task, cardMessage };
  }

  /**
   * Helper: Dispatch web push to offline members of a conversation
   */
  private async sendPushToOfflineMembers(
    conversationId: string,
    senderId: string,
    message: any,
  ) {
    if (!this.webPushService || !this.webPushService.enabled) return;

    const members = await this.prisma.chatMember.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
        isMuted: false,
      },
    });

    const senderName =
      `${message.sender.firstName} ${message.sender.lastName}`.trim();
    const body =
      message.type === ChatMessageType.VOICE_NOTE
        ? '🎤 Sent a voice message'
        : message.type === ChatMessageType.ATTACHMENT
          ? '📎 Sent an attachment'
          : message.content.slice(0, 100);

    for (const mem of members) {
      // Only push if user has no active WebSocket connection
      if (!this.gateway.isUserOnline(mem.userId)) {
        try {
          await this.webPushService.sendToUser(mem.userId, {
            title: senderName,
            body,
            url: `/chat?conv=${conversationId}`,
          });
        } catch (e) {
          // ignore error for single user
        }
      }
    }
  }

  /**
   * List all employees available for starting chats
   */
  async listEmployeesForChat(currentUserId: string, search?: string) {
    const where: any = {
      isActive: true,
      id: { not: currentUserId },
    };

    if (search && search.trim()) {
      where.OR = [
        { firstName: { contains: search.trim(), mode: 'insensitive' } },
        { lastName: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 50,
    });

    return users.map((u) => ({
      ...u,
      isOnline: this.gateway.isUserOnline(u.id),
    }));
  }
}
