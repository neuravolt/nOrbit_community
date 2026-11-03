"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  FolderKanban,
  CheckSquare,
  Paperclip,
  Users,
  ExternalLink,
  Plus,
  Loader2,
  FileText,
  FileSpreadsheet,
  Palette,
  Download,
  CheckCircle2,
  Clock,
  ChevronRight,
  Flame,
  ChevronUp,
  Equal,
  ChevronDown,
  User as UserIcon,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { api } from '@/src/lib/api';

interface ProjectHubDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: any;
  currentUserId: string;
  onlineUserIds: Set<string>;
  onOpenCreateTask?: () => void;
  onStartDirectChat?: (userId: string) => void;
}

export function ProjectHubDrawer({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onlineUserIds,
  onOpenCreateTask,
  onStartDirectChat,
}: ProjectHubDrawerProps) {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'RESOURCES' | 'TEAM'>('TASKS');
  const [projectData, setProjectData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const projectId =
    conversation?.entityType === 'PROJECT' ? conversation?.entityId : null;

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let unmounted = false;
    const fetchProjectDetails = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/projects/${projectId}`);
        if (!unmounted) {
          setProjectData(res.data?.data || res.data || null);
        }
      } catch (err) {
        console.warn('Could not fetch project details for chat hub:', err);
      } finally {
        if (!unmounted) setIsLoading(false);
      }
    };

    fetchProjectDetails();
    return () => {
      unmounted = true;
    };
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    if (updatingTaskId) return;
    setUpdatingTaskId(taskId);
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      setProjectData((prev: any) => {
        if (!prev) return prev;
        const updatedTasks = (prev.tasks || []).map((t: any) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        );
        return { ...prev, tasks: updatedTasks };
      });
    } catch (e) {
      console.error('Failed to update task status:', e);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const tasks = projectData?.tasks || [];
  const attachments = projectData?.attachments || [];
  const members = projectData?.members || conversation?.members || [];

  const completedTasksCount = tasks.filter(
    (t: any) => t.status === 'DONE' || t.status === 'done' || t.status === 'COMPLETED'
  ).length;

  return (
    <div className="w-80 sm:w-96 border-l border-slate-200 bg-white flex flex-col h-full z-20 shrink-0 shadow-lg animate-in slide-in-from-right duration-200 select-none">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <FolderKanban className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-900 truncate">
              {projectData?.name || conversation?.title || 'Project Workspace'}
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {projectData?.key ? `#${projectData.key}` : 'Integrated Hub'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Tab Controls */}
      <div className="p-2 border-b border-slate-100 bg-white">
        <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('TASKS')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeTab === 'TASKS'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tasks ({tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RESOURCES')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeTab === 'RESOURCES'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Files ({attachments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TEAM')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
              activeTab === 'TEAM'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team ({members.length})</span>
          </button>
        </div>
      </div>

      {/* Main Drawer Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">Syncing project data...</span>
          </div>
        ) : activeTab === 'TASKS' ? (
          /* ── Tasks Tab ── */
          <div className="space-y-3">
            {/* Progress summary banner */}
            {tasks.length > 0 && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-indigo-950">
                    {completedTasksCount} of {tasks.length} Done
                  </p>
                  <p className="text-[10px] text-indigo-600/80">
                    Sprint Progress: {Math.round((completedTasksCount / tasks.length) * 100)}%
                  </p>
                </div>
                {onOpenCreateTask && (
                  <button
                    type="button"
                    onClick={onOpenCreateTask}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-2xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Task</span>
                  </button>
                )}
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="text-center py-12 px-4">
                <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No active tasks found</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Create a task from any message or start a new sprint.
                </p>
                {onOpenCreateTask && (
                  <button
                    type="button"
                    onClick={onOpenCreateTask}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Task</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task: any) => {
                  const isDone = task.status === 'DONE' || task.status === 'done' || task.status === 'COMPLETED';
                  const isInProgress = task.status === 'IN_PROGRESS';

                  return (
                    <div
                      key={task.id}
                      className="p-3 bg-white rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col gap-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/tasks?search=${task.id}`}
                          className="text-xs font-semibold text-slate-900 hover:text-indigo-600 line-clamp-2 transition-colors flex-1"
                        >
                          {task.title}
                        </Link>
                        <Link
                          href={`/tasks?search=${task.id}`}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 p-0.5 transition-opacity"
                          title="Open Task"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      {/* Status & Assignee row */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        {/* Status Switcher Pill */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={updatingTaskId === task.id}
                            onClick={() =>
                              handleUpdateTaskStatus(task.id, isDone ? 'TODO' : 'DONE')
                            }
                            className={`px-2 py-0.5 rounded-md font-semibold text-[10px] flex items-center gap-1 transition-colors ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isInProgress
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{task.status || 'TODO'}</span>
                          </button>
                        </div>

                        {/* Assignee */}
                        <span className="text-slate-400 truncate max-w-[120px]">
                          {task.assignee
                            ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim() ||
                              task.assignee.email
                            : 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'RESOURCES' ? (
          /* ── Resources Tab ── */
          <div className="space-y-3">
            {attachments.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No project resources yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Upload specs, Figma boards, or PDFs to keep them in one place.
                </p>
                {projectId && (
                  <Link
                    href={`/projects/${projectId}?tab=resources`}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                  >
                    <span>Open Resource Center</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((att: any) => {
                  const name = att.originalName || att.filename || 'Resource Document';
                  const isLink =
                    att.mimeType === 'text/x-uri' ||
                    (att.url && (att.url.startsWith('http://') || att.url.startsWith('https://')));

                  let IconComponent = FileText;
                  const lowUrl = (att.url || name).toLowerCase();
                  if (lowUrl.includes('sheet') || lowUrl.includes('spreadsheet')) {
                    IconComponent = FileSpreadsheet;
                  } else if (lowUrl.includes('figma')) {
                    IconComponent = Palette;
                  }

                  return (
                    <div
                      key={att.id}
                      className="p-2.5 bg-white rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:shadow-xs transition-all flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {isLink ? 'External Link' : 'Stored File'}
                          </p>
                        </div>
                      </div>

                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
                        title={isLink ? 'Open Link' : 'Download File'}
                      >
                        {isLink ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── Team Tab ── */
          <div className="space-y-2">
            {members.map((member: any) => {
              const u = member.user || member;
              const isUserOnline = onlineUserIds.has(u.id);

              return (
                <div
                  key={u.id}
                  className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.firstName}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                          {u.firstName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-white ${
                          isUserOnline ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {u.firstName || ''} {u.lastName || ''}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{u.role || u.email}</p>
                    </div>
                  </div>

                  {u.id !== currentUserId && onStartDirectChat && (
                    <button
                      type="button"
                      onClick={() => onStartDirectChat(u.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Direct Message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer Footer with Quick Project Link */}
      {projectId && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <Link
            href={`/projects/${projectId}`}
            className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <span>Open Full Project Dashboard</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
        </div>
      )}
    </div>
  );
}
