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
import { Loader2, Plus, Edit, Trash2, Search, ArrowUpDown, Shield } from "lucide-react";
import Link from "next/link";

interface Career {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
}

export default function CareerManagementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<Career | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Fetch careers
  const { data: careers, isLoading, isError, error, refetch } = useQuery<Career[]>({
    queryKey: ["admin-careers"],
    queryFn: async () => {
      const { data } = await api.get("/admin/careers");
      return data.data.items || [];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (newCareer: Partial<Career>) => {
      await api.post("/admin/careers", newCareer);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-careers"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert("Failed to create career: " + (err.response?.data?.message || err.message));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updated: Partial<Career> & { id: string }) => {
      await api.put(`/admin/careers/${updated.id}`, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-careers"] });
      setEditingCareer(null);
      resetForm();
    },
    onError: (err: any) => {
      alert("Failed to update career: " + (err.response?.data?.message || err.message));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/careers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-careers"] });
    },
    onError: (err: any) => {
      alert("Failed to delete career: " + (err.response?.data?.message || err.message));
    },
  });

  const resetForm = () => {
    setName("");
    setSlug("");
    setDescription("");
    setColor("#3B82F6");
    setSortOrder(0);
    setIsActive(true);
  };

  const handleEdit = (career: Career) => {
    setEditingCareer(career);
    setName(career.name);
    setSlug(career.slug);
    setDescription(career.description || "");
    setColor(career.color || "#3B82F6");
    setSortOrder(career.sortOrder);
    setIsActive(career.isActive);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCareer) {
      updateMutation.mutate({
        id: editingCareer.id,
        name,
        slug,
        description,
        color,
        sortOrder,
        isActive,
      });
    } else {
      createMutation.mutate({
        name,
        slug,
        description,
        color,
        sortOrder,
        isActive,
      });
    }
  };

  const filteredCareers = (careers || [])
    .filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchTerm.toLowerCase())
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
          <p className="font-semibold text-rose-700">Failed to load careers</p>
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Career Track Settings</h2>
          <p className="text-sm text-slate-500">Configure incubation career tracks and archetypes.</p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add New Career
        </Button>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Career Track</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Technology" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Slug</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. technology" required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] p-2 border border-slate-200 rounded-md text-sm"
                  placeholder="Details about career archetype..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Color (HEX)</label>
                  <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActive" />
                <label htmlFor="isActive" className="text-sm font-semibold cursor-pointer">Active and Visible</label>
              </div>
              <Button type="submit" className="w-full bg-slate-900 text-white mt-4">Create Track</Button>
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
          placeholder="Search by name or slug..."
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
              <TableHead>Preview</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCareers.map((career) => (
              <TableRow key={career.id}>
                <TableCell className="font-semibold text-slate-900">{career.name}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs">{career.slug}</TableCell>
                <TableCell className="text-slate-600 max-w-xs truncate">{career.description || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full border border-slate-300 block" style={{ backgroundColor: career.color || "#ccc" }} />
                    <span className="text-xs font-mono">{career.color}</span>
                  </div>
                </TableCell>
                <TableCell>{career.sortOrder}</TableCell>
                <TableCell>
                  <Badge variant={career.isActive ? "default" : "secondary"}>
                    {career.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Link href={`/admin/careers/${career.id}/roles`}>
                    <Button variant="outline" size="sm" className="text-xs">Configure Roles</Button>
                  </Link>
                  <Button variant="outline" size="icon" onClick={() => handleEdit(career)}>
                    <Edit className="w-3.5 h-3.5 text-slate-600" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => { if (confirm("Soft delete this career?")) deleteMutation.mutate(career.id); }}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingCareer && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingCareer(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Career Track</DialogTitle>
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
                  <label className="text-xs font-bold uppercase block mb-1">Color (HEX)</label>
                  <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Sort Order</label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActiveEdit" />
                <label htmlFor="isActiveEdit" className="text-sm font-semibold cursor-pointer">Active and Visible</label>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingCareer(null)}>Cancel</Button>
                <Button type="submit" className="bg-slate-900 text-white">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
