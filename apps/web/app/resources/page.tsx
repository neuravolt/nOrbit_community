"use client";

import React, { useState } from "react";
import {
  FolderArchive,
  FolderPlus,
  Search,
  X,
  FileText,
  FileSpreadsheet,
  Palette,
  GitBranch,
  ExternalLink,
  Download,
  Trash2,
  Upload,
  Link as LinkIcon,
  BookOpen,
  Shield,
  Layers,
  Eye,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  useGlobalResources,
  useUploadAttachment,
  useCreateLinkAttachment,
  useDeleteAttachment,
} from "@/src/hooks/queries";
import { useAuthStore } from "@/src/store/auth";

const RESOURCE_CATEGORIES = [
  { id: 'ALL', label: 'All Resources', color: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
  { id: 'DOCS', label: 'Docs & SOPs', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'DESIGN', label: 'Design & Figma', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'SPREADSHEETS', label: 'Spreadsheets', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'POLICIES', label: 'Company Policies', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'LINKS', label: 'External Portals', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
];

function parseAttachmentMeta(att: any) {
  const original = att.originalName || att.filename || "Untitled Resource";
  let category = "DOCS";
  let displayName = original;

  const match = original.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    category = match[1].toUpperCase();
    displayName = match[2];
  }

  const uploaderName = att.uploadedBy
    ? `${att.uploadedBy.firstName || ''} ${att.uploadedBy.lastName || ''}`.trim() || att.uploadedBy.email || 'Team Member'
    : 'System Admin';

  let formattedDate = 'Recently';
  if (att.createdAt) {
    try {
      formattedDate = new Date(att.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      formattedDate = new Date(att.createdAt).toLocaleDateString();
    }
  }

  const isLink = att.mimeType === 'text/x-uri' || (att.url && (att.url.startsWith('http://') || att.url.startsWith('https://')));
  let formattedSize = '0 B';
  let ext = 'FILE';

  if (isLink) {
    formattedSize = 'External Link';
    const lowUrl = (att.url || '').toLowerCase();
    if (lowUrl.includes('docs.google.com/spreadsheets') || lowUrl.includes('sheet')) {
      ext = 'SHEET';
    } else if (lowUrl.includes('docs.google.com/document') || lowUrl.includes('doc')) {
      ext = 'DOCS';
    } else if (lowUrl.includes('figma.com')) {
      ext = 'FIGMA';
    } else if (lowUrl.includes('github.com')) {
      ext = 'REPO';
    } else {
      ext = 'LINK';
    }
  } else {
    if (att.size) {
      if (att.size > 1024 * 1024) {
        formattedSize = `${(att.size / (1024 * 1024)).toFixed(2)} MB`;
      } else {
        formattedSize = `${(att.size / 1024).toFixed(1)} KB`;
      }
    }
    ext = (att.filename || original).split('.').pop()?.toUpperCase() || 'FILE';
  }

  return {
    category,
    displayName,
    rawName: att.filename || original,
    uploaderName,
    formattedDate,
    formattedSize,
    ext,
    isLink,
    url: att.url,
  };
}

export default function GlobalResourceCentrePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: rawResources = [], isLoading } = useGlobalResources();
  const uploadAttachment = useUploadAttachment();
  const createLinkAttachment = useCreateLinkAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [resourceTab, setResourceTab] = useState<'file' | 'link'>('file');

  const [newFile, setNewFile] = useState<File | null>(null);
  const [newCustomName, setNewCustomName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newCategory, setNewCategory] = useState("DOCS");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resources = (rawResources || []).map((att: any) => ({
    ...att,
    meta: parseAttachmentMeta(att),
  }));

  const filteredResources = resources.filter((att: any) => {
    const matchesCategory = selectedCategory === 'ALL' || att.meta.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      att.meta.displayName.toLowerCase().includes(q) ||
      att.meta.rawName.toLowerCase().includes(q) ||
      att.meta.uploaderName.toLowerCase().includes(q) ||
      att.meta.category.toLowerCase().includes(q)
    );
  });

  const categoryCounts = resources.reduce((acc: Record<string, number>, curr: any) => {
    acc[curr.meta.category] = (acc[curr.meta.category] || 0) + 1;
    return acc;
  }, {});

  const handleUploadFile = async () => {
    if (!newFile) {
      alert("Please select a file to upload.");
      return;
    }
    setIsSubmitting(true);
    try {
      await uploadAttachment.mutateAsync({
        file: newFile,
        customName: newCustomName.trim() || undefined,
        category: newCategory,
        isInternal: true,
      });
      queryClient.invalidateQueries({ queryKey: ['global-resources'] });
      setIsModalOpen(false);
      setNewFile(null);
      setNewCustomName("");
      setNewCategory("DOCS");
      alert("Company resource uploaded successfully!");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to upload resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLink = async () => {
    if (!newUrl.trim()) {
      alert("Please enter a valid URL (Google Docs, Sheets, Figma, Notion, Drive).");
      return;
    }
    setIsSubmitting(true);
    try {
      await createLinkAttachment.mutateAsync({
        url: newUrl.trim(),
        title: newLinkTitle.trim() || newUrl.trim(),
        category: newCategory,
        isInternal: true,
      });
      queryClient.invalidateQueries({ queryKey: ['global-resources'] });
      setIsModalOpen(false);
      setNewUrl("");
      setNewLinkTitle("");
      setNewCategory("DOCS");
      alert("Company resource link saved successfully!");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to save resource link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from Company Resources?`)) return;
    try {
      await deleteAttachment.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['global-resources'] });
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete resource.");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderArchive className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900">
              Company Resource Centre
            </h1>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Global NeuraVolt documentation, technical SOPs, brand assets, and team resources.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow-sm flex items-center gap-2 h-9 px-4 self-start sm:self-auto"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Add Resource / Document</span>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total Resources</span>
            <FolderArchive className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-1.5">{resources.length}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Documents & links available</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Docs & SOPs</span>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-1.5">{categoryCounts['DOCS'] || 0}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Specifications & SOPs</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Design & Assets</span>
            <Palette className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-1.5">{categoryCounts['DESIGN'] || 0}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Figma & brand files</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Policies & Standards</span>
            <Shield className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-1.5">{categoryCounts['POLICIES'] || 0}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Compliance & rules</div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
        {/* Search & Categories Bar */}
        <div className="p-5 border-b border-zinc-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              className="w-full h-9 pl-9 pr-7 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
              placeholder="Search resources by title, description, or uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {RESOURCE_CATEGORIES.map((cat) => {
              const count = cat.id === 'ALL' ? resources.length : (categoryCounts[cat.id] || 0);
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'bg-zinc-100/70 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table or Empty State */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading resources...</div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-500 mx-auto flex items-center justify-center mb-3">
              <FolderArchive className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-800">
              {searchQuery || selectedCategory !== 'ALL'
                ? "No matching company resources found"
                : "No company resources uploaded yet"}
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || selectedCategory !== 'ALL'
                ? "Try adjusting your query or resetting the category filter."
                : "Upload your first SOP, technical manual, or external Google Docs link for the team."}
            </p>
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg"
            >
              <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
              Upload First Resource
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/70 border-b border-zinc-200/70">
                <TableRow>
                  <TableHead className="w-[42%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-3">Resource / Document</TableHead>
                  <TableHead className="w-[16%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-3">Category</TableHead>
                  <TableHead className="w-[20%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-3">Uploaded By</TableHead>
                  <TableHead className="w-[10%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-3">Size / Type</TableHead>
                  <TableHead className="w-[12%] text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-100 text-xs">
                {filteredResources.map((att: any) => {
                  const base = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api');
                  const downloadUrl = att.url.startsWith('http') ? att.url : `${base}${att.url}`;
                  const categoryObj = RESOURCE_CATEGORIES.find(c => c.id === att.meta.category) || RESOURCE_CATEGORIES[1];

                  let iconBg = "bg-zinc-100 text-zinc-700 border-zinc-200";
                  let IconComponent = FileText;

                  if (att.meta.ext === 'SHEET') {
                    iconBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    IconComponent = FileSpreadsheet;
                  } else if (att.meta.ext === 'DOCS') {
                    iconBg = "bg-blue-50 text-blue-700 border-blue-200";
                    IconComponent = FileText;
                  } else if (att.meta.ext === 'FIGMA') {
                    iconBg = "bg-purple-50 text-purple-700 border-purple-200";
                    IconComponent = Palette;
                  } else if (att.meta.ext === 'REPO') {
                    iconBg = "bg-zinc-100 text-zinc-700 border-zinc-300";
                    IconComponent = GitBranch;
                  }

                  return (
                    <TableRow key={att.id} className="hover:bg-zinc-50/70 transition-colors">
                      <TableCell className="py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-[10px] shrink-0 ${iconBg}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span 
                              onClick={() => window.open(downloadUrl, '_blank')}
                              className="font-medium text-xs text-zinc-900 hover:text-indigo-600 cursor-pointer truncate flex items-center gap-1.5"
                              title={att.meta.displayName}
                            >
                              {att.meta.displayName}
                              {att.meta.isLink && (
                                <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                              )}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono truncate" title={att.meta.rawName}>
                              {att.meta.isLink ? att.url : att.meta.rawName}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 align-middle">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${categoryObj.color}`}>
                          {categoryObj.label}
                        </span>
                      </TableCell>

                      <TableCell className="py-3 align-middle">
                        <div className="flex flex-col text-[11px] text-zinc-600">
                          <span className="font-medium text-zinc-800">{att.meta.uploaderName}</span>
                          <span className="text-zinc-400">{att.meta.formattedDate}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 align-middle font-mono text-[11px] text-zinc-500">
                        {att.meta.isLink ? (
                          <span className="text-[10px] font-sans font-medium text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                            External Link
                          </span>
                        ) : (
                          att.meta.formattedSize
                        )}
                      </TableCell>

                      <TableCell className="py-3 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {att.meta.isLink ? (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                              title="Open link in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </a>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => window.open(downloadUrl, '_blank')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                title="View / Open document in new tab"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                              <a
                                href={downloadUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                                title="Download Document"
                              >
                                <Download className="w-3.5 h-3.5 text-zinc-500" />
                              </a>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(att.id, att.meta.displayName)}
                            className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                            title="Delete Resource"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-zinc-200 max-w-lg w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-zinc-900">Add Company Resource</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Upload a document or share an external cloud resource link.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-1 gap-1">
              <button
                type="button"
                onClick={() => setResourceTab('file')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  resourceTab === 'file'
                    ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Document / File</span>
              </button>
              <button
                type="button"
                onClick={() => setResourceTab('link')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  resourceTab === 'link'
                    ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>External Link (Docs / Figma / Notion)</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {resourceTab === 'file' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">Choose File</label>
                    <div className="border border-dashed border-zinc-300 rounded-lg p-5 text-center bg-zinc-50/50 hover:bg-zinc-50 transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setNewFile(e.target.files[0]);
                          }
                        }}
                      />
                      {newFile ? (
                        <div className="flex flex-col items-center">
                          <FileText className="w-6 h-6 text-indigo-600 mb-1" />
                          <span className="font-semibold text-xs text-zinc-900">{newFile.name}</span>
                          <span className="text-[11px] text-zinc-400 mt-0.5">
                            {(newFile.size / 1024).toFixed(1)} KB • Click to choose another
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="w-6 h-6 text-zinc-400 mb-1" />
                          <span className="text-xs font-medium text-zinc-700">Click to upload file</span>
                          <span className="text-[11px] text-zinc-400 mt-0.5">PDF, DOCX, XLSX, Images, ZIP up to 50MB</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Resource Title (Optional)</label>
                    <input
                      type="text"
                      className="w-full text-xs h-8.5 px-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. Employee Handbook 2026, Production Server SOP"
                      value={newCustomName}
                      onChange={(e) => setNewCustomName(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Resource Link URL *</label>
                    <input
                      type="url"
                      className="w-full text-xs h-8.5 px-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="https://docs.google.com/... or https://figma.com/..."
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Display Title *</label>
                    <input
                      type="text"
                      className="w-full text-xs h-8.5 px-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. NeuraVolt Brand Kit on Figma"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                <select
                  className="w-full text-xs h-8.5 px-3 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="DOCS">Docs & SOPs</option>
                  <option value="DESIGN">Design & Figma</option>
                  <option value="SPREADSHEETS">Spreadsheets & Trackers</option>
                  <option value="POLICIES">Company Policies & Compliance</option>
                  <option value="LINKS">External Portals & Links</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-zinc-50/70 border-t border-zinc-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>

              {resourceTab === 'file' ? (
                <Button
                  size="sm"
                  onClick={handleUploadFile}
                  disabled={!newFile || isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-8 text-xs"
                >
                  {isSubmitting ? "Uploading..." : "Upload Document"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSaveLink}
                  disabled={!newUrl.trim() || isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-8 text-xs"
                >
                  {isSubmitting ? "Saving..." : "Save Link"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
