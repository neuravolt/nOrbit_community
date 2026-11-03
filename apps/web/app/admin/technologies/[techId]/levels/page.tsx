"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Search,
  ArrowLeft,
  Layers,
  BookOpen,
  Zap,
  Clock,
  GitBranch,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// Real data (React/Node.js's own Levels) uses all 6 of these — confirmed live across both
// technologies' full Level lists. 'explorer'/'expert'/'professional' were seeded outside this
// form, which previously only offered 3 options and would have rejected them
// (technology-level.dto.ts's @IsIn matched this same 3-tier list). Now matches the real scale,
// and what "Suggest Levels via AI" can propose for a capstone-style Level.
type LevelDifficulty = "beginner" | "explorer" | "intermediate" | "advanced" | "expert" | "professional";

interface TechnologyLevel {
  id: string;
  levelNumber: number;
  name?: string;
  description?: string;
  xpRequired: number;
  estimatedDurationHours?: number;
  difficulty: LevelDifficulty;
  sortOrder: number;
  isActive: boolean;
  _count?: { nodes: number };
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-800 border-emerald-300",
  explorer: "bg-sky-100 text-sky-800 border-sky-300",
  intermediate: "bg-amber-100 text-amber-800 border-amber-300",
  advanced: "bg-rose-100 text-rose-800 border-rose-300",
  expert: "bg-orange-100 text-orange-800 border-orange-300",
  professional: "bg-violet-100 text-violet-800 border-violet-300",
};

const defaultForm = {
  name: "",
  description: "",
  xpRequired: 0,
  estimatedDurationHours: "" as number | "",
  difficulty: "beginner" as LevelDifficulty,
  sortOrder: 0,
  isActive: true,
};

export default function TechnologyLevelsManagementPage() {
  const { techId } = useParams<{ techId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<TechnologyLevel | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [suggestInstruction, setSuggestInstruction] = useState("");
  const [showSuggestInstruction, setShowSuggestInstruction] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [syllabusFanOutInstruction, setSyllabusFanOutInstruction] = useState("");
  const [showSyllabusFanOutInstruction, setShowSyllabusFanOutInstruction] = useState(false);
  const [isGeneratingAllSyllabuses, setIsGeneratingAllSyllabuses] = useState(false);

  // Fetch parent technology info for breadcrumb
  const { data: technology } = useQuery({
    queryKey: ["admin-technology-detail", techId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/admin/technologies/${techId}`);
        return data.data || null;
      } catch {
        return null;
      }
    },
    retry: 1,
  });

  // Fetch levels for this technology
  const { data: levels = [], isLoading, isError, error, refetch } = useQuery<TechnologyLevel[]>({
    queryKey: ["admin-technology-levels", techId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/technologies/${techId}/levels`);
      return data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) =>
      api.post(`/admin/technologies/${techId}/levels`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technology-levels", techId] });
      setIsCreateOpen(false);
      setForm(defaultForm);
    },
    onError: (err: any) => {
      alert("Failed to create level: " + (err.response?.data?.message || err.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) =>
      api.put(`/admin/levels/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technology-levels", techId] });
      setEditingLevel(null);
      setForm(defaultForm);
    },
    onError: (err: any) => {
      alert("Failed to update level: " + (err.response?.data?.message || err.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/levels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technology-levels", techId] });
    },
    onError: (err: any) => {
      alert("Failed to delete level: " + (err.response?.data?.message || err.message));
    },
  });

  const handleEdit = (level: TechnologyLevel) => {
    setEditingLevel(level);
    setForm({
      name: level.name || "",
      description: level.description || "",
      xpRequired: level.xpRequired,
      estimatedDurationHours: level.estimatedDurationHours ?? "",
      difficulty: level.difficulty,
      sortOrder: level.sortOrder,
      isActive: level.isActive,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      estimatedDurationHours: form.estimatedDurationHours !== "" ? Number(form.estimatedDurationHours) : undefined,
    };
    if (editingLevel) {
      updateMutation.mutate({ id: editingLevel.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleSuggestLevels = async () => {
    setIsSuggesting(true);
    try {
      await api.post(`/launchpad/admin/ai/technologies/${techId}/generate-levels`, {
        instruction: suggestInstruction.trim() || undefined,
      });
      alert(
        'Level suggestion job queued. Go to "Generation Jobs" in the sidebar to review the proposed levels and approve them — approving materializes real Level rows here.',
      );
      setSuggestInstruction("");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to queue level suggestion.");
    } finally {
      setIsSuggesting(false);
    }
  };

  // Offered ALONGSIDE each Level's own individual "Generate Syllabus" button (on
  // /admin/levels/[levelId]/syllabus), not instead of it — a shared instruction here applies to
  // every Level identically, so it's the right tool when no Level needs anything special, but a
  // Level that DOES (e.g. "Level 1 needs Git/GitHub basics") still gets triggered individually.
  const handleGenerateAllSyllabuses = async () => {
    if (levels.length === 0) return;
    setIsGeneratingAllSyllabuses(true);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/technologies/${techId}/generate-all-syllabuses`, {
        instruction: syllabusFanOutInstruction.trim() || undefined,
      });
      const failedCount = data?.failed?.length ?? 0;
      alert(
        `Queued syllabus generation for ${data?.queued?.length ?? levels.length} level(s).` +
          (failedCount > 0 ? ` ${failedCount} level(s) failed to queue — check the console/logs.` : "") +
          ` Go to "Generation Jobs" to review and approve each.`,
      );
      setSyllabusFanOutInstruction("");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to queue syllabus generation.");
    } finally {
      setIsGeneratingAllSyllabuses(false);
    }
  };

  const filteredLevels = levels
    .filter(
      (l) =>
        (l.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(l.levelNumber).includes(searchTerm)
    )
    .sort((a, b) => a.levelNumber - b.levelNumber);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <p className="font-semibold text-rose-700">Failed to load levels</p>
          <p className="text-sm text-rose-600">
            {(error as any)?.response?.data?.message || (error as any)?.message || "Unknown error"}
          </p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const FormFields = () => (
    <form onSubmit={handleSave} className="space-y-4 pt-2">
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Level Name</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Foundations, Core Concepts, Advanced"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full min-h-[72px] p-2 border border-slate-200 rounded-md text-sm resize-none"
          placeholder="What students will learn at this level..."
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Difficulty *</label>
        <select
          value={form.difficulty}
          onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
          className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
          required
        >
          <option value="beginner">Beginner</option>
          <option value="explorer">Explorer</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="expert">Expert</option>
          <option value="professional">Professional</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase block mb-1">XP Required</label>
          <Input
            type="number"
            min={0}
            value={form.xpRequired}
            onChange={(e) => setForm({ ...form, xpRequired: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase block mb-1">Est. Duration (hrs)</label>
          <Input
            type="number"
            min={0}
            value={form.estimatedDurationHours}
            onChange={(e) =>
              setForm({ ...form, estimatedDurationHours: e.target.value ? Number(e.target.value) : "" })
            }
            placeholder="e.g. 40"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
        <Input
          type="number"
          value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="levelActive"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />
        <label htmlFor="levelActive" className="text-sm font-semibold cursor-pointer">
          Active & Visible to Students
        </label>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCreateOpen(false);
            setEditingLevel(null);
            setForm(defaultForm);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-900 text-white" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : editingLevel ? (
            "Save Changes"
          ) : (
            "Create Level"
          )}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="p-8 space-y-6 text-slate-800">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-4">
        <span>Admin</span>
        <span>&gt;</span>
        <Link href="/admin/careers" className="hover:underline">Careers</Link>
        <span>&gt;</span>
        <span className="hover:underline cursor-pointer" onClick={() => router.back()}>
          Technologies
        </span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">
          {technology?.name || "Technology"} — Levels
        </span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="w-6 h-6 text-orange-500" />
              Level Management
            </h2>
            <p className="text-sm text-slate-500">
              Curriculum levels for{" "}
              <span className="font-semibold text-slate-700">
                {technology?.name || "this technology"}
              </span>{" "}
              &mdash; {levels.length} level{levels.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Level
        </Button>
      </div>

      {/* Suggest Levels via AI */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Suggest Levels via AI
        </h3>
        <p className="text-xs text-slate-500">
          Proposes the ordered Level progression for this Technology — names, one-line
          descriptions, difficulty, and estimated duration. Existing Levels are never touched;
          this only proposes new ones. Optional instruction lets you steer count or coverage —
          e.g. "aim for 8 levels, ending with a recruiter-facing capstone."
        </p>
        {showSuggestInstruction ? (
          <div className="space-y-1">
            <textarea
              autoFocus
              value={suggestInstruction}
              onChange={(e) => setSuggestInstruction(e.target.value)}
              placeholder='Optional instruction, e.g. "Aim for 8 levels covering fundamentals through a production-ready capstone."'
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="button"
              onClick={() => {
                setShowSuggestInstruction(false);
                setSuggestInstruction("");
              }}
              className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
            >
              Remove instruction
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSuggestInstruction(true)}
            className="block text-xs font-semibold text-indigo-600 hover:underline"
          >
            + Add optional instruction
          </button>
        )}
        <Button onClick={handleSuggestLevels} disabled={isSuggesting} className="bg-slate-900 text-white hover:bg-slate-800">
          {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Suggest Levels
        </Button>
      </div>

      {/* Generate Syllabus for All Levels — alongside each Level's own individual button, not
          instead of it. A Level that needs something special (e.g. Level 1 needing GitHub
          basics) should still be triggered on its own Syllabus page with its own instruction. */}
      {levels.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-indigo-500" />
            Generate Syllabus for All Levels
          </h3>
          <p className="text-xs text-slate-500">
            Fires one Syllabus request per existing Level ({levels.length}) instead of opening
            each Level's own page one at a time. Any instruction here applies identically to
            every Level — if one Level needs something the others shouldn't get, trigger that
            Level individually from its own Syllabus page instead.
          </p>
          {showSyllabusFanOutInstruction ? (
            <div className="space-y-1">
              <textarea
                autoFocus
                value={syllabusFanOutInstruction}
                onChange={(e) => setSyllabusFanOutInstruction(e.target.value)}
                placeholder='Optional shared instruction, e.g. "Keep a consistent, practical tone across every level."'
                rows={2}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  setShowSyllabusFanOutInstruction(false);
                  setSyllabusFanOutInstruction("");
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
              >
                Remove instruction
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSyllabusFanOutInstruction(true)}
              className="block text-xs font-semibold text-indigo-600 hover:underline"
            >
              + Add optional shared instruction
            </button>
          )}
          <Button onClick={handleGenerateAllSyllabuses} disabled={isGeneratingAllSyllabuses} variant="outline">
            {isGeneratingAllSyllabuses ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <GitBranch className="w-4 h-4 mr-1.5" />}
            Generate All Syllabuses
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 max-w-sm bg-white border border-slate-200 px-3 py-2 rounded-lg">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search levels by name or number..."
          className="outline-none text-sm w-full bg-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> XP Required
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> Est. Hours
                </span>
              </TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-purple-500" /> Nodes
                </span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                  No levels found. Click <strong>Add Level</strong> to create the first one.
                </TableCell>
              </TableRow>
            ) : (
              filteredLevels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell className="font-mono font-bold text-slate-600 text-sm">
                    L{level.levelNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {level.name || `Level ${level.levelNumber}`}
                      </p>
                      {level.description && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">
                          {level.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${DIFFICULTY_COLORS[level.difficulty]} border font-semibold capitalize`}
                    >
                      {level.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-amber-700">
                    {level.xpRequired.toLocaleString()} XP
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {level.estimatedDurationHours != null ? `${level.estimatedDurationHours}h` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600 font-medium">
                      {level._count?.nodes ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={level.isActive ? "default" : "secondary"}>
                      {level.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link href={`/admin/levels/${level.id}/syllabus`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                        title="Curriculum tree: chapters, topics, and what's been generated for each"
                      >
                        <GitBranch className="w-3.5 h-3.5 mr-1" />
                        Syllabus Tree
                      </Button>
                    </Link>
                    <Link href={`/admin/levels/${level.id}/execution-tree`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-violet-500 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                        title="Execution tree: every AI job this level's pipeline actually ran, click one to see its response"
                      >
                        <GitBranch className="w-3.5 h-3.5 mr-1" />
                        Execution Tree
                      </Button>
                    </Link>
                    <Link href={`/admin/levels/${level.id}/nodes`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                      >
                        Manage Nodes
                      </Button>
                    </Link>
                    <Button variant="outline" size="icon" onClick={() => handleEdit(level)}>
                      <Edit className="w-3.5 h-3.5 text-slate-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete Level ${level.levelNumber}? This will also remove its nodes.`))
                          deleteMutation.mutate(level.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Level</DialogTitle>
          </DialogHeader>
          <FormFields />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingLevel && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setEditingLevel(null); setForm(defaultForm); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Level {editingLevel.levelNumber}</DialogTitle>
            </DialogHeader>
            <FormFields />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
