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
  BookOpen,
  Globe,
  EyeOff,
  Pencil,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface RoadmapNode {
  id: string;
  nodeNumber: number;
  title: string;
  slug: string;
  description?: string;
  xpReward: number;
  coinsReward: number;
  estimatedDurationMinutes: number;
  difficulty: string;
  status: "draft" | "review" | "published" | "archived";
  publishedAt?: string;
  isActive?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  review: "bg-blue-100 text-blue-800 border-blue-300",
  published: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archived: "bg-rose-100 text-rose-700 border-rose-300",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-800 border-emerald-300",
  intermediate: "bg-amber-100 text-amber-800 border-amber-300",
  advanced: "bg-rose-100 text-rose-800 border-rose-300",
};

const defaultForm = {
  title: "",
  slug: "",
  description: "",
  xpReward: 0,
  coinsReward: 0,
  estimatedDurationMinutes: 60,
  difficulty: "beginner",
  status: "draft",
};

export default function LevelNodesManagementPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<RoadmapNode | null>(null);
  const [form, setForm] = useState(defaultForm);

  // Fetch level info for breadcrumb
  const { data: level } = useQuery({
    queryKey: ["admin-level-detail", levelId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/admin/levels/${levelId}`);
        return data.data || null;
      } catch {
        return null;
      }
    },
    retry: 1,
  });

  // Fetch nodes for this level
  const { data: nodes = [], isLoading, isError, error, refetch } = useQuery<RoadmapNode[]>({
    queryKey: ["admin-level-nodes", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/levels/${levelId}/nodes`);
      return data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) =>
      api.post(`/admin/levels/${levelId}/nodes`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-level-nodes", levelId] });
      setIsCreateOpen(false);
      setForm(defaultForm);
    },
    onError: (err: any) => {
      alert("Failed to create node: " + (err.response?.data?.message || err.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) =>
      api.put(`/admin/nodes/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-level-nodes", levelId] });
      setEditingNode(null);
      setForm(defaultForm);
    },
    onError: (err: any) => {
      alert("Failed to update node: " + (err.response?.data?.message || err.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/nodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-level-nodes", levelId] });
    },
    onError: (err: any) => {
      alert("Failed to delete node: " + (err.response?.data?.message || err.message));
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/admin/nodes/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-level-nodes", levelId] });
    },
    onError: (err: any) => {
      alert("Failed to publish node: " + (err.response?.data?.message || err.message));
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/admin/nodes/${id}/unpublish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-level-nodes", levelId] });
    },
    onError: (err: any) => {
      alert("Failed to unpublish node: " + (err.response?.data?.message || err.message));
    },
  });

  const handleEdit = (node: RoadmapNode) => {
    setEditingNode(node);
    setForm({
      title: node.title,
      slug: node.slug,
      description: node.description || "",
      xpReward: node.xpReward,
      coinsReward: node.coinsReward,
      estimatedDurationMinutes: node.estimatedDurationMinutes,
      difficulty: node.difficulty,
      status: node.status,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNode) {
      updateMutation.mutate({ id: editingNode.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filteredNodes = nodes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(n.nodeNumber).includes(searchTerm)
    )
    .sort((a, b) => a.nodeNumber - b.nodeNumber);

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
          <p className="font-semibold text-rose-700">Failed to load nodes</p>
          <p className="text-sm text-rose-600">
            {(error as any)?.response?.data?.message || (error as any)?.message || "Unknown error"}
          </p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const FormContent = () => (
    <form onSubmit={handleSave} className="space-y-4 pt-2">
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Title *</label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Introduction to Node.js"
          required
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Slug *</label>
        <Input
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          placeholder="e.g. intro-to-nodejs"
          required
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase block mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full min-h-[72px] p-2 border border-slate-200 rounded-md text-sm resize-none"
          placeholder="Brief overview of what this node covers..."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase block mb-1">Difficulty</label>
          <select
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase block mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-bold uppercase block mb-1">XP Reward</label>
          <Input
            type="number"
            min={0}
            value={form.xpReward}
            onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase block mb-1">Coins Reward</label>
          <Input
            type="number"
            min={0}
            value={form.coinsReward}
            onChange={(e) => setForm({ ...form, coinsReward: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase block mb-1">Est. Minutes</label>
          <Input
            type="number"
            min={0}
            value={form.estimatedDurationMinutes}
            onChange={(e) =>
              setForm({ ...form, estimatedDurationMinutes: Number(e.target.value) })
            }
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCreateOpen(false);
            setEditingNode(null);
            setForm(defaultForm);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" className="bg-slate-900 text-white" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : editingNode ? (
            "Save Changes"
          ) : (
            "Create Node"
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
          Levels
        </span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">
          {level?.name ? `L${level.levelNumber}: ${level.name}` : "Level"} &mdash; Nodes
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
              <BookOpen className="w-6 h-6 text-orange-500" />
              Node Management
            </h2>
            <p className="text-sm text-slate-500">
              Learning nodes for{" "}
              <span className="font-semibold text-slate-700">
                {level?.name ? `Level ${level.levelNumber}: ${level.name}` : "this level"}
              </span>{" "}
              &mdash; {nodes.length} node{nodes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/levels/${levelId}/syllabus`}>
            <Button variant="outline" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Syllabus (Chapters &amp; Topics)
            </Button>
          </Link>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Node
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 max-w-sm bg-white border border-slate-200 px-3 py-2 rounded-lg">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search nodes by title or number..."
          className="outline-none text-sm w-full bg-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>XP / Coins</TableHead>
              <TableHead>Est. Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  No nodes found. Click <strong>Add Node</strong> to create the first one.
                </TableCell>
              </TableRow>
            ) : (
              filteredNodes.map((node) => (
                <TableRow key={node.id}>
                  <TableCell className="font-mono font-bold text-slate-600 text-sm">
                    N{node.nodeNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900">{node.title}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{node.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${DIFFICULTY_COLORS[node.difficulty] || ""} border font-semibold capitalize`}
                    >
                      {node.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_STYLES[node.status] || ""} border font-semibold capitalize`}>
                      {node.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="text-amber-700 font-semibold">{node.xpReward} XP</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-yellow-600 font-semibold">{node.coinsReward} 🪙</span>
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {node.estimatedDurationMinutes}m
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    {/* Full editor link (to existing node edit page) */}
                    <Link href={`/admin/nodes/${node.id}/edit`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-purple-400 text-purple-600 hover:bg-purple-50"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Edit Content
                      </Button>
                    </Link>
                    {/* Publish / Unpublish */}
                    {node.status === "published" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-amber-400 text-amber-600 hover:bg-amber-50"
                        onClick={() => unpublishMutation.mutate(node.id)}
                        disabled={unpublishMutation.isPending}
                      >
                        <EyeOff className="w-3 h-3 mr-1" />
                        Unpublish
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-emerald-400 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => publishMutation.mutate(node.id)}
                        disabled={publishMutation.isPending}
                      >
                        <Globe className="w-3 h-3 mr-1" />
                        Publish
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(node)}
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete Node ${node.nodeNumber}: "${node.title}"?`))
                          deleteMutation.mutate(node.id);
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
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setForm(defaultForm); }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Node</DialogTitle>
          </DialogHeader>
          <FormContent />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingNode && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) { setEditingNode(null); setForm(defaultForm); }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Node {editingNode.nodeNumber}: {editingNode.title}</DialogTitle>
            </DialogHeader>
            <FormContent />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
