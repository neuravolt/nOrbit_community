"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/store/auth';
import { useChatSocket } from './hooks/useChatSocket';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatArea } from './components/ChatArea';
import { ThreadView } from './components/ThreadView';
import { ProjectHubDrawer } from './components/ProjectHubDrawer';
import { NewConversationModal } from './components/NewConversationModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { AudioCallModal } from './components/AudioCallModal';
import { MessageSquare, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDeviceId } from '../components/GlobalIncomingCallProvider';

export default function NeuraChatPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Panels
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState<any | null>(null);
  const [isProjectHubOpen, setIsProjectHubOpen] = useState(false);
  const [activeTaskMessage, setActiveTaskMessage] = useState<any | null>(null);

  // Calling States: Incoming call ringing, Active call session, and Live channel room map
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<any | null>(null);
  const [activeRoomsMap, setActiveRoomsMap] = useState<Record<string, string>>({});

  // Real-time typing indicators per conversation: { [conversationId]: string[] }
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({});

  // Real-time socket integration
  const handleNewMessage = useCallback(
    (message: any) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === message.conversationId) {
            return {
              ...c,
              lastMessage: message,
              updatedAt: new Date().toISOString(),
              unreadCount:
                c.id === activeConversationId
                  ? 0
                  : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    },
    [activeConversationId]
  );

  const handleTypingEvent = useCallback(
    (data: { conversationId: string; userId: string; name: string; isTyping: boolean }) => {
      if (data.userId === user?.id) return;

      setTypingMap((prev) => {
        const currentList = prev[data.conversationId] || [];
        if (data.isTyping) {
          if (!currentList.includes(data.name)) {
            return { ...prev, [data.conversationId]: [...currentList, data.name] };
          }
        } else {
          return {
            ...prev,
            [data.conversationId]: currentList.filter((n) => n !== data.name),
          };
        }
        return prev;
      });
    },
    [user?.id]
  );

  const handleConversationCreated = useCallback((newConv: any) => {
    setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
    setActiveConversationId(newConv.id);
  }, []);

  const {
    isConnected,
    onlineUserIds,
    joinConversation,
    leaveConversation,
    sendTyping,
    initiateCall,
    acceptCall,
    endCall,
  } = useChatSocket({
    onNewMessage: handleNewMessage,
    onTyping: handleTypingEvent,
    onConversationCreated: handleConversationCreated,
    onIncomingCall: (callData) => {
      // 1. Caller must NEVER receive incoming call prompt from themselves!
      if (callData?.callerUserId === user?.id) {
        return;
      }
      const devId = getDeviceId();
      if (callData?.originDeviceId && callData.originDeviceId === devId) {
        return;
      }
      if (callData.conversationId && callData.roomUrl) {
        setActiveRoomsMap((prev) => ({ ...prev, [callData.conversationId]: callData.roomUrl }));
      }
    },
    onCallAccepted: (callData) => {
      setActiveCallSession((prev: any) => {
        if (prev?.roomUrl) {
          router.push(prev.roomUrl);
        }
        return prev ? { ...prev, isAccepted: true } : prev;
      });
    },
    onCallEnded: (callData) => {
      setActiveCallSession((prev: any) => (prev?.callId === callData?.callId ? null : prev));
      if (callData?.conversationId) {
        setActiveRoomsMap((prev) => {
          const next = { ...prev };
          delete next[callData.conversationId];
          return next;
        });
      }
    },
  });

  // Fetch initial conversations
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/chat/conversations');
      const list = res.data || [];
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          setActiveConversationId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  const handleSelectConversation = (id: string) => {
    if (activeConversationId) {
      leaveConversation(activeConversationId);
    }
    setActiveConversationId(id);
    joinConversation(id);
    setActiveThreadMessage(null);

    // Reset unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await api.post(`/chat/messages/${messageId}/reaction`, { emoji });
    } catch (e) {
      console.error('Failed to toggle reaction:', e);
    }
  };

  const handleTaskCreated = () => {
    // Optionally refresh
  };

  // ─── Call Management Handlers ──────────────────────────────────────────────
  const handleStartAudioCall = () => {
    if (!activeConversation) return;

    const callId = `nv-call-${Math.random().toString(36).substring(2, 7)}-${Date.now().toString(36)}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://teams.neuravolt.in';
    const roomUrl = `${origin}/meet/room/${callId}`;
    const isGroup = activeConversation.type !== 'DIRECT';
    const targetUserId =
      activeConversation.type === 'DIRECT'
        ? activeConversation.otherUser?.id ||
          activeConversation.members?.find((m: any) => m.userId !== user?.id)?.userId
        : undefined;

    const devId = getDeviceId();

    const callData = {
      callId,
      conversationId: activeConversation.id,
      targetUserId,
      callerUserId: user?.id,
      callerName: `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
      callerAvatar: (user as any)?.avatarUrl,
      isGroup,
      roomUrl,
      originDeviceId: devId,
    };

    initiateCall(callData);

    setActiveCallSession({
      ...callData,
      conversation: activeConversation,
      isCaller: true,
      isAccepted: false,
    });

    setActiveRoomsMap((prev) => ({ ...prev, [activeConversation.id]: roomUrl }));
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;

    acceptCall({
      callId: incomingCall.callId,
      conversationId: incomingCall.conversationId,
      callerUserId: incomingCall.callerUserId,
    });

    const targetUrl = incomingCall.roomUrl || `/meet/room/${incomingCall.callId}`;
    setIncomingCall(null);
    router.push(targetUrl);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;

    endCall({
      callId: incomingCall.callId,
      conversationId: incomingCall.conversationId,
      callerUserId: incomingCall.callerUserId,
    });

    api
      .post(`/chat/conversations/${incomingCall.conversationId}/messages`, {
        content: `📞 **Missed voice call**`,
        type: 'CALL_LOG',
        metadata: {
          isCall: true,
          isMissed: true,
          durationSec: 0,
        },
      })
      .catch(() => {});

    setIncomingCall(null);
  };

  const handleHangupActiveCall = (durationSec: number) => {
    if (activeCallSession) {
      endCall({
        callId: activeCallSession.callId,
        conversationId: activeCallSession.conversationId,
        targetUserId: activeCallSession.targetUserId,
        callerUserId: activeCallSession.callerUserId,
      });

      const isMissed = durationSec === 0;
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      api
        .post(`/chat/conversations/${activeCallSession.conversationId}/messages`, {
          content: isMissed ? `📞 **Missed voice call**` : `📞 **Audio Call Ended** (Duration: ${formatted})`,
          type: 'CALL_LOG',
          metadata: {
            isCall: true,
            isMissed,
            durationSec,
            formattedDuration: formatted,
          },
        })
        .catch(() => {});
    }

    setActiveCallSession(null);
  };

  const handleJoinActiveCall = (convId: string) => {
    const roomUrl = activeRoomsMap[convId];
    const targetConv = conversations.find((c) => c.id === convId);

    setActiveCallSession({
      callId: `join-${convId}`,
      conversationId: convId,
      conversation: targetConv,
      roomUrl,
      isCaller: false,
      isAccepted: true,
    });
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-slate-500">
        Please sign in to access NeuraChat.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 select-none relative">
      {/* Left Sidebar: Conversations & Channels */}
      <div
        className={`${
          activeConversationId ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-84 h-full shrink-0 flex-col bg-white border-r border-slate-200`}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenNewModal={() => setIsNewModalOpen(true)}
          onlineUserIds={onlineUserIds}
        />
      </div>

      {/* Center: Main Chat Feed & Composer */}
      <div
        className={`${
          activeConversationId ? 'flex' : 'hidden md:flex'
        } flex-1 h-full min-w-0 flex-col bg-white`}
      >
        {activeConversation ? (
          <ChatArea
            key={activeConversation.id}
            conversation={activeConversation}
            currentUserId={user.id}
            onlineUserIds={onlineUserIds}
            onOpenThread={(msg) => setActiveThreadMessage(msg)}
            onToggleReaction={handleToggleReaction}
            onCreateTask={(msg) => setActiveTaskMessage(msg)}
            typingUsers={typingMap[activeConversation.id] || []}
            onTyping={(isTyping) => sendTyping(activeConversation.id, isTyping)}
            onStartAudioCall={handleStartAudioCall}
            activeCallRoomUrl={activeConversation ? activeRoomsMap[activeConversation.id] : null}
            onJoinActiveCall={() => activeConversation && handleJoinActiveCall(activeConversation.id)}
            onBack={() => setActiveConversationId(null)}
            isProjectHubOpen={isProjectHubOpen}
            onToggleProjectHub={() => {
              setIsProjectHubOpen(!isProjectHubOpen);
              setActiveThreadMessage(null);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-white">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Loading NeuraChat workspace...</span>
              </div>
            ) : (
              <div className="text-center max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Welcome to NeuraChat</h3>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  Enterprise collaboration with interactive task cards, Norbit AI co-pilot, and Guardian DLP protection.
                </p>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Start a New Discussion
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Drawer: Thread View */}
      {activeThreadMessage && activeConversation && (
        <ThreadView
          parentMessage={activeThreadMessage}
          conversationId={activeConversation.id}
          currentUserId={user.id}
          onClose={() => setActiveThreadMessage(null)}
          onToggleReaction={handleToggleReaction}
          onCreateTask={(msg) => setActiveTaskMessage(msg)}
        />
      )}

      {/* Right Drawer: Project Hub (Tasks, Files, Team) */}
      {isProjectHubOpen && activeConversation && (
        <ProjectHubDrawer
          isOpen={isProjectHubOpen}
          onClose={() => setIsProjectHubOpen(false)}
          conversation={activeConversation}
          currentUserId={user.id}
          onlineUserIds={onlineUserIds}
          onOpenCreateTask={() => {
            setActiveTaskMessage({
              id: `direct-proj-${Date.now()}`,
              content: `Sprint task for ${activeConversation.title}`,
              sender: user,
            });
          }}
          onStartDirectChat={(otherUserId) => {
            const direct = conversations.find(
              (c) => c.type === 'DIRECT' && c.members?.some((m: any) => m.userId === otherUserId)
            );
            if (direct) {
              setActiveConversationId(direct.id);
            }
          }}
        />
      )}

      {/* New Message / Channel Modal */}
      <NewConversationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onConversationCreated={handleConversationCreated}
        onlineUserIds={onlineUserIds}
      />

      {/* Create Task from Message Modal */}
      <CreateTaskModal
        isOpen={!!activeTaskMessage}
        message={activeTaskMessage}
        onClose={() => setActiveTaskMessage(null)}
        onTaskCreated={handleTaskCreated}
      />

      {/* Active Two-Way Audio Call Bridge */}
      {activeCallSession && (
        <AudioCallModal
          isOpen={!!activeCallSession}
          onClose={() => setActiveCallSession(null)}
          conversation={activeCallSession.conversation}
          currentUserName={user?.firstName}
          isCaller={activeCallSession.isCaller}
          isAccepted={activeCallSession.isAccepted}
          roomUrl={activeCallSession.roomUrl}
          onCallEnded={handleHangupActiveCall}
          onInviteMember={(targetUser) => {
            initiateCall({
              callId: activeCallSession.callId,
              conversationId: activeCallSession.conversationId,
              targetUserId: targetUser.id,
              callerName: `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim(),
              callerAvatar: (user as any)?.avatarUrl,
              isGroup: true,
              roomUrl: activeCallSession.roomUrl,
            });
          }}
        />
      )}
    </div>
  );
}
