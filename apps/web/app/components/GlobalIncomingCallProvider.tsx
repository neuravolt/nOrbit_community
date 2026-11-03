"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/src/store/auth';
import { IncomingCallModal } from '../chat/components/IncomingCallModal';

interface IncomingCallData {
  callId: string;
  conversationId: string;
  callerUserId: string;
  callerName: string;
  callerAvatar?: string;
  isGroup?: boolean;
  roomUrl?: string;
}

interface GlobalCallContextType {
  incomingCall: IncomingCallData | null;
  initiateGlobalCall: (callData: any) => void;
  acceptGlobalCall: () => void;
  declineGlobalCall: () => void;
}

const GlobalCallContext = createContext<GlobalCallContextType>({
  incomingCall: null,
  initiateGlobalCall: () => {},
  acceptGlobalCall: () => {},
  declineGlobalCall: () => {},
});

export const useGlobalCall = () => useContext(GlobalCallContext);

export const getDeviceId = () => {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('nv_device_id');
  if (!id) {
    id = `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    sessionStorage.setItem('nv_device_id', id);
  }
  return id;
};

export function GlobalIncomingCallProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || user?.userType === 'CUSTOMER') return;

    let isUnmounted = false;
    let reconnectTimeout: any = null;
    let pingInterval: any = null;

    const connect = () => {
      if (isUnmounted) return;

      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const protocol = isHttps ? 'wss:' : 'ws:';
      const host =
        typeof window !== 'undefined' && window.location.port === '3000'
          ? `${window.location.hostname}:3001`
          : typeof window !== 'undefined'
          ? window.location.host
          : 'teams.neuravolt.in';

      const wsUrl = `${protocol}//${host}/api/chat?token=${accessToken}`;

      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          // Keepalive ping every 20s
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'ping', data: {} }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          try {
            const { event: ev, data } = JSON.parse(event.data);
            if (ev === 'incoming_call') {
              // 1. Caller must NEVER receive an incoming call prompt from themselves!
              if (data?.callerUserId === user?.id) {
                return;
              }
              const currentDev = getDeviceId();
              // 2. Don't show incoming call popup on the exact device/tab that placed the call!
              if (data?.originDeviceId && data?.originDeviceId === currentDev) {
                return;
              }
              setIncomingCall(data);

              // Native Web Notification if allowed
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`📞 Incoming Call: ${data.callerName || 'Colleague'}`, {
                    body: data.isGroup ? 'Group voice meeting in progress' : 'Incoming direct audio call',
                    icon: '/norbit-icon.png',
                    tag: `call-${data.callId}`,
                  });
                } catch (e) {
                  // ignore
                }
              }
            } else if (ev === 'call_ended') {
              setIncomingCall((prev) => (prev?.callId === data?.callId ? null : prev));
            }
          } catch (e) {
            // ignore
          }
        };

        ws.onclose = () => {
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

    // Request notification permission smoothly
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      isUnmounted = true;
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [accessToken, isAuthenticated, user?.id]);

  const initiateGlobalCall = (callData: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'call_initiate',
          data: { ...callData, originDeviceId: getDeviceId() },
        })
      );
    }
  };

  const acceptGlobalCall = () => {
    if (!incomingCall) return;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'call_accept',
          data: {
            callId: incomingCall.callId,
            conversationId: incomingCall.conversationId,
            callerUserId: incomingCall.callerUserId,
          },
        })
      );
    }

    const targetUrl = incomingCall.roomUrl || `/meet/room/${incomingCall.callId}`;
    setIncomingCall(null);
    router.push(targetUrl);
  };

  const declineGlobalCall = () => {
    if (!incomingCall) return;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'call_end',
          data: {
            callId: incomingCall.callId,
            conversationId: incomingCall.conversationId,
            callerUserId: incomingCall.callerUserId,
          },
        })
      );
    }

    setIncomingCall(null);
  };

  return (
    <GlobalCallContext.Provider
      value={{
        incomingCall,
        initiateGlobalCall,
        acceptGlobalCall,
        declineGlobalCall,
      }}
    >
      {children}

      {/* Global incoming call alert visible anywhere in the app */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={acceptGlobalCall}
        onDecline={declineGlobalCall}
      />
    </GlobalCallContext.Provider>
  );
}
