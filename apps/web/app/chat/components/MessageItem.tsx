"use client";

import React, { useState } from 'react';
import {
  ShieldAlert,
  MessageSquare,
  Smile,
  CheckSquare,
  Copy,
  Check,
  FileText,
  Download,
  Lock,
  CheckCheck,
  CornerUpLeft,
  FolderPlus,
  PhoneMissed,
  PhoneCall,
  Phone,
  Video,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/src/lib/api';
import { TaskCard } from './TaskCard';

interface MessageItemProps {
  message: any;
  currentUserId: string;
  conversation?: any;
  onOpenThread: (message: any) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onCreateTask: (message: any) => void;
  onReplyToMessage?: (message: any) => void;
  onCallBack?: () => void;
}

export function MessageItem({
  message,
  currentUserId,
  conversation,
  onOpenThread,
  onToggleReaction,
  onCreateTask,
  onReplyToMessage,
  onCallBack,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSavedToResources, setIsSavedToResources] = useState(false);
  const [isSavingResource, setIsSavingResource] = useState(false);

  const isSelf = message.senderId === currentUserId;
  const senderName = `${message.sender?.firstName || ''} ${message.sender?.lastName || ''}`.trim() || 'User';
  const roleBadge = message.sender?.role;

  const quickEmojis = ['👍', '❤️', '🚀', '👀', '🎉'];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToResources = async (meta: any) => {
    if (isSavingResource || isSavedToResources) return;
    setIsSavingResource(true);
    try {
      await api.post('/upload/link', {
        url: meta.url,
        title: `[DOCS] ${meta.filename || 'Chat Attachment'}`,
        projectId: conversation?.entityType === 'PROJECT' ? conversation.entityId : undefined,
      });
      setIsSavedToResources(true);
      setTimeout(() => setIsSavedToResources(false), 3000);
    } catch (e) {
      console.error('Failed to save chat attachment to resources:', e);
    } finally {
      setIsSavingResource(false);
    }
  };

  // Group reactions by emoji
  const reactionCounts: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
  if (Array.isArray(message.reactions)) {
    for (const r of message.reactions) {
      if (!reactionCounts[r.emoji]) {
        reactionCounts[r.emoji] = { count: 0, users: [], hasReacted: false };
      }
      reactionCounts[r.emoji].count += 1;
      reactionCounts[r.emoji].users.push(r.user?.firstName || 'Someone');
      if (r.userId === currentUserId) {
        reactionCounts[r.emoji].hasReacted = true;
      }
    }
  }

  // Check if message is a voice call or missed call
  const isCallMessage =
    message.type === 'CALL_LOG' ||
    message.metadata?.isCall === true ||
    (typeof message.content === 'string' &&
      (message.content.includes('Audio Call Ended') ||
        message.content.includes('Audio call ended') ||
        message.content.includes('Missed voice call') ||
        message.content.includes('Missed call')));

  const isMissed =
    message.metadata?.isMissed === true ||
    (typeof message.content === 'string' &&
      (message.content.includes('00:00') ||
        message.content.toLowerCase().includes('missed')));

  let callDuration = message.metadata?.formattedDuration;
  if (!callDuration && typeof message.content === 'string') {
    const durationMatch = message.content.match(/\(Duration:\s*([^)]+)\)/i);
    if (durationMatch) {
      callDuration = durationMatch[1];
    }
  }

  // Check if message is a video meeting
  const isVideoMeet =
    message.type === 'VIDEO_MEET' ||
    message.metadata?.isMeeting === true ||
    (typeof message.content === 'string' &&
      (message.content.includes('Instant Video Meeting') ||
        message.content.includes('NeuraConnect Meeting Started') ||
        message.content.includes('Join Video Meeting') ||
        message.content.includes('Join NeuraConnect')));

  let videoMeetUrl = message.metadata?.roomUrl || message.metadata?.meetUrl;
  if (!videoMeetUrl && typeof message.content === 'string') {
    const urlMatch = message.content.match(/\((https?:\/\/[^\s)]+)\)/);
    if (urlMatch) {
      videoMeetUrl = urlMatch[1];
    }
  }
  if (videoMeetUrl && videoMeetUrl.endsWith('/meetings')) {
    const shortId = typeof message.id === 'string' ? message.id.slice(-6) : 'room';
    videoMeetUrl = typeof window !== 'undefined' ? `${window.location.origin}/meet/room/nv-meet-${shortId}` : '/meet/room';
  }
  if (!videoMeetUrl) {
    const shortId = typeof message.id === 'string' ? message.id.slice(-6) : 'room';
    videoMeetUrl = typeof window !== 'undefined' ? `${window.location.origin}/meet/room/nv-meet-${shortId}` : '/meet/room';
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="group relative flex gap-3 px-4 py-2 hover:bg-slate-50/80 transition-colors">
      {/* Sender Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {message.sender?.avatarUrl ? (
          <img
            src={message.sender.avatarUrl}
            alt={senderName}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
            {senderName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        {/* Header (Sender & Timestamp & Badges) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-xs text-slate-900">{senderName}</span>

          {roleBadge && roleBadge !== 'EMPLOYEE' && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
              {roleBadge}
            </span>
          )}

          {message.isInternalOnly && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/60">
              <Lock className="w-2.5 h-2.5" />
              <span>Internal Only</span>
            </span>
          )}

          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <span>{formatTime(message.createdAt)}</span>
            {isSelf && (
              <span
                className="inline-flex items-center"
                title={message.readBy?.length > 1 ? 'Read by recipient' : 'Delivered'}
              >
                <CheckCheck
                  className={`w-3.5 h-3.5 ${
                    message.readBy?.length > 1 ? 'text-blue-500' : 'text-slate-400'
                  }`}
                />
              </span>
            )}
          </span>
        </div>

        {/* Guardian DLP Banner if credentials were intercepted */}
        {message.hasRedactedData && (
          <div className="mt-1.5 mb-1 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md text-[11px] font-medium text-amber-800">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>Guardian DLP: Sensitive credentials or keys were redacted from this message.</span>
          </div>
        )}

        {/* Content based on MessageType */}
        {message.type === 'TASK_CARD' && message.metadata ? (
          <div>
            <div className="text-xs text-slate-700 mb-1">{message.content}</div>
            <TaskCard metadata={message.metadata} />
          </div>
        ) : message.type === 'VOICE_NOTE' && message.metadata?.audioUrl ? (
          <div className="mt-1 bg-white border border-slate-200 p-2.5 rounded-xl max-w-sm">
            <audio controls src={message.metadata.audioUrl} className="w-full h-8" />
          </div>
        ) : message.type === 'ATTACHMENT' && message.metadata ? (
          <div className="mt-1 inline-flex items-center gap-3 bg-white border border-slate-200/90 px-3.5 py-2.5 rounded-xl text-slate-800 shadow-sm max-w-sm">
            <FileText className="w-6 h-6 text-indigo-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{message.metadata.filename || 'File Attachment'}</div>
              <div className="text-[10px] text-slate-400">{message.metadata.size ? `${Math.round(message.metadata.size / 1024)} KB` : ''}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Save to Project Resources Button */}
              <button
                type="button"
                disabled={isSavingResource}
                onClick={() => handleSaveToResources(message.metadata)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isSavedToResources
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                }`}
                title={isSavedToResources ? 'Saved to Project Resources!' : 'Save to Project Resources'}
              >
                {isSavedToResources ? <Check className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
              </button>

              <a
                href={message.metadata.url}
                download
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : isCallMessage ? (
          /* WhatsApp-Style Audio / Missed Call Card */
          <div className="mt-1.5 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs max-w-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isMissed ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {isMissed ? <PhoneMissed className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold truncate ${isMissed ? 'text-rose-600' : 'text-slate-800'}`}>
                  {isMissed ? 'Missed voice call' : 'Voice call'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {isMissed ? 'No answer' : (callDuration ? `${callDuration}` : 'Ended')}
                </div>
              </div>
            </div>

            {onCallBack && (
              <button
                type="button"
                onClick={onCallBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
                title="Call back"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Call back</span>
              </button>
            )}
          </div>
        ) : isVideoMeet ? (
          /* WhatsApp / Teams Style Live Video Meeting Card */
          <div className="mt-1.5 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 border border-indigo-100/90 shadow-2xs max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Video className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-bold text-slate-900 truncate">NeuraConnect Video Meeting</h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Secure HD video conference room
                </p>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-indigo-100/70 flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                {typeof message.id === 'string' ? `ID: ${message.id.slice(-6).toUpperCase()}` : 'Live Room'}
              </span>
              <a
                href={videoMeetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Video Meeting</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-sm text-slate-800 leading-relaxed break-words prose prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-3 prose-code:text-indigo-600 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
            {/* Inline Quote Reply Box */}
            {message.metadata?.replyTo && (
              <div className="mb-2 p-2.5 rounded-xl bg-slate-100/90 border-l-2 border-indigo-500 text-xs text-slate-600">
                <span className="font-bold text-slate-900">
                  {message.metadata.replyTo.senderName || 'Replied'}:
                </span>{' '}
                <span className="truncate inline-block max-w-xs align-bottom">
                  {message.metadata.replyTo.text}
                </span>
              </div>
            )}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Emoji Reactions List */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {Object.entries(reactionCounts).map(([emoji, item]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(message.id, emoji)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${
                  item.hasReacted
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title={item.users.join(', ')}
              >
                <span>{emoji}</span>
                <span className="text-[11px]">{item.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread Replies Button */}
        {message.replyCount > 0 && !message.parentId && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </button>
        )}
      </div>

      {/* Hover Action Bar */}
      <div className="absolute right-4 -top-3.5 hidden group-hover:flex items-center bg-white border border-slate-200 shadow-md rounded-lg p-0.5 text-slate-500 z-10 transition-all">
        {/* Quick Reactions */}
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggleReaction(message.id, emoji)}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-xs"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        {/* Quote Reply */}
        {onReplyToMessage && (
          <button
            type="button"
            onClick={() => onReplyToMessage(message)}
            className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-md transition-colors"
            title="Quote reply"
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Reply in thread */}
        {!message.parentId && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-md transition-colors"
            title="Reply in thread"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Turn into task */}
        <button
          type="button"
          onClick={() => onCreateTask(message)}
          className="p-1.5 hover:bg-slate-100 hover:text-emerald-600 rounded-md transition-colors"
          title="Create task from message"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        {/* Copy text */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 hover:bg-slate-100 hover:text-slate-800 rounded-md transition-colors"
          title="Copy message text"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
