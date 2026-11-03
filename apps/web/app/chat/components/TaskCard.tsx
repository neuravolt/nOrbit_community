"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Clock,
  User as UserIcon,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  FolderKanban,
} from 'lucide-react';
import { api } from '@/src/lib/api';

interface TaskCardProps {
  metadata: {
    taskId: string;
    taskCode?: string;
    taskNumber?: number;
    title: string;
    status: string;
    priority?: string;
    projectName?: string;
    projectKey?: string;
    dueDate?: string;
    assigneeName?: string;
  };
}

export function TaskCard({ metadata }: TaskCardProps) {
  const [status, setStatus] = useState(metadata.status || 'TODO');
  const [isUpdating, setIsUpdating] = useState(false);

  const statusColors: Record<string, string> = {
    TODO: 'bg-slate-100 text-slate-700 border-slate-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    IN_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
    DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    BLOCKED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const priorityColors: Record<string, string> = {
    URGENT: 'text-rose-600 bg-rose-50',
    HIGH: 'text-amber-600 bg-amber-50',
    MEDIUM: 'text-blue-600 bg-blue-50',
    LOW: 'text-slate-500 bg-slate-50',
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status || isUpdating) return;
    setIsUpdating(true);
    try {
      await api.patch(`/tasks/${metadata.taskId}`, { status: newStatus });
      setStatus(newStatus);
    } catch (e) {
      console.error('Failed to update task status from chat card:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mt-2.5 max-w-md w-full bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 text-slate-800">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
          <FolderKanban className="w-3.5 h-3.5" />
          <span>{metadata.projectName || metadata.projectKey || 'NeuraVolt Project'}</span>
          <span className="text-slate-400">•</span>
          <span className="font-mono text-slate-600">
            {metadata.taskCode || `#${metadata.taskNumber || metadata.taskId.slice(0, 6)}`}
          </span>
        </div>

        <Link
          href={`/tasks?search=${metadata.taskCode || metadata.taskId}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <span>Open Task</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Title */}
      <div className="mt-2.5 mb-3">
        <h4 className="text-sm font-semibold text-slate-900 leading-snug">
          {metadata.title}
        </h4>
      </div>

      {/* Metadata Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
        {/* Status Dropdown */}
        <div className="relative inline-block">
          <select
            value={status}
            disabled={isUpdating}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`appearance-none text-[11px] font-semibold px-2.5 py-1 pr-6 rounded-md border cursor-pointer outline-none transition-all ${
              statusColors[status] || statusColors.TODO
            }`}
          >
            <option value="TODO">Todo</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Priority Badge */}
        {metadata.priority && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              priorityColors[metadata.priority] || priorityColors.MEDIUM
            }`}
          >
            {metadata.priority}
          </span>
        )}

        {/* Assignee */}
        <div className="flex items-center gap-1 text-slate-600 text-[11px] ml-auto">
          <UserIcon className="w-3 h-3 text-slate-400" />
          <span>{metadata.assigneeName || 'Unassigned'}</span>
        </div>

        {/* Due Date */}
        {metadata.dueDate && (
          <div className="flex items-center gap-1 text-slate-500 text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{new Date(metadata.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
