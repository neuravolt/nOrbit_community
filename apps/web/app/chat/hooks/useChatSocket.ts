"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/src/store/auth';

export interface ChatSocketOptions {
  onNewMessage?: (message: any) => void;
  onReactionUpdated?: (data: { messageId: string; reactions: any[] }) => void;
  onTyping?: (data: { conversationId: string; userId: string; name: string; isTyping: boolean }) => void;
  onPresenceChange?: (data: { userId: string; isOnline: boolean }) => void;
  onConversationCreated?: (conversation: any) => void;
  onIncomingCall?: (callData: any) => void;
  onCallAccepted?: (callData: any) => void;
  onCallEnded?: (callData: any) => void;
  onCallParticipantJoined?: (callData: any) => void;
}

export function useChatSocket(options: ChatSocketOptions = {}) {
  const { accessToken, isAuthenticated } = useAuthStore();
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    let isUnmounted = false;
    let reconnectTimeout: any = null;
    let pingInterval: any = null;

    const connect = () => {
      if (isUnmounted) return;

      const isHttps = window.location.protocol === 'https:';
      const protocol = isHttps ? 'wss:' : 'ws:';
      // In local dev with web on port 3000, API runs on port 3001
      const host =
        window.location.port === '3000'
          ? `${window.location.hostname}:3001`
          : window.location.host;

      const wsUrl = `${protocol}//${host}/api/chat?token=${accessToken}`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsConnected(true);

          // Heartbeat ping
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'ping', data: {} }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const { event: ev, data } = JSON.parse(event.data);
            switch (ev) {
              case 'connected':
                if (data?.onlineUserIds) {
                  setOnlineUserIds(new Set(data.onlineUserIds));
                }
                break;
              case 'new_message':
                optionsRef.current.onNewMessage?.(data);
                break;
              case 'reaction_updated':
                optionsRef.current.onReactionUpdated?.(data);
                break;
              case 'user_typing':
                optionsRef.current.onTyping?.({ ...data, isTyping: true });
                break;
              case 'user_stopped_typing':
                optionsRef.current.onTyping?.({ ...data, isTyping: false });
                break;
              case 'user_online':
                setOnlineUserIds((prev) => new Set([...prev, data.userId]));
                optionsRef.current.onPresenceChange?.({ userId: data.userId, isOnline: true });
                break;
              case 'user_offline':
                setOnlineUserIds((prev) => {
                  const next = new Set(prev);
                  next.delete(data.userId);
                  return next;
                });
                optionsRef.current.onPresenceChange?.({ userId: data.userId, isOnline: false });
                break;
              case 'conversation_created':
                optionsRef.current.onConversationCreated?.(data);
                break;
              case 'incoming_call':
                optionsRef.current.onIncomingCall?.(data);
                break;
              case 'call_accepted':
                optionsRef.current.onCallAccepted?.(data);
                break;
              case 'call_ended':
                optionsRef.current.onCallEnded?.(data);
                break;
              case 'call_participant_joined':
                optionsRef.current.onCallParticipantJoined?.(data);
                break;
            }
          } catch (e) {
            // ignore non-json
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          clearInterval(pingInterval);
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [accessToken, isAuthenticated]);

  const joinConversation = useCallback((conversationId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ event: 'join_conversation', data: { conversationId } })
      );
    }
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ event: 'leave_conversation', data: { conversationId } })
      );
    }
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: isTyping ? 'typing_start' : 'typing_stop',
          data: { conversationId },
        })
      );
    }
  }, []);

  const initiateCall = useCallback((callData: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ event: 'call_initiate', data: callData })
      );
    }
  }, []);

  const acceptCall = useCallback((callData: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ event: 'call_accept', data: callData })
      );
    }
  }, []);

  const endCall = useCallback((callData: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ event: 'call_end', data: callData })
      );
    }
  }, []);

  return {
    isConnected,
    onlineUserIds,
    joinConversation,
    leaveConversation,
    sendTyping,
    initiateCall,
    acceptCall,
    endCall,
  };
}
