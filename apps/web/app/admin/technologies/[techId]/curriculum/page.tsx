"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Edit2, Play, Lock, Eye, EyeOff, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Node {
  id: string;
  nodeNumber: number;
  title: string;
  slug: string;
  description?: string;
  status: "draft" | "published";
  difficulty: string;
}

interface Level {
  id: string;
  levelNumber: number;
  name: string;
  estimatedDurationHours?: number;
  difficulty: string;
  description?: string;
  nodes: Node[];
}

export default function TechCurriculumManagementPage() {
  const { techId } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch technology info
  const { data: tech } = useQuery({
    queryKey: ["admin-tech-info", techId],
    queryFn: async () => {
      // Find technology details from active careers & roles
      const { data } = await api.get(`/admin/careers`);
      const careersList = data.data.items || [];
      for (const career of careersList) {
        const { data: rData } = await api.get(`/admin/careers/${career.id}/roles`);
        for (const role of rData.data || []) {
          const { data: tData } = await api.get(`/admin/roles/${role.id}/technologies`);
          const match = (tData.data || []).find((t: any) => t.id === techId);
          if (match) return match;
        }
      }
      return null;
    },
  });

  // Fetch levels and nodes recursively
  const { data: curriculum, isLoading, isError, error, refetch } = useQuery<Level[]>({
    queryKey: ["admin-curriculum", techId],
    queryFn: async () => {
      const { data: levelsData } = await api.get(`/admin/technologies/${techId}/levels`);
      const levelsList = levelsData.data || [];

      // Fetch nodes for each level
      const levelsWithNodes = await Promise.all(
        levelsList.map(async (level: any) => {
          const { data: nodesData } = await api.get(`/admin/levels/${level.id}/nodes`);
          return {
            ...level,
            nodes: nodesData.data || [],
          };
        })
      );

      return levelsWithNodes;
    },
  });

  // Publish node mutation
  const publishMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      await api.patch(`/admin/nodes/${nodeId}/publish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum", techId] });
    },
  });

  // Unpublish node mutation
  const unpublishMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      await api.patch(`/admin/nodes/${nodeId}/unpublish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum", techId] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100 font-bold">Published</Badge>;
      case "draft":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-100 font-bold">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
          <p className="font-semibold text-rose-700">Failed to load curriculum</p>
          <p className="text-sm text-rose-600">
            {(error as any)?.response?.data?.message || (error as any)?.message || "Unknown error"}
          </p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 text-slate-800 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-4">
        <span>Admin</span>
        <span>&gt;</span>
        <Link href="/admin/careers" className="hover:underline">Careers</Link>
        <span>&gt;</span>
        <span className="hover:underline cursor-pointer" onClick={() => router.back()}>Technologies</span>
        <span>&gt;</span>
        <span className="text-slate-700">{tech?.name || "Technology"}</span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">Curriculum</span>
      </nav>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{tech?.name} Curriculum</h2>
            <p className="text-sm text-slate-500">Manage levels and curriculum roadmap node details for student tree pipelines.</p>
          </div>
        </div>
      </div>

      {/* Levels and nodes timeline tree */}
      <div className="space-y-10 relative pl-6 border-l border-slate-200 mt-6">
        {(curriculum || []).map((level) => (
          <div key={level.id} className="space-y-4 relative">
            {/* Dot marker on vertical timeline line */}
            <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-4 border-white block" />

            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Level {level.levelNumber}: {level.name}
              </h3>
              {level.description && (
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">{level.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {level.nodes.map((node) => (
                <Card key={node.id} className="border border-slate-200 bg-white hover:shadow-sm transition-all p-5 flex flex-col justify-between min-h-[140px]">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 font-mono">NODE #{node.nodeNumber}</span>
                      {getStatusBadge(node.status)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{node.title}</h4>
                      <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                        {node.description || "Master topics, tests, and code reviews."}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{node.difficulty}</span>
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/admin/nodes/${node.id}/edit`}>
                        <Button size="sm" variant="outline" className="text-xs flex items-center gap-1">
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Node</span>
                        </Button>
                      </Link>

                      {node.status === "draft" ? (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-500 text-white text-xs flex items-center gap-1"
                          onClick={() => publishMutation.mutate(node.id)}
                          disabled={publishMutation.isPending}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Publish</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-slate-700 hover:bg-slate-600 text-white text-xs flex items-center gap-1"
                          onClick={() => unpublishMutation.mutate(node.id)}
                          disabled={unpublishMutation.isPending}
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>Unpublish</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              {level.nodes.length === 0 && (
                <div className="col-span-full border-2 border-dashed border-slate-100 rounded-xl p-8 text-center text-slate-400 text-sm">
                  No nodes configured for this level. Generate program or add nodes manually.
                </div>
              )}
            </div>
          </div>
        ))}

        {(!curriculum || curriculum.length === 0) && (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500">
            No levels found. Go to Incubation Program page to build the blueprint first.
          </div>
        )}
      </div>
    </div>
  );
}
