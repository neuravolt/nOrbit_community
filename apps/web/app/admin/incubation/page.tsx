"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Check, X } from "lucide-react";

export default function BuildIncubationPage() {
  const queryClient = useQueryClient();

  // Dropdown states
  const [careerId, setCareerId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [technologyId, setTechnologyId] = useState("");

  // Input states
  const [projectIdea, setProjectIdea] = useState("");
  const [difficulty, setDifficulty] = useState("beginner");
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [industry, setIndustry] = useState("");

  // Result state
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch careers
  const { data: careers } = useQuery({
    queryKey: ["admin-careers"],
    queryFn: async () => {
      const { data } = await api.get("/admin/careers");
      return data.data.items || [];
    },
  });

  // Fetch roles
  const { data: roles, refetch: refetchRoles } = useQuery({
    queryKey: ["admin-roles", careerId],
    queryFn: async () => {
      if (!careerId) return [];
      const { data } = await api.get(`/admin/careers/${careerId}/roles`);
      return data.data || [];
    },
    enabled: !!careerId,
  });

  // Fetch technologies
  const { data: technologies, refetch: refetchTech } = useQuery({
    queryKey: ["admin-technologies", roleId],
    queryFn: async () => {
      if (!roleId) return [];
      const { data } = await api.get(`/admin/roles/${roleId}/technologies`);
      return data.data || [];
    },
    enabled: !!roleId,
  });

  useEffect(() => {
    if (careerId) refetchRoles();
  }, [careerId, refetchRoles]);

  useEffect(() => {
    if (roleId) refetchTech();
  }, [roleId, refetchTech]);

  // Build mutation
  const buildMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post("/admin/build-incubation-program", payload);
      return data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setErrorMsg("");
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to generate AI Blueprint");
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await api.post(`/admin/build-incubation-program/${jobId}/approve`);
    },
    onSuccess: () => {
      alert("Blueprint approved and roadmap initialization triggered!");
      setResult(null);
      resetForm();
    },
  });

  const resetForm = () => {
    setCareerId("");
    setRoleId("");
    setTechnologyId("");
    setProjectIdea("");
    setDifficulty("beginner");
    setDurationWeeks(4);
    setIndustry("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    buildMutation.mutate({
      careerId,
      roleId,
      technologyId,
      projectIdea,
      difficulty,
      durationWeeks,
      industry,
    });
  };

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Build AI Incubation Program</h2>
        <p className="text-sm text-slate-500">Auto-design curriculum levels, nodes, and assignments based on real-world ideas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form panel */}
        <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-4">
          <h3 className="font-bold text-lg">Curriculum Builder Config</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Career Track</label>
              <select
                value={careerId}
                onChange={(e) => { setCareerId(e.target.value); setRoleId(""); setTechnologyId(""); }}
                className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
                required
              >
                <option value="">Select Career...</option>
                {(careers || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-1">Career Role</label>
              <select
                value={roleId}
                onChange={(e) => { setRoleId(e.target.value); setTechnologyId(""); }}
                className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
                required
                disabled={!careerId}
              >
                <option value="">Select Role...</option>
                {(roles || []).map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-1">Technology Stack</label>
              <select
                value={technologyId}
                onChange={(e) => setTechnologyId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
                required
                disabled={!roleId}
              >
                <option value="">Select Technology...</option>
                {(technologies || []).map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-1">Project Idea Outline</label>
              <textarea
                value={projectIdea}
                onChange={(e) => setProjectIdea(e.target.value)}
                className="w-full min-h-[100px] p-2 border border-slate-200 rounded-md text-sm"
                placeholder="Describe project idea (e.g. SaaS CRM with real-time stats)..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Duration (weeks)</label>
                <Input type="number" value={durationWeeks} onChange={(e) => setDurationWeeks(Number(e.target.value))} required />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Industry</label>
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Healthcare" required />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-2">Difficulty</label>
              <div className="flex gap-4">
                {["beginner", "intermediate", "advanced"].map((level) => (
                  <label key={level} className="flex items-center gap-1.5 text-sm capitalize font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="difficulty"
                      value={level}
                      checked={difficulty === level}
                      onChange={(e) => setDifficulty(e.target.value)}
                    />
                    {level}
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-slate-900 text-white flex items-center justify-center gap-1.5" disabled={buildMutation.isPending}>
              {buildMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Roadmap Curriculum...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Blueprint
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Output Blueprint details */}
        <div className="bg-slate-900 text-slate-100 p-6 rounded-xl flex flex-col justify-between min-h-[400px] shadow-lg border border-slate-800">
          <div>
            <h3 className="font-bold text-lg text-white mb-4">Curriculum Blueprint Result</h3>

            {errorMsg && (
              <div className="bg-rose-950/50 text-rose-300 border border-rose-900 p-4 rounded-lg text-xs space-y-2 mb-4">
                <p className="font-bold">Generation Failed</p>
                <p>{errorMsg}</p>
                <p className="text-slate-400 text-[10px]">Please verify your Gemini API Key in the "Settings & BI" integrations section.</p>
              </div>
            )}

            {!result && !buildMutation.isPending && !errorMsg && (
              <p className="text-xs text-slate-400">Specify requirements and click generate to overview AI curriculum breakdown.</p>
            )}

            {buildMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-orange-450 animate-spin" />
                <span className="text-xs text-slate-400 font-mono">Running curriculum planner agent...</span>
              </div>
            )}

            {result && (
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block mb-1">Generated Title:</span>
                  <span className="text-sm font-bold text-white">{result.blueprint?.title}</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-3 bg-slate-950 p-4 border border-slate-800 rounded-lg">
                  {result.blueprint?.levels?.map((lvl: any, i: number) => (
                    <div key={i} className="border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                      <span className="text-orange-450 font-bold">Level {lvl.levelNumber}: {lvl.name}</span>
                      <ul className="list-disc list-inside text-slate-400 pl-2 mt-1 space-y-1">
                        {lvl.nodes?.map((n: any, j: number) => (
                          <li key={j} className="truncate">{n.title} ({n.slug})</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="flex gap-2 pt-6">
              <Button onClick={() => approveMutation.mutate(result.jobId)} className="w-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> Approve & Queue
              </Button>
              <Button onClick={() => setResult(null)} variant="destructive" className="w-full flex items-center justify-center gap-1">
                <X className="w-4 h-4" /> Reject & Discard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
