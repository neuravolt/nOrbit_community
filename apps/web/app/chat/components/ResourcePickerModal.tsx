"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  FileText,
  FileSpreadsheet,
  Palette,
  ExternalLink,
  Loader2,
  FolderArchive,
  Layers,
  Paperclip,
} from 'lucide-react';
import { api } from '@/src/lib/api';

interface ResourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onSelectResource: (resource: { title: string; url: string; ext?: string }) => void;
}

export function ResourcePickerModal({
  isOpen,
  onClose,
  projectId,
  onSelectResource,
}: ResourcePickerModalProps) {
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'PROJECT'>(
    projectId ? 'PROJECT' : 'GLOBAL'
  );
  const [globalResources, setGlobalResources] = useState<any[]>([]);
  const [projectResources, setProjectResources] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [globalRes, projRes] = await Promise.all([
          api.get('/upload/resources').catch(() => ({ data: [] })),
          projectId ? api.get(`/projects/${projectId}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
        ]);

        setGlobalResources(globalRes.data || []);
        if (projRes.data) {
          const p = projRes.data?.data || projRes.data;
          setProjectResources(p.attachments || []);
        }
      } catch (err) {
        console.warn('Could not load resources for picker:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const currentList = activeTab === 'PROJECT' ? projectResources : globalResources;

  const filteredList = currentList.filter((item: any) => {
    const name = item.originalName || item.filename || item.title || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[540px] text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attach from Resources</h3>
              <p className="text-[11px] text-slate-400">Share verified company or project docs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switchers if in project */}
        {projectId && (
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold mt-3">
            <button
              type="button"
              onClick={() => setActiveTab('PROJECT')}
              className={`py-1.5 rounded-lg transition-all ${
                activeTab === 'PROJECT'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Project Files ({projectResources.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('GLOBAL')}
              className={`py-1.5 rounded-lg transition-all ${
                activeTab === 'GLOBAL'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Global Resources ({globalResources.length})
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="relative mt-3 mb-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name or document..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Resource list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 py-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="text-xs">Loading resources...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No resources found
            </div>
          ) : (
            filteredList.map((item: any) => {
              const name = item.originalName || item.filename || item.title || 'Resource Doc';
              const low = (item.url || name).toLowerCase();

              let Icon = FileText;
              if (low.includes('sheet') || low.includes('spreadsheet')) Icon = FileSpreadsheet;
              if (low.includes('figma')) Icon = Palette;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectResource({
                      title: name,
                      url: item.url,
                    });
                    onClose();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-600 group-hover:text-indigo-600 flex items-center justify-center shrink-0 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 truncate transition-colors">
                        {name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.mimeType || 'Verified Link'}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                    Attach
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Cancel */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
