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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit, Trash2, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface CareerRole {
  id: string;
  careerId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export default function CareerRoleManagementPage() {
  const { careerId } = useParams();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CareerRole | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Fetch career info
  const { data: career } = useQuery({
    queryKey: ["admin-career", careerId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/careers`);
      const list = data.data.items || [];
      return list.find((c: any) => c.id === careerId);
    },
  });

  // Fetch career roles
  const { data: roles, isLoading, isError, error, refetch } = useQuery<CareerRole[]>({
    queryKey: ["admin-roles", careerId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/careers/${careerId}/roles`);
      return data.data || [];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newRole: Partial<CareerRole>) => {
      await api.post(`/admin/careers/${careerId}/roles`, newRole);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles", careerId] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updated: Partial<CareerRole> & { id: string }) => {
      await api.put(`/admin/roles/${updated.id}`, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles", careerId] });
      setEditingRole(null);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles", careerId] });
    },
  });

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setIcon("");
    setSortOrder(0);
    setIsActive(true);
  };

  const handleEdit = (role: CareerRole) => {
    setEditingRole(role);
    setName(role.name);
    setSlug(role.slug);
    setDescription(role.description || "");
    setIcon(role.icon || "");
    setSortOrder(role.sortOrder);
    setIsActive(role.isActive);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateMutation.mutate({
        id: editingRole.id,
        name,
        slug,
        description,
        icon,
        sortOrder,
        isActive,
      });
    } else {
      createMutation.mutate({
        name,
        slug,
        description,
        icon,
        sortOrder,
        isActive,
      });
    }
  };

  const filteredRoles = (roles || [])
    .filter((r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchTerm.toLowerCase())
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
          <p className="font-semibold text-rose-700">Failed to load roles</p>
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
        <span className="text-slate-700">{career?.name || "Career Track"}</span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">Roles</span>
      </nav>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/admin/careers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Role Management</h2>
            <p className="text-sm text-slate-500">Configure roles linked to {career?.name || "Career Track"}.</p>
          </div>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add New Role
        </Button>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Career Role</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backend Engineer" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Slug</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. backend-engineer" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] p-2 border border-slate-200 rounded-md text-sm"
                  placeholder="Details about role requirements..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Icon (URL/Lucide Name)</label>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="code" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActiveRole" />
                <label htmlFor="isActiveRole" className="text-sm font-semibold cursor-pointer">Active and Visible</label>
              </div>
              <Button type="submit" className="w-full bg-slate-900 text-white mt-4">Create Role</Button>
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
          placeholder="Search roles by name or slug..."
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
              <TableHead>Icon</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-semibold text-slate-900">{role.name}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs">{role.slug}</TableCell>
                <TableCell className="text-slate-600 max-w-xs truncate">{role.description || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{role.icon || "-"}</TableCell>
                <TableCell>{role.sortOrder}</TableCell>
                <TableCell>
                  <Badge variant={role.isActive ? "default" : "secondary"}>
                    {role.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Link href={`/admin/roles/${role.id}/technologies`}>
                    <Button variant="outline" size="sm" className="text-xs">Configure Techs</Button>
                  </Link>
                  <Button variant="outline" size="icon" onClick={() => handleEdit(role)}>
                    <Edit className="w-3.5 h-3.5 text-slate-600" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => { if (confirm("Soft delete this role?")) deleteMutation.mutate(role.id); }}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingRole && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingRole(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Career Role</DialogTitle>
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
                  <label className="text-xs font-bold uppercase block mb-1">Icon (URL/Lucide Name)</label>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActiveRoleEdit" />
                <label htmlFor="isActiveRoleEdit" className="text-sm font-semibold cursor-pointer">Active and Visible</label>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
