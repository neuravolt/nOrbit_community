"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Users,
  Hash,
  Lock,
  FolderKanban,
  Check,
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import { api } from '@/src/lib/api';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: any) => void;
  onlineUserIds: Set<string>;
}

export function NewConversationModal({
  isOpen,
  onClose,
  onConversationCreated,
  onlineUserIds,
}: NewConversationModalProps) {
  const [activeTab, setActiveTab] = useState<'DM' | 'CHANNEL'>('DM');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Channel Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [channelType, setChannelType] = useState('CHANNEL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen, search]);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/chat/users?search=${encodeURIComponent(search)}`);
      setEmployees(res.data || []);
    } catch (e) {
      console.error('Failed to load employees for chat:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/chat/conversations/direct', { targetUserId });
      onConversationCreated(res.data);
      onClose();
    } catch (e) {
      console.error('Failed to create direct chat:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.post('/chat/conversations/channel', {
        title: title.trim(),
        description: description.trim() || undefined,
        type: channelType,
        isPrivate,
        memberIds: selectedMemberIds,
      });

      onConversationCreated(res.data);
      onClose();
    } catch (e) {
      console.error('Failed to create channel:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('DM')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'DM'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Direct Message
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CHANNEL')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'CHANNEL'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              New Channel / Group
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {activeTab === 'DM' ? (
          <div className="flex-1 flex flex-col min-h-0 p-6">
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team members by name or email..."
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading team members...
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No colleagues found matching "{search}".
                </div>
              ) : (
                employees.map((emp) => {
                  const isOnline = onlineUserIds.has(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStartDirectChat(emp.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl text-left transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.firstName}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                              {emp.firstName.charAt(0)}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <div className="text-[11px] text-slate-400">{emp.email}</div>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {emp.role}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateChannel} className="flex-1 flex flex-col min-h-0 p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Channel Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                  #
                </span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="e.g. backend-sprint, project-norbit"
                  className="w-full text-xs pl-7 pr-4 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Topic / Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this channel about?"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="font-medium">Make private (Invited members only)</span>
              </label>
            </div>

            {/* Member Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Add Members ({selectedMemberIds.length} selected)
              </label>
              <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 p-1">
                {employees.map((emp) => {
                  const isSelected = selectedMemberIds.includes(emp.id);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => toggleMember(emp.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isSelected ? 'bg-indigo-50/70 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400">({emp.role})</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isSubmitting}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
