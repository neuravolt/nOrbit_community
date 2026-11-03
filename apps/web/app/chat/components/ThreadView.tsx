"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, MessageSquare, Loader2 } from 'lucide-react';
import { api } from '@/src/lib/api';
import { MessageItem } from './MessageItem';

interface ThreadViewProps {
  parentMessage: any;
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onCreateTask: (message: any) => void;
}

export function ThreadView({
  parentMessage,
  conversationId,
  currentUserId,
  onClose,
  onToggleReaction,
  onCreateTask,
}: ThreadViewProps) {
  const [replies, setReplies] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchThreadReplies();
  }, [parentMessage.id]);

  const fetchThreadReplies = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(
        `/chat/conversations/${conversationId}/messages?parentId=${parentMessage.id}`
      );
      setReplies(res.data || []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      console.error('Failed to load thread replies:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      const res = await api.post(`/chat/conversations/${conversationId}/messages`, {
        content: content.trim(),
        parentId: parentMessage.id,
      });

      setReplies((prev) => [...prev, res.data]);
      setContent('');
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      console.error('Failed to send reply:', e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col h-full md:relative md:w-80 lg:w-96 md:inset-auto border-l border-slate-200 shadow-xl">
      {/* Thread Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-sm text-slate-800">Thread</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thread Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {/* Parent Message */}
        <div className="bg-slate-50/40 p-2">
          <MessageItem
            message={parentMessage}
            currentUserId={currentUserId}
            onOpenThread={() => {}}
            onToggleReaction={onToggleReaction}
            onCreateTask={onCreateTask}
          />
        </div>

        {/* Replies List */}
        <div className="py-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading replies...
            </div>
          ) : replies.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No replies yet. Start the thread discussion!
            </div>
          ) : (
            replies.map((reply) => (
              <MessageItem
                key={reply.id}
                message={reply}
                currentUserId={currentUserId}
                onOpenThread={() => {}}
                onToggleReaction={onToggleReaction}
                onCreateTask={onCreateTask}
              />
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Thread Composer */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400"
          />

          <button
            type="submit"
            disabled={!content.trim() || isSending}
            className="p-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
