import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getJwtSecret } from '@neuravolt/shared-utils';
import type { WebSocket } from 'ws';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WebPushService } from '../guardian/services/web-push.service';

interface ClientSession {
  ws: WebSocket;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  conversations: Set<string>;
}

@WebSocketGateway({
  path: '/api/chat',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: any;

  private readonly logger = new Logger(ChatGateway.name);

  // Map of raw socket -> session
  private clients = new Map<WebSocket, ClientSession>();

  // Map of userId -> Set of connected WebSockets (multi-tab / multi-device support)
  private userSockets = new Map<string, Set<WebSocket>>();

  // Map of conversationId -> Set of WebSockets
  private conversationRooms = new Map<string, Set<WebSocket>>();

  // Active in-flight calls: callId -> callPayload & timestamp (for instant delivery when recipient reconnects/opens app)
  private activeCalls = new Map<string, any>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly webPushService: WebPushService,
  ) {}

  async handleConnection(client: WebSocket, req?: any) {
    try {
      const url = new URL(req?.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      const isGuest =
        !token ||
        token === 'guest-access' ||
        token.startsWith('guest-') ||
        token.startsWith('guest_');

      if (isGuest) {
        const guestId =
          url.searchParams.get('guestId') ||
          `guest_${Math.random().toString(36).substring(2, 9)}`;
        const guestName =
          url.searchParams.get('guestName') || 'Guest Participant';

        const session: ClientSession = {
          ws: client,
          userId: guestId,
          email: `${guestId}@guest.neuraconnect`,
          firstName: guestName,
          lastName: '',
          role: 'GUEST',
          conversations: new Set(),
        };

        this.clients.set(client, session);

        if (!this.userSockets.has(guestId)) {
          this.userSockets.set(guestId, new Set());
        }
        this.userSockets.get(guestId)!.add(client);

        this.sendToClient(client, 'connected', {
          userId: guestId,
          userName: guestName,
          isGuest: true,
          conversations: [],
          onlineUserIds: [],
        });
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: getJwtSecret(),
      });

      const userId = payload.sub;
      if (!userId) {
        client.close(4001, 'Invalid token');
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        client.close(4003, 'User inactive or not found');
        return;
      }

      const session: ClientSession = {
        ws: client,
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        conversations: new Set(),
      };

      this.clients.set(client, session);

      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(client);

      // Notify others if user became online
      if (this.userSockets.get(user.id)!.size === 1) {
        this.broadcastPresence(user.id, true);
      }

      // Automatically join user's existing conversation rooms
      const memberships = await this.prisma.chatMember.findMany({
        where: { userId: user.id },
        select: { conversationId: true },
      });

      for (const m of memberships) {
        session.conversations.add(m.conversationId);
        if (!this.conversationRooms.has(m.conversationId)) {
          this.conversationRooms.set(m.conversationId, new Set());
        }
        this.conversationRooms.get(m.conversationId)!.add(client);
      }

      // Send connection acknowledgement
      this.sendToClient(client, 'connected', {
        userId: user.id,
        conversations: Array.from(session.conversations),
        onlineUserIds: Array.from(this.userSockets.keys()),
      });

      // Deliver active in-flight calls to this user (e.g. mobile Safari / app just opened)
      const now = Date.now();
      for (const [callId, call] of this.activeCalls) {
        if (now - call.initiatedAt > 60000) {
          this.activeCalls.delete(callId);
          continue;
        }
        if (call.callerUserId !== user.id) {
          if (
            call.targetUserId === user.id ||
            session.conversations.has(call.conversationId)
          ) {
            this.sendToClient(client, 'incoming_call', call);
          }
        }
      }

      // Handle raw messages if ws adapter passes them
      client.on('message', (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());
          this.handleIncomingClientMessage(client, parsed);
        } catch (e) {
          // ignore malformed ping/text
        }
      });
    } catch (err: any) {
      this.logger.warn(`Chat WebSocket auth failed: ${err.message}`);
      client.close(4001, 'Unauthorized');
    }
  }

  handleDisconnect(client: WebSocket) {
    const session = this.clients.get(client);
    if (!session) return;

    this.clients.delete(client);

    const userSockSet = this.userSockets.get(session.userId);
    if (userSockSet) {
      userSockSet.delete(client);
      if (userSockSet.size === 0) {
        this.userSockets.delete(session.userId);
        this.broadcastPresence(session.userId, false);
      }
    }

    for (const convId of session.conversations) {
      const room = this.conversationRooms.get(convId);
      if (room) {
        room.delete(client);
        if (room.size === 0) {
          this.conversationRooms.delete(convId);
        }
      }
    }
  }

  /**
   * Dispatches incoming WebSocket action from client
   */
  private handleIncomingClientMessage(client: WebSocket, payload: any) {
    const session = this.clients.get(client);
    if (!session) return;

    const { event, data } = payload;
    if (!event) return;

    switch (event) {
      case 'join_conversation':
        if (data?.conversationId) {
          session.conversations.add(data.conversationId);
          if (!this.conversationRooms.has(data.conversationId)) {
            this.conversationRooms.set(data.conversationId, new Set());
          }
          this.conversationRooms.get(data.conversationId)!.add(client);
        }
        break;

      case 'leave_conversation':
        if (data?.conversationId) {
          session.conversations.delete(data.conversationId);
          this.conversationRooms.get(data.conversationId)?.delete(client);
        }
        break;

      case 'typing_start':
      case 'typing_stop':
        if (data?.conversationId) {
          this.broadcastToRoom(
            data.conversationId,
            event === 'typing_start' ? 'user_typing' : 'user_stopped_typing',
            {
              conversationId: data.conversationId,
              userId: session.userId,
              name: `${session.firstName} ${session.lastName}`.trim(),
            },
            client,
          );
        }
        break;

      case 'call_initiate': {
        const callerName =
          data.callerName || `${session.firstName} ${session.lastName}`.trim();
        const callPayload = {
          ...data,
          callerUserId: session.userId,
          callerName,
          initiatedAt: Date.now(),
        };

        this.logger.log(
          `📞 [Call Initiate] caller=${session.email} (${session.userId}) target=${data?.targetUserId} conv=${data?.conversationId}`,
        );

        if (callPayload.callId) {
          this.activeCalls.set(callPayload.callId, callPayload);
          setTimeout(() => {
            if (this.activeCalls.has(callPayload.callId)) {
              this.activeCalls.delete(callPayload.callId);
            }
          }, 60000);
        }

        if (data?.targetUserId) {
          // Send to target user via WebSocket
          this.broadcastToUser(
            data.targetUserId,
            'incoming_call',
            callPayload,
            client,
          );

          // Dispatch Web Push notification (wakes up mobile device even when app is closed)
          this.webPushService
            .sendToUser(data.targetUserId, {
              title: `📞 Incoming Audio Call: ${callerName}`,
              body: `Incoming direct audio call from ${callerName}. Tap to answer.`,
              url: `/chat?callId=${callPayload.callId}`,
              tag: `call-${callPayload.callId}`,
            })
            .catch((err) => {
              this.logger.warn(
                `Failed to dispatch call web push: ${err.message}`,
              );
            });
        }

        if (data?.conversationId) {
          // Broadcast to all conversation members except the caller
          this.prisma.chatMember
            .findMany({
              where: { conversationId: data.conversationId },
              select: { userId: true },
            })
            .then((members) => {
              for (const m of members) {
                if (
                  m.userId !== session.userId &&
                  m.userId !== data?.targetUserId
                ) {
                  this.broadcastToUser(
                    m.userId,
                    'incoming_call',
                    callPayload,
                    client,
                  );
                  this.webPushService
                    .sendToUser(m.userId, {
                      title: `📞 Incoming Audio Call: ${callerName}`,
                      body: `Incoming audio call from ${callerName}. Tap to answer.`,
                      url: `/chat?callId=${callPayload.callId}`,
                      tag: `call-${callPayload.callId}`,
                    })
                    .catch(() => {});
                }
              }
            })
            .catch(() => {});

          // Also broadcast to active room participants, excluding ANY socket belonging to caller
          this.broadcastToRoom(
            data.conversationId,
            'incoming_call',
            callPayload,
            client,
            session.userId,
          );
        }
        break;
      }

      case 'call_accept':
        if (data?.callId) {
          this.activeCalls.delete(data.callId);
        }
        if (data?.callerUserId) {
          this.broadcastToUser(data.callerUserId, 'call_accepted', {
            ...data,
            acceptorUserId: session.userId,
            acceptorName: `${session.firstName} ${session.lastName}`.trim(),
          });
        }
        if (data?.conversationId) {
          this.broadcastToRoom(
            data.conversationId,
            'call_participant_joined',
            {
              ...data,
              userId: session.userId,
              name: `${session.firstName} ${session.lastName}`.trim(),
            },
            client,
          );
        }
        break;

      case 'call_reject':
      case 'call_end':
        if (data?.callId) {
          this.activeCalls.delete(data.callId);
        }
        if (data?.targetUserId) {
          this.broadcastToUser(data.targetUserId, 'call_ended', {
            ...data,
            endedByUserId: session.userId,
          });
        }
        if (data?.callerUserId) {
          this.broadcastToUser(data.callerUserId, 'call_ended', {
            ...data,
            endedByUserId: session.userId,
          });
        }
        if (data?.conversationId) {
          this.broadcastToRoom(
            data.conversationId,
            'call_ended',
            {
              ...data,
              endedByUserId: session.userId,
            },
            client,
          );
        }
        break;

      case 'join_room':
        if (data?.roomId) {
          session.conversations.add(data.roomId);
          if (!this.conversationRooms.has(data.roomId)) {
            this.conversationRooms.set(data.roomId, new Set());
          }
          const roomSockets = this.conversationRooms.get(data.roomId)!;

          // Collect existing peers already present in the room
          const existingPeers: Array<{ userId: string; userName: string }> = [];
          for (const ws of roomSockets) {
            if (ws !== client && ws.readyState === 1) {
              const s = this.clients.get(ws);
              if (s) {
                existingPeers.push({
                  userId: s.userId,
                  userName:
                    `${s.firstName} ${s.lastName}`.trim() || 'Participant',
                });
              }
            }
          }

          roomSockets.add(client);

          // Tell the joining client about existing peers so negotiation starts immediately
          if (existingPeers.length > 0) {
            this.sendToClient(client, 'room_peers', {
              roomId: data.roomId,
              peers: existingPeers,
            });
          }

          this.broadcastToRoom(
            data.roomId,
            'peer_joined',
            {
              roomId: data.roomId,
              userId: session.userId,
              userName:
                `${session.firstName} ${session.lastName}`.trim() ||
                'Participant',
            },
            client,
          );
        }
        break;

      case 'leave_room':
        if (data?.roomId) {
          session.conversations.delete(data.roomId);
          this.conversationRooms.get(data.roomId)?.delete(client);
          this.broadcastToRoom(
            data.roomId,
            'peer_left',
            {
              roomId: data.roomId,
              userId: session.userId,
            },
            client,
          );
        }
        break;

      case 'webrtc_signal':
        if (data?.targetUserId) {
          this.broadcastToUser(data.targetUserId, 'webrtc_signal', {
            ...data,
            senderUserId: session.userId,
            senderName: `${session.firstName} ${session.lastName}`.trim(),
          });
        } else if (data?.roomId) {
          this.broadcastToRoom(
            data.roomId,
            'webrtc_signal',
            {
              ...data,
              senderUserId: session.userId,
              senderName: `${session.firstName} ${session.lastName}`.trim(),
            },
            client,
          );
        }
        break;

      case 'ping':
        this.sendToClient(client, 'pong', { timestamp: Date.now() });
        break;
    }
  }

  // ─── Broadcast Helpers ────────────────────────────────────────────────────────

  broadcastToRoom(
    conversationId: string,
    event: string,
    data: any,
    excludeWs?: WebSocket,
    excludeUserId?: string,
  ) {
    const room = this.conversationRooms.get(conversationId);
    if (!room) return;

    const message = JSON.stringify({ event, data });
    for (const ws of room) {
      if (ws !== excludeWs && ws.readyState === 1 /* OPEN */) {
        if (excludeUserId) {
          const s = this.clients.get(ws);
          if (s?.userId === excludeUserId) continue;
        }
        try {
          ws.send(message);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  broadcastToUser(
    userId: string,
    event: string,
    data: any,
    excludeWs?: WebSocket,
  ) {
    const userSocks = this.userSockets.get(userId);
    if (!userSocks) return;

    const message = JSON.stringify({ event, data });
    for (const ws of userSocks) {
      if (ws !== excludeWs && ws.readyState === 1) {
        try {
          ws.send(message);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  broadcastPresence(userId: string, isOnline: boolean) {
    const message = JSON.stringify({
      event: isOnline ? 'user_online' : 'user_offline',
      data: { userId, isOnline },
    });

    for (const [ws] of this.clients) {
      if (ws.readyState === 1) {
        try {
          ws.send(message);
        } catch (e) {
          // ignore
        }
      }
    }
  }

  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size || 0) > 0;
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  private sendToClient(client: WebSocket, event: string, data: any) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ event, data }));
    }
  }
}
