"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X, Pencil } from "lucide-react";

interface LaunchpadLevel {
  id: string;
  level: number;
  name: string;
  displayName: string;
  description?: string | null;
  minPoints: number;
  maxPoints?: number | null;
  statusType: string;
  isActive: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  TRAINEE: "bg-slate-100 text-slate-700 border-slate-300",
  ASSOCIATE: "bg-blue-100 text-blue-700 border-blue-300",
  INTERN: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export default function StudentLevelsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<LaunchpadLevel>>({});

  const { data: levels, isLoading } = useQuery<LaunchpadLevel[]>({
    queryKey: ["admin-student-levels"],
    queryFn: async () => {
      const { data } = await api.get("/launchpad/admin/levels");
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<LaunchpadLevel> }) => {
      const { data } = await api.patch(`/launchpad/admin/levels/${id}`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-student-levels"] });
      setEditingId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to save level.");
    },
  });

  const startEdit = (lvl: LaunchpadLevel) => {
    setEditingId(lvl.id);
    setDraft({
      name: lvl.name,
      displayName: lvl.displayName,
      description: lvl.description || "",
      minPoints: lvl.minPoints,
      statusType: lvl.statusType,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, dto: draft });
  };

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Student Level Ladder</h2>
        <p className="text-sm text-slate-500">
          The global 1-15 progression ladder (points thresholds, career-stage status, titles) shown on the student
          dashboard. Edits here take effect immediately — no code change or redeploy needed.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-bold uppercase text-slate-500">
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Min Points</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin inline-block" />
                </td>
              </tr>
            ) : (
              (levels || []).map((lvl) => {
                const editing = editingId === lvl.id;
                return (
                  <tr key={lvl.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">#{lvl.level}</td>
                    <td className="px-4 py-2.5">
                      {editing ? (
                        <input
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                          value={draft.displayName ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">{lvl.displayName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-xs">
                      {editing ? (
                        <input
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                          value={draft.description ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                        />
                      ) : (
                        lvl.description
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {editing ? (
                        <input
                          type="number"
                          className="w-24 border border-slate-300 rounded px-2 py-1 text-sm"
                          value={draft.minPoints ?? 0}
                          onChange={(e) => setDraft((d) => ({ ...d, minPoints: Number(e.target.value) }))}
                        />
                      ) : (
                        lvl.minPoints
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {editing ? (
                        <select
                          className="border border-slate-300 rounded px-2 py-1 text-sm"
                          value={draft.statusType ?? lvl.statusType}
                          onChange={(e) => setDraft((d) => ({ ...d, statusType: e.target.value }))}
                        >
                          <option value="TRAINEE">TRAINEE</option>
                          <option value="ASSOCIATE">ASSOCIATE</option>
                          <option value="INTERN">INTERN</option>
                        </select>
                      ) : (
                        <Badge variant="outline" className={STATUS_STYLES[lvl.statusType] || ""}>
                          {lvl.statusType}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editing ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(lvl.id)}
                            disabled={updateMutation.isPending}
                            className="bg-slate-900 text-white hover:bg-slate-800"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(lvl)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
