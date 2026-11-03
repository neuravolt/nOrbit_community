"use client";

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Hash,
  Lock,
  FolderKanban,
  AlertTriangle,
  MessageSquare,
  Users,
} from 'lucide-react';

interface ChatSidebarProps {
  conversations: any[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewModal: () => void;
  onlineUserIds: Set<string>;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewModal,
  onlineUserIds,
}: ChatSidebarProps) {
  const [filter, setFilter] = useState<'ALL' | 'DIRECT' | 'CHANNEL' | 'PROJECT'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    // Tab filter
    if (filter === 'DIRECT' && c.type !== 'DIRECT') return false;
    if (filter === 'CHANNEL' && c.type !== 'CHANNEL' && c.type !== 'GROUP') return false;
    if (filter === 'PROJECT' && c.entityType !== 'PROJECT') return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = c.title?.toLowerCase().includes(q);
      const matchLastMsg = c.lastMessage?.content?.toLowerCase().includes(q);
      return matchTitle || matchLastMsg;
    }
    return true;
  });

  const formatLastTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full md:w-80 lg:w-84 border-r border-slate-200 bg-white flex flex-col h-full select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>NeuraChat</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200/50">
              Enterprise
            </span>
          </h2>
          <p className="text-[11px] text-slate-400">Collaboration & Work Graph</p>
        </div>

        <button
          type="button"
          onClick={onOpenNewModal}
          className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all"
          title="New Message or Channel"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-4 py-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels, direct messages..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 placeholder-slate-400 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-1.5 flex gap-1 border-b border-slate-100 overflow-x-auto text-[11px] font-semibold text-slate-500">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            filter === 'ALL' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter('DIRECT')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            filter === 'DIRECT' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50'
          }`}
        >
          Direct
        </button>
        <button
          type="button"
          onClick={() => setFilter('CHANNEL')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            filter === 'CHANNEL' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50'
          }`}
        >
          Channels
        </button>
        <button
          type="button"
          onClick={() => setFilter('PROJECT')}
          className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
            filter === 'PROJECT' ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50'
          }`}
        >
          Projects
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-slate-400">
            {search ? 'No matching discussions found.' : 'No conversations yet. Start one!'}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isOnline = conv.otherUser ? onlineUserIds.has(conv.otherUser.id) : false;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-indigo-50/80 text-indigo-900 font-medium shadow-xs'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                {/* Avatar / Icon */}
                <div className="relative flex-shrink-0">
                  {conv.type === 'DIRECT' ? (
                    conv.otherUser?.avatarUrl ? (
                      <img
                        src={conv.otherUser.avatarUrl}
                        alt={conv.title}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                        {conv.title?.charAt(0).toUpperCase()}
                      </div>
                    )
                  ) : conv.entityType === 'PROJECT' ? (
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                      {conv.isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-5 h-5" />}
                    </div>
                  )}

                  {/* Presence indicator for DMs */}
                  {conv.type === 'DIRECT' && (
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-xs truncate ${
                        isActive ? 'font-bold text-indigo-950' : 'font-semibold text-slate-900'
                      }`}
                    >
                      {conv.type !== 'DIRECT' && conv.entityType !== 'PROJECT' ? `# ${conv.title}` : conv.title}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {formatLastTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 truncate leading-snug">
                      {conv.lastMessage
                        ? conv.lastMessage.type === 'TASK_CARD'
                          ? '📋 Task Card'
                          : conv.lastMessage.type === 'VOICE_NOTE'
                          ? '🎤 Voice Message'
                          : conv.lastMessage.type === 'ATTACHMENT'
                          ? '📎 Attachment'
                          : conv.lastMessage.content
                        : 'No messages yet'}
                    </p>

                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white animate-pulse">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
