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
import { Loader2, Plus, Edit, Trash2, Search, ArrowLeft, Star, ShieldCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Technology {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  defaultStack: boolean;
  sortOrder: number;
  isActive: boolean;
  // Whether verification-engine/validators/technology-adapter.ts has a PatternConfig registered
  // for this slug — the same check VerificationEngineService now throws on when missing.
  // Surfaced here so a gap is visible at Technology creation time, not only when a real
  // student's submission fails to verify.
  verificationConfigured?: boolean;
}

export default function RoleTechnologiesManagementPage() {
  const { roleId } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technology | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [defaultStack, setDefaultStack] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Fetch role details
  const { data: role } = useQuery({
    queryKey: ["admin-role-detail", roleId],
    queryFn: async () => {
      // Find role info from career roles list
      const { data } = await api.get(`/admin/careers`);
      const careersList = data.data.items || [];
      for (const career of careersList) {
        const { data: rData } = await api.get(`/admin/careers/${career.id}/roles`);
        const match = (rData.data || []).find((r: any) => r.id === roleId);
        if (match) return match;
      }
      return null;
    },
  });

  // Fetch technologies under role
  const { data: technologies, isLoading, isError, error, refetch } = useQuery<Technology[]>({
    queryKey: ["admin-role-technologies", roleId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/roles/${roleId}/technologies`);
      return data.data || [];
    },
  });

  // Create technology mutation
  const createMutation = useMutation({
    mutationFn: async (newTech: Partial<Technology>) => {
      await api.post(`/admin/roles/${roleId}/technologies`, newTech);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-technologies", roleId] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert("Failed to create technology: " + (err.response?.data?.message || err.message));
    },
  });

  // Update technology mutation
  const updateMutation = useMutation({
    mutationFn: async (updated: Partial<Technology> & { id: string }) => {
      await api.put(`/admin/technologies/${updated.id}`, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-technologies", roleId] });
      setEditingTech(null);
      resetForm();
    },
    onError: (err: any) => {
      alert("Failed to update technology: " + (err.response?.data?.message || err.message));
    },
  });

  // Set default stack stack mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/admin/technologies/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-technologies", roleId] });
    },
  });

  // Delete technology mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/technologies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-technologies", roleId] });
    },
  });

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setIcon("");
    setSortOrder(0);
    setDefaultStack(false);
    setIsActive(true);
  };

  const handleEdit = (tech: Technology) => {
    setEditingTech(tech);
    setName(tech.name);
    setSlug(tech.slug);
    setDescription(tech.description || "");
    setIcon(tech.icon || "");
    setSortOrder(tech.sortOrder);
    setDefaultStack(tech.defaultStack);
    setIsActive(tech.isActive);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      slug,
      description,
      icon,
      sortOrder,
      defaultStack,
      isActive,
    };
    if (editingTech) {
      updateMutation.mutate({ id: editingTech.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredTechs = (technologies || [])
    .filter((t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

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
          <p className="font-semibold text-rose-700">Failed to load technologies</p>
          <p className="text-sm text-rose-600">
            {(error as any)?.response?.data?.message || (error as any)?.message || "Unknown error"}
          </p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 text-slate-800">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-4">
        <span>Admin</span>
        <span>&gt;</span>
        <Link href="/admin/careers" className="hover:underline">Careers</Link>
        <span>&gt;</span>
        <span className="hover:underline cursor-pointer" onClick={() => router.back()}>Roles</span>
        <span>&gt;</span>
        <span className="text-slate-700">{role?.name || "Role"}</span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">Technologies</span>
      </nav>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Technology Config</h2>
            <p className="text-sm text-slate-500">Configure curriculum languages and tech stacks for {role?.name || "Career Role"}.</p>
          </div>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add Technology
        </Button>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Technology Stack</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Node.js" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Slug</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. nodejs" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] p-2 border border-slate-200 rounded-md text-sm"
                  placeholder="Incubation outline for this technology..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Icon Identifier</label>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="code" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={defaultStack} onChange={(e) => setDefaultStack(e.target.checked)} id="isDefaultStack" />
                  <label htmlFor="isDefaultStack" className="text-sm font-semibold cursor-pointer">Default Stack for Role</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActiveTech" />
                  <label htmlFor="isActiveTech" className="text-sm font-semibold cursor-pointer">Active and Visible</label>
                </div>
              </div>
              <Button type="submit" className="w-full bg-slate-900 text-white mt-4" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Technology"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm bg-white border border-slate-200 px-3 py-2 rounded-lg">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search technologies by name..."
          className="outline-none text-sm w-full bg-transparent"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Default Stack</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTechs.map((tech) => (
              <TableRow key={tech.id}>
                <TableCell className="font-semibold text-slate-900">{tech.name}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs">{tech.slug}</TableCell>
                <TableCell className="text-slate-600 max-w-xs truncate">{tech.description || "-"}</TableCell>
                <TableCell>{tech.sortOrder}</TableCell>
                <TableCell>
                  {tech.defaultStack ? (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 font-bold flex items-center gap-1 w-fit">
                      <Star className="w-3 h-3 fill-amber-600 stroke-amber-600" /> Default
                    </Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-xs text-slate-400 font-semibold" onClick={() => setDefaultMutation.mutate(tech.id)}>
                      Set Default
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {tech.verificationConfigured ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1 w-fit"
                      title="A verification adapter (PatternConfig) is registered for this technology's slug — challenge submissions can be graded."
                    >
                      <ShieldCheck className="w-3 h-3" /> Configured
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1 w-fit"
                      title={`No verification adapter registered for slug "${tech.slug}" yet — a developer needs to add a PatternConfig + TECHNOLOGY_ADAPTERS entry (apps/api/src/modules/verification-engine/validators/technology-adapter.ts) before challenges for this technology can be graded. Until then, a student submission for it will fail loudly rather than being silently graded wrong.`}
                    >
                      <ShieldAlert className="w-3 h-3" /> Not configured
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={tech.isActive ? "default" : "secondary"}>
                    {tech.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Link href={`/admin/technologies/${tech.id}/levels`}>
                    <Button variant="outline" size="sm" className="text-xs border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700">Manage Curriculum</Button>
                  </Link>
                  <Button variant="outline" size="icon" onClick={() => handleEdit(tech)}>
                    <Edit className="w-3.5 h-3.5 text-slate-600" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => { if (confirm("Soft delete this technology?")) deleteMutation.mutate(tech.id); }}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingTech && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingTech(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Technology Details</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Slug</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] p-2 border border-slate-200 rounded-md text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Icon Identifier</label>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={defaultStack} onChange={(e) => setDefaultStack(e.target.checked)} id="isDefaultStackEdit" />
                  <label htmlFor="isDefaultStackEdit" className="text-sm font-semibold cursor-pointer">Default Stack for Role</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActiveTechEdit" />
                  <label htmlFor="isActiveTechEdit" className="text-sm font-semibold cursor-pointer">Active and Visible</label>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingTech(null)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
