"use client";

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Loader2, Calendar, User, Flag, FolderKanban } from 'lucide-react';
import { api } from '@/src/lib/api';

interface CreateTaskModalProps {
  isOpen: boolean;
  message: any;
  onClose: () => void;
  onTaskCreated: (data: { task: any; cardMessage: any }) => void;
}

export function CreateTaskModal({
  isOpen,
  message,
  onClose,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && message) {
      // Smart default title from message text
      const cleanText = message.content?.replace(/\n/g, ' ').trim() || '';
      setTitle(cleanText.length > 60 ? `${cleanText.slice(0, 57)}...` : cleanText);
      setDescription(`Created from chat discussion by ${message.sender?.firstName || 'team'}:\n\n> ${cleanText}`);
      loadData();
    }
  }, [isOpen, message]);

  const loadData = async () => {
    try {
      const [empRes, projRes] = await Promise.all([
        api.get('/chat/users'),
        api.get('/projects'),
      ]);
      setEmployees(empRes.data || []);
      const projs = projRes.data?.data || projRes.data || [];
      setProjects(projs);
      if (projs.length > 0 && !projectId) {
        setProjectId(projs[0].id);
      }
    } catch (e) {
      console.error('Failed to load projects/employees for task modal:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/chat/messages/${message.id}/create-task`, {
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        projectId: projectId || undefined,
      });

      onTaskCreated(res.data);
      onClose();
    } catch (e) {
      console.error('Failed to create task from message:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-sm text-slate-900">
              Create Task from Discussion
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fix SSH rate limit on production VPS"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Context
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white text-slate-800"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key || 'NV'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white text-slate-800 font-medium"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white text-slate-800"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl outline-none bg-white text-slate-800"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckSquare className="w-3.5 h-3.5" />
              )}
              <span>Create & Link Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
