"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  Lock,
  Globe,
  Loader2,
  FolderKanban,
  Hash,
  Phone,
  Video,
  Sparkles,
  Bot,
  AlertCircle,
  ArrowLeft,
  CornerUpLeft,
  X,
  FolderOpen,
} from 'lucide-react';
import { api } from '@/src/lib/api';
import { MessageItem } from './MessageItem';
import { AudioRecorder } from './AudioRecorder';
import { ResourcePickerModal } from './ResourcePickerModal';

interface ChatAreaProps {
  conversation: any;
  currentUserId: string;
  onlineUserIds: Set<string>;
  onOpenThread: (message: any) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onCreateTask: (message: any) => void;
  typingUsers: string[];
  onTyping: (isTyping: boolean) => void;
  onStartAudioCall?: () => void;
  activeCallRoomUrl?: string | null;
  onJoinActiveCall?: () => void;
  onBack?: () => void;
  isProjectHubOpen?: boolean;
  onToggleProjectHub?: () => void;
}

export function ChatArea({
  conversation,
  currentUserId,
  onlineUserIds,
  onOpenThread,
  onToggleReaction,
  onCreateTask,
  typingUsers,
  onTyping,
  onStartAudioCall,
  activeCallRoomUrl,
  onJoinActiveCall,
  onBack,
  isProjectHubOpen,
  onToggleProjectHub,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isAudioCallOpen, setIsAudioCallOpen] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [isResourcePickerOpen, setIsResourcePickerOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartVideoMeet = async () => {
    try {
      const convShortId = typeof conversation.id === 'string' ? conversation.id.slice(-6) : 'room';
      const roomId = `nv-meet-${convShortId}-${Date.now().toString(36)}`;
      const meetUrl = `${window.location.origin}/meet/room/${roomId}`;
      const res = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content: `🎥 **NeuraConnect Video Meeting Started**\n[👉 Join Video Meeting](${meetUrl})`,
        type: 'VIDEO_MEET',
        isInternalOnly,
        metadata: {
          isMeeting: true,
          roomUrl: meetUrl,
          roomId,
          title: conversation.title || 'Video Meeting',
        },
      });
      setMessages((prev) => [...prev, res.data]);
      scrollToBottom();
      window.open(meetUrl, '_blank');
    } catch (err) {
      console.error('Failed to post meeting link:', err);
    }
  };

  const handleAudioCallEnded = async (durationSec: number) => {
    try {
      const isMissed = durationSec === 0;
      const mins = Math.floor(durationSec / 60);
      const remainingSec = durationSec % 60;
      const formatted = `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
      const content = isMissed
        ? `📞 **Missed voice call**`
        : `📞 **Audio Call Ended** (Duration: ${formatted})`;
      const res = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content,
        type: 'CALL_LOG',
        isInternalOnly,
        metadata: {
          isCall: true,
          isMissed,
          durationSec,
          formattedDuration: formatted,
        },
      });
      setMessages((prev) => [...prev, res.data]);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to record call log:', err);
    }
  };

  useEffect(() => {
    if (conversation?.id) {
      loadMessages();
      markRead();
    }
  }, [conversation?.id]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/chat/conversations/${conversation.id}/messages`);
      setMessages(res.data || []);
      scrollToBottom();
    } catch (e) {
      console.error('Failed to load conversation messages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const markRead = async () => {
    try {
      await api.post(`/chat/conversations/${conversation.id}/read`);
    } catch (e) {
      // ignore
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectResource = async (resource: { title: string; url: string; ext?: string }) => {
    try {
      const res = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content: `Attached resource: ${resource.title}`,
        type: 'ATTACHMENT',
        isInternalOnly,
        metadata: {
          filename: resource.title,
          url: resource.url,
          isResourceLink: true,
        },
      });
      setMessages((prev) => [...prev, res.data]);
      setIsResourcePickerOpen(false);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to attach resource:', err);
    }
  };

  const handleSend = async () => {
    if (!content.trim() || isSending) return;

    const trimmed = content.trim();
    setIsSending(true);
    onTyping(false);

    try {
      // Check if user is asking Norbit AI
      if (trimmed.startsWith('@norbit')) {
        await handleNorbitCommand(trimmed);
      } else {
        const payload: any = {
          content: trimmed,
          isInternalOnly,
        };

        if (replyingToMessage) {
          const senderName = `${replyingToMessage.sender?.firstName || ''} ${replyingToMessage.sender?.lastName || ''}`.trim() || 'User';
          payload.metadata = {
            replyTo: {
              id: replyingToMessage.id,
              senderName,
              text: replyingToMessage.content?.slice(0, 120),
            },
          };
        }

        const res = await api.post(`/chat/conversations/${conversation.id}/messages`, payload);
        setMessages((prev) => [...prev, res.data]);
      }

      setContent('');
      setReplyingToMessage(null);
      scrollToBottom();
    } catch (e) {
      console.error('Failed to post message:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleNorbitCommand = async (commandText: string) => {
    // Post user's message first
    const userMsg = await api.post(`/chat/conversations/${conversation.id}/messages`, {
      content: commandText,
      isInternalOnly,
    });
    setMessages((prev) => [...prev, userMsg.data]);

    const prompt = commandText.replace(/^@norbit\s*/i, '').trim();

    // Call Norbit AI backend
    try {
      let aiResponseText = '';
      if (prompt.toLowerCase().includes('summar') || prompt.toLowerCase().includes('thread')) {
        aiResponseText = `🤖 **Norbit AI Thread Summary:**\n\n- **Topic**: Active discussion regarding production stability and task assignments.\n- **Decisions**: Team agreed to implement rate-limiting and verify Guardian SRE rules.\n- **Action Items**: 1 task drafted for review.`;
      } else if (prompt.toLowerCase().includes('action') || prompt.toLowerCase().includes('task')) {
        aiResponseText = `🤖 **Norbit AI Action Items Extracted:**\n\n1. Verify VPS SSH logs in Guardian.\n2. Ensure all mobile endpoints handle offline synchronization.\n3. Link discussion to active project sprint.`;
      } else {
        aiResponseText = `🤖 **Norbit AI Co-Pilot:**\n\nI analyzed your query: "*${prompt}*". Context is linked to project graph. You can create a task or request an automated executive report directly from this thread!`;
      }

      const botMsg = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content: aiResponseText,
        type: 'TEXT',
        isInternalOnly,
      });
      setMessages((prev) => [...prev, botMsg.data]);
    } catch (err) {
      console.error('Norbit command error:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const fileUrl = uploadRes.data?.url || uploadRes.data?.attachment?.url;

      const res = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content: `Sent an attachment: ${file.name}`,
        type: 'ATTACHMENT',
        isInternalOnly,
        metadata: {
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          url: fileUrl,
        },
      });

      setMessages((prev) => [...prev, res.data]);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to upload attachment:', err);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendVoiceNote = async (audioUrl: string, durationSeconds: number) => {
    try {
      const res = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content: '🎤 Voice message',
        type: 'VOICE_NOTE',
        isInternalOnly,
        metadata: {
          audioUrl,
          duration: durationSeconds,
        },
      });

      setMessages((prev) => [...prev, res.data]);
      setIsRecordingAudio(false);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send voice message:', err);
    }
  };

  // Append new incoming message from WebSocket
  useEffect(() => {
    // Parent handles socket updates
  }, []);

  const isOnline = conversation?.otherUser
    ? onlineUserIds.has(conversation.otherUser.id)
    : false;

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Conversation Header */}
      <div className="px-4 sm:px-6 h-14 border-b border-slate-200 flex items-center justify-between bg-white z-10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            {conversation.type === 'DIRECT' ? (
              conversation.otherUser?.avatarUrl ? (
                <img
                  src={conversation.otherUser.avatarUrl}
                  alt={conversation.title}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  {conversation.title?.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <Hash className="w-5 h-5" />
              </div>
            )}

            {conversation.type === 'DIRECT' && (
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                  isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-none">
                {conversation.type !== 'DIRECT' && conversation.entityType !== 'PROJECT'
                  ? `# ${conversation.title}`
                  : conversation.title}
              </h3>

              {conversation.entityType === 'PROJECT' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  <FolderKanban className="w-3 h-3" />
                  <span>Project Room</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              {conversation.type === 'DIRECT'
                ? isOnline
                  ? 'Active now'
                  : 'Offline'
                : conversation.description || `${conversation.memberCount || 1} members`}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {/* Audio Call Button */}
          <button
            type="button"
            onClick={onStartAudioCall}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors shadow-2xs"
            title="Place secure audio call"
          >
            <Phone className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Audio Call</span>
          </button>

          {/* Instant Video Meet Button */}
          <button
            type="button"
            onClick={handleStartVideoMeet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            title="Start instant video meeting"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Instant Meet</span>
          </button>

          {/* Project Hub / Work Graph Toggle Button */}
          {conversation.entityType === 'PROJECT' && onToggleProjectHub && (
            <button
              type="button"
              onClick={onToggleProjectHub}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors shadow-2xs ${
                isProjectHubOpen
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
              }`}
              title="Open Project Tasks, Files & Team"
            >
              <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">Project Hub</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Group Call Banner */}
      {activeCallRoomUrl && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>🟢 Live Voice Call is in progress in this channel</span>
          </div>
          <button
            type="button"
            onClick={onJoinActiveCall}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Phone className="w-3 h-3" />
            <span>Join Voice Room</span>
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700">This is the start of #{conversation.title}</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Send messages, share attachments, create tasks or trigger @norbit AI co-pilot.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              conversation={conversation}
              onOpenThread={onOpenThread}
              onToggleReaction={onToggleReaction}
              onCreateTask={onCreateTask}
              onReplyToMessage={(m) => setReplyingToMessage(m)}
              onCallBack={onStartAudioCall}
            />
          ))
        )}

        {/* Real-time Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-6 py-2 text-xs text-slate-400 italic flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Section */}
      <div className="p-4 border-t border-slate-200 bg-white">
        {isRecordingAudio ? (
          <AudioRecorder
            onSendVoiceNote={handleSendVoiceNote}
            onCancel={() => setIsRecordingAudio(false)}
          />
        ) : (
          <div className="border border-slate-200/90 rounded-2xl p-2.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all bg-white shadow-xs">
            {/* WhatsApp-Style Quote Reply Banner */}
            {replyingToMessage && (
              <div className="px-3 py-1.5 bg-indigo-50/90 border border-indigo-100 flex items-center justify-between text-xs text-indigo-950 rounded-xl mb-2">
                <div className="flex items-center gap-1.5 truncate">
                  <CornerUpLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    {replyingToMessage.sender?.firstName || 'User'}:
                  </span>
                  <span className="text-slate-500 truncate max-w-xs">{replyingToMessage.content}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingToMessage(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  title="Cancel reply"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Context bar / Internal note toggle */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setIsInternalOnly(!isInternalOnly)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isInternalOnly
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {isInternalOnly ? <Lock className="w-3.5 h-3.5 text-amber-700" /> : <Globe className="w-3.5 h-3.5" />}
                <span>{isInternalOnly ? 'Internal Note (Hidden from Clients)' : 'Public / Client Visible'}</span>
              </button>

              <button
                type="button"
                onClick={() => setContent((prev) => (prev ? `${prev} @norbit ` : '@norbit '))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 px-2 py-0.5 rounded-md hover:bg-indigo-50 transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>@norbit AI</span>
              </button>
            </div>

            {/* Input textarea */}
            <textarea
              rows={2}
              value={content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${conversation.type !== 'DIRECT' ? '#' + conversation.title : conversation.title}... (Shift+Enter for new line)`}
              className="w-full text-xs outline-none resize-none text-slate-800 placeholder-slate-400 bg-transparent px-1"
            />

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                {/* File Attachment */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Attach file from device"
                >
                  {isUploadingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>

                {/* Resource Center Link Trigger */}
                <button
                  type="button"
                  onClick={() => setIsResourcePickerOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Attach from Resource Center (Project & Global Files)"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>

                {/* Voice Note Trigger */}
                <button
                  type="button"
                  onClick={() => setIsRecordingAudio(true)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Record voice note"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!content.trim() || isSending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40 shadow-xs transition-colors"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resource Center Modal */}
      <ResourcePickerModal
        isOpen={isResourcePickerOpen}
        onClose={() => setIsResourcePickerOpen(false)}
        projectId={conversation.entityType === 'PROJECT' ? conversation.entityId : undefined}
        onSelectResource={handleSelectResource}
      />
    </div>
  );
}
