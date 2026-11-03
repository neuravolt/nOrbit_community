"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Save, Plus, Trash2, UploadCloud, XCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ContentStep } from "@neuravolt/shared-types";
import { SUPPORTED_LIVE_EXECUTION_LANGUAGES } from "@neuravolt/shared-types";

const RUNNABLE_LANGUAGES: readonly string[] = SUPPORTED_LIVE_EXECUTION_LANGUAGES;

function emptyStep(): ContentStep {
  return { title: "", explanation: "", code: "", language: "jsx", runnable: false };
}

// Manual authoring surface for the interactive-content redesign's ContentStep[] shape (stored on
// the same codeExamples field the AI pipeline writes) — one card per step, matching the same
// "add/edit/remove" pattern Learning Objectives already uses on this page. Built because the
// professor plans to hand-author whole curricula here, not just review AI output, so a raw JSON
// textarea (the cheaper fallback used for quizQuestions/codingChallenge) would be the wrong tool.
function StepEditor({ steps, onChange }: { steps: ContentStep[]; onChange: (next: ContentStep[]) => void }) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const updateStep = (index: number, patch: Partial<ContentStep>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addStep = () => {
    onChange([...steps, emptyStep()]);
    setCollapsed((prev) => ({ ...prev, [steps.length]: false }));
  };

  const isRunnableEligible = (language: string) => RUNNABLE_LANGUAGES.includes(language.trim().toLowerCase());

  const updatePredictOutput = (index: number, patch: Partial<NonNullable<ContentStep["predictOutput"]>>) => {
    const step = steps[index];
    const current = step.predictOutput || { question: "", options: ["", ""], correctIndex: 0 };
    updateStep(index, { predictOutput: { ...current, ...patch } });
  };

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          No interactive steps yet. Add one below, or use "Generate Content via AI" above to draft a full set.
        </p>
      )}
      {steps.map((step, i) => {
        const isCollapsed = !!collapsed[i];
        const eligible = isRunnableEligible(step.language);
        return (
          <div key={i} className="border border-slate-200 rounded-lg bg-slate-50/60 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [i]: !prev[i] }))}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-700 flex-1 text-left min-w-0"
              >
                {isCollapsed ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronUp className="w-4 h-4 shrink-0" />}
                <span className="truncate">Step {i + 1}{step.title ? ` — ${step.title}` : " (untitled)"}</span>
                {step.runnable && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                    live
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, -1)} disabled={i === 0} title="Move up">
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} title="Move down">
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(i)} title="Delete step">
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                </Button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Title</label>
                  <Input value={step.title} onChange={(e) => updateStep(i, { title: e.target.value })} placeholder="e.g. Your First Component" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Explanation</label>
                  <textarea
                    value={step.explanation}
                    onChange={(e) => updateStep(i, { explanation: e.target.value })}
                    className="w-full min-h-[70px] p-2 border border-slate-200 rounded-md text-sm"
                    placeholder="1-3 sentences — the only prose for this step."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase block mb-1">Language</label>
                    <Input value={step.language} onChange={(e) => updateStep(i, { language: e.target.value })} placeholder="jsx, javascript, html, css..." />
                  </div>
                  <div className="flex flex-col justify-end pb-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase">
                      <input
                        type="checkbox"
                        checked={step.runnable && eligible}
                        disabled={!eligible}
                        onChange={(e) => updateStep(i, { runnable: e.target.checked })}
                        className="accent-indigo-600"
                      />
                      Runnable (live editor)
                    </label>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {eligible
                        ? "Code must end with render(<YourComponent />)."
                        : `Only supported for: ${RUNNABLE_LANGUAGES.join(", ")}.`}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Code</label>
                  <textarea
                    value={step.code}
                    onChange={(e) => updateStep(i, { code: e.target.value })}
                    className="w-full min-h-[120px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-white"
                    placeholder="One complete, self-contained example, runnable exactly as shown."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Diagram (optional, Mermaid syntax)</label>
                  <textarea
                    value={step.diagram || ""}
                    onChange={(e) => updateStep(i, { diagram: e.target.value || undefined })}
                    className="w-full min-h-[60px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-white"
                    placeholder="flowchart TD&#10;  A[Idea] --> B[Result]"
                  />
                </div>

                {/* predictOutput only ever renders to students on a non-runnable step (see
                    ContentStepPlayer) — offered here regardless of the runnable checkbox so an
                    author can fill it in before flipping runnable off. */}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase">Predict-the-output check (shown when not runnable)</label>
                    {step.predictOutput ? (
                      <button
                        type="button"
                        className="text-xs text-rose-600 font-semibold"
                        onClick={() => updateStep(i, { predictOutput: undefined })}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-indigo-600 font-semibold"
                        onClick={() => updatePredictOutput(i, {})}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  {step.predictOutput && (
                    <div className="space-y-2 bg-white border border-slate-200 rounded-md p-3">
                      <Input
                        value={step.predictOutput.question}
                        onChange={(e) => updatePredictOutput(i, { question: e.target.value })}
                        placeholder="e.g. What does this log to the console?"
                      />
                      <div className="space-y-1.5">
                        {step.predictOutput.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${i}`}
                              checked={step.predictOutput!.correctIndex === oi}
                              onChange={() => updatePredictOutput(i, { correctIndex: oi })}
                              title="Correct answer"
                            />
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const options = step.predictOutput!.options.map((o, j) => (j === oi ? e.target.value : o));
                                updatePredictOutput(i, { options });
                              }}
                              className="text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const options = step.predictOutput!.options.filter((_, j) => j !== oi);
                                const correctIndex = step.predictOutput!.correctIndex >= options.length ? 0 : step.predictOutput!.correctIndex;
                                updatePredictOutput(i, { options, correctIndex });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-indigo-600 font-semibold"
                        onClick={() => updatePredictOutput(i, { options: [...step.predictOutput!.options, ""] })}
                      >
                        + Add option
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" onClick={addStep} className="flex items-center gap-1.5">
        <Plus className="w-4 h-4" /> Add Step
      </Button>
    </div>
  );
}

export default function NodeEditorPage() {
  const { nodeId } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");

  // Form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [nodeNumber, setNodeNumber] = useState(1);
  const [status, setStatus] = useState("draft");
  const [difficulty, setDifficulty] = useState("beginner");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(60);

  // Learning Content
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [cheatsheet, setCheatsheet] = useState("");
  const [codeExamples, setCodeExamples] = useState<ContentStep[]>([]);

  // JSON configs
  const [quizQuestions, setQuizQuestions] = useState("");
  const [codingChallenge, setCodingChallenge] = useState("");
  const [validationRules, setValidationRules] = useState("");

  // AI Generation Trigger
  const [isGenerating, setIsGenerating] = useState(false);
  // Slice 5B-4: previously this endpoint's request body was ignored entirely — every
  // regeneration ran the same fixed template with no way for a professor to steer it. One
  // shared field, since all three "Generate via AI" buttons below (content/quiz/challenge) can
  // now use it — an empty instruction reproduces the exact prior behavior.
  const [aiInstruction, setAiInstruction] = useState("");
  const handleTriggerAiGeneration = async (type: string) => {
    setIsGenerating(true);
    try {
      await api.post(`/launchpad/admin/ai/nodes/${nodeId}/generate/${type}`, {
        instruction: aiInstruction.trim() || undefined,
      });
      alert("AI Generation Job queued successfully! Go to 'Generation Jobs' page in the sidebar to review the output and approve it — approving saves it as a draft here, which you still need to Publish separately.");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to trigger AI generation job.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Rewards
  const [xpReward, setXpReward] = useState(100);
  const [coinsReward, setCoinsReward] = useState(50);

  // Fetch node details
  const { data: node, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-node-detail", nodeId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/nodes/${nodeId}`);
      return data.data;
    },
  });

  // Slice 5B-12: unresolved stale-dependency markers — a yellow badge only, never anything
  // automatic. §3's explicit lock: nothing reads these and acts on its own; the professor
  // resolves each one explicitly below.
  const { data: quizStaleMarkers, refetch: refetchQuizMarkers } = useQuery({
    queryKey: ["admin-node-stale-markers", nodeId, "quiz"],
    queryFn: async () => {
      const { data } = await api.get(`/admin/nodes/${nodeId}/stale-markers/quiz`);
      return data.data as any[];
    },
  });
  const { data: challengeStaleMarkers, refetch: refetchChallengeMarkers } = useQuery({
    queryKey: ["admin-node-stale-markers", nodeId, "challenge"],
    queryFn: async () => {
      const { data } = await api.get(`/admin/nodes/${nodeId}/stale-markers/challenge`);
      return data.data as any[];
    },
  });
  const resolveStaleMarker = async (markerId: string, decision: "REGENERATE" | "KEEP" | "EDIT_MANUALLY") => {
    await api.post(`/admin/stale-markers/${markerId}/resolve`, { decision });
    refetchQuizMarkers();
    refetchChallengeMarkers();
  };

  // Slice 6-9 (Full review UI): version history, compare, restore, and instruction history — all
  // reading LaunchpadContentVersion rows 5B-1 already writes on every draft save/publish/restore.
  const { data: versions, isLoading: versionsLoading, refetch: refetchVersions } = useQuery({
    queryKey: ["admin-node-versions", nodeId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/nodes/${nodeId}/versions`);
      return data.data as any[];
    },
    enabled: activeTab === "history",
  });
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{ a: any; b: any } | null>(null);
  const toggleCompareSelection = (versionId: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(versionId)) return prev.filter((id) => id !== versionId);
      if (prev.length >= 2) return [prev[1], versionId]; // keep the selection at exactly 2, newest wins
      return [...prev, versionId];
    });
  };
  const runCompare = async () => {
    if (compareSelection.length !== 2) return;
    const [idA, idB] = compareSelection;
    const [a, b] = await Promise.all([
      api.get(`/admin/nodes/${nodeId}/versions/${idA}`).then((r) => r.data.data),
      api.get(`/admin/nodes/${nodeId}/versions/${idB}`).then((r) => r.data.data),
    ]);
    // Always show the older version first, regardless of click order.
    setCompareResult(a.versionNumber <= b.versionNumber ? { a, b } : { a: b, b: a });
  };
  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await api.post(`/admin/nodes/${nodeId}/versions/${versionId}/restore`, {
        expectedVersion: node?.version,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-node-detail", nodeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-node-versions", nodeId] });
      alert("Version restored as a new published version.");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to restore this version — it may have changed since you loaded this history. Reload and try again.");
    },
  });

  // Phase 1B: a pending draft (node.draftContent) takes priority over the published content
  // when populating the form — "resume editing where you left off" — falling back to the
  // published fields when there is no draft. Either way this only ever changes what the form
  // *shows*; nothing here writes anything, so published content is never touched just by
  // opening the editor.
  const hasDraft = !!node?.draftContent;
  const source = hasDraft ? { ...node, ...node.draftContent } : node;

  // Populate data
  useEffect(() => {
    if (source) {
      setTitle(source.title || "");
      setSlug(source.slug || "");
      setDescription(source.description || "");
      setNodeNumber(node.nodeNumber || 1); // structural field, always from the live row — see roadmap-node.service.ts
      setStatus(node.status || "draft"); // status/version are publish-owned, not part of draft content
      setDifficulty(source.difficulty || "beginner");
      setEstimatedDurationMinutes(source.estimatedDurationMinutes || 60);
      setLearningObjectives(source.learningObjectives || []);
      setNotes(source.notes || "");
      setCheatsheet(source.cheatsheet || "");
      // Old-shape codeExamples ({title, code, language, explanation?}) never had a real
      // `explanation` string requirement — loading it into this editor would silently strip the
      // fields it doesn't know about the moment it's edited and saved. Only populate from
      // genuinely new-shape steps; an old-shape array starts this editor empty rather than
      // guessing at a conversion, same call the frontend student page's isContentStepArray makes.
      const rawExamples = Array.isArray(source.codeExamples) ? source.codeExamples : [];
      const looksLikeSteps = rawExamples.every((s: any) => s && typeof s.title === "string" && typeof s.explanation === "string");
      setCodeExamples(looksLikeSteps ? rawExamples : []);
      setXpReward(source.xpReward || 100);
      setCoinsReward(source.coinsReward || 50);

      // Populate JSON states
      setQuizQuestions(source.quizQuestions ? JSON.stringify(source.quizQuestions, null, 2) : "");
      setCodingChallenge(source.codingChallenge ? JSON.stringify(source.codingChallenge, null, 2) : "");
      setValidationRules(source.validationRules ? JSON.stringify(source.validationRules, null, 2) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  // Phase 1B: saves to draftContent only — published content is untouched by this call.
  const saveDraftMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      await api.put(`/admin/nodes/${nodeId}/draft`, updatedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-node-detail", nodeId] });
      alert("Draft saved. Published content is unchanged — click Publish when ready.");
    },
    onError: (err: any) => {
      alert("Failed to save draft: " + (err.response?.data?.message || err.message));
    },
  });

  // Phase 1B: applies the last-saved draft to the live/published fields, bumps version.
  const publishDraftMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/nodes/${nodeId}/publish-draft`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-node-detail", nodeId] });
      alert("Draft published — this is now the live content students see.");
    },
    onError: (err: any) => {
      alert("Failed to publish: " + (err.response?.data?.message || err.message));
    },
  });

  const discardDraftMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/nodes/${nodeId}/draft`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-node-detail", nodeId] });
    },
    onError: (err: any) => {
      alert("Failed to discard draft: " + (err.response?.data?.message || err.message));
    },
  });

  const handleSaveDraft = () => {
    let quizJson = null;
    let challengeJson = null;
    let validationJson = null;

    try {
      if (quizQuestions.trim()) quizJson = JSON.parse(quizQuestions);
    } catch (e) {
      alert("Invalid JSON format in Assessment Settings!");
      return;
    }

    try {
      if (codingChallenge.trim()) challengeJson = JSON.parse(codingChallenge);
    } catch (e) {
      alert("Invalid JSON format in Coding Challenge tab!");
      return;
    }

    try {
      if (validationRules.trim()) validationJson = JSON.parse(validationRules);
    } catch (e) {
      alert("Invalid JSON format in Validation Rules!");
      return;
    }

    saveDraftMutation.mutate({
      title,
      slug,
      description,
      difficulty,
      estimatedDurationMinutes,
      learningObjectives,
      notes,
      cheatsheet,
      codeExamples,
      xpReward,
      coinsReward,
      quizQuestions: quizJson,
      codingChallenge: challengeJson,
      validationRules: validationJson,
    });
  };

  const addObjective = () => {
    if (newObjective.trim()) {
      setLearningObjectives([...learningObjectives, newObjective.trim()]);
      setNewObjective("");
    }
  };

  const removeObjective = (index: number) => {
    setLearningObjectives(learningObjectives.filter((_, i) => i !== index));
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
          <p className="font-semibold text-rose-700">Failed to load node</p>
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
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">Edit Roadmap Node</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Published v{node?.version ?? 1}
              </span>
              {hasDraft ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <UploadCloud className="w-3 h-3" />
                  Draft pending
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  No pending draft
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">Configure learning materials, MCQs, coding challenges, and rewards.</p>
            {hasDraft && (
              <p className="text-xs text-amber-700 mt-1">
                You're viewing unpublished draft content. Students still see the published version until you click Publish.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasDraft && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Discard the pending draft? This cannot be undone.")) discardDraftMutation.mutate();
              }}
              disabled={discardDraftMutation.isPending}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Discard Draft
            </Button>
          )}
          <Button
            onClick={handleSaveDraft}
            disabled={saveDraftMutation.isPending}
            className="bg-slate-900 text-white flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={() => publishDraftMutation.mutate()}
            disabled={!hasDraft || publishDraftMutation.isPending}
            className="bg-orange-500 text-white flex items-center gap-1.5 disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            {publishDraftMutation.isPending ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {/* Slice 5B-4: shared instruction field for AI regeneration — applies to whichever of the
          Content/Quiz/Challenge "Generate via AI" buttons below is clicked next. */}
      <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
        <label className="text-xs font-bold uppercase block mb-1 text-indigo-900">
          Instruction for AI regeneration (optional)
        </label>
        <Input
          value={aiInstruction}
          onChange={(e) => setAiInstruction(e.target.value)}
          placeholder="e.g. Make the explanation more practical and add a real-world example"
          className="bg-white"
        />
        <p className="text-xs text-indigo-700 mt-1">
          Applies to the next "Generate via AI" click, on any tab below. Leave blank to regenerate with the default prompt.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 gap-6">
        {["basic", "content", "assessment", "challenge", "rewards", "validation", "history"].map((tab) => {
          const staleCount =
            tab === "assessment" ? quizStaleMarkers?.length : tab === "challenge" ? challengeStaleMarkers?.length : 0;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-bold capitalize transition-colors flex items-center gap-1.5 ${
                activeTab === tab ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab}
              {!!staleCount && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500"
                  title="Content this depends on has changed since it was last generated/approved"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 p-6 rounded-xl space-y-6">
        {activeTab === "basic" && (
          <div className="space-y-4 max-w-xl">
            <h3 className="font-bold text-lg">Basic Information</h3>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Slug</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
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
                <label className="text-xs font-bold uppercase block mb-1">Node Number</label>
                <Input type="number" value={nodeNumber} onChange={(e) => setNodeNumber(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase block mb-1">Duration (minutes)</label>
                <Input type="number" value={estimatedDurationMinutes} onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "content" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg">Learning Content</h3>
              <Button
                onClick={() => handleTriggerAiGeneration("content")}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 text-xs"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "✨ Generate Content via AI"}
              </Button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-1">Learning Objectives</label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="e.g. Master Git rebase operations"
                />
                <Button onClick={addObjective} variant="outline">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              <ul className="space-y-2">
                {learningObjectives.map((obj, i) => (
                  <li key={i} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-sm">
                    <span>{obj}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeObjective(i)}>
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="text-xs font-bold uppercase">Interactive Steps</label>
                <span className="text-[11px] text-slate-500">
                  The primary teaching content — one small idea + one complete example per step.
                </span>
              </div>
              <StepEditor steps={codeExamples} onChange={setCodeExamples} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-1">Notes (Markdown, short overview)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[100px] p-2 border border-slate-200 rounded-md font-mono text-sm"
                placeholder="2-4 sentences on what this topic covers — the Interactive Steps above are the real content now."
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase block mb-1">Cheatsheet (Markdown)</label>
              <textarea
                value={cheatsheet}
                onChange={(e) => setCheatsheet(e.target.value)}
                className="w-full min-h-[150px] p-2 border border-slate-200 rounded-md font-mono text-sm"
                placeholder="Cheat Sheet commands..."
              />
            </div>
          </div>
        )}

        {activeTab === "assessment" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg">Assessment Settings</h3>
              <Button
                onClick={() => handleTriggerAiGeneration("quiz")}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 text-xs"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "✨ Generate Quiz via AI"}
              </Button>
            </div>
            {!!quizStaleMarkers?.length && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-md p-3 flex items-center justify-between gap-3">
                <span>⚠ The topic's content changed since this quiz was last generated/reviewed — it may no longer match.</span>
                <div className="flex gap-2 shrink-0">
                  <button className="underline font-semibold" onClick={() => resolveStaleMarker(quizStaleMarkers[0].id, "REGENERATE")}>Regenerate</button>
                  <button className="underline font-semibold" onClick={() => resolveStaleMarker(quizStaleMarkers[0].id, "KEEP")}>Keep as-is</button>
                  <button className="underline font-semibold" onClick={() => resolveStaleMarker(quizStaleMarkers[0].id, "EDIT_MANUALLY")}>I'll edit manually</button>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500">Add quiz questions and AI interview checklist guidelines.</p>
            <textarea
              value={quizQuestions}
              onChange={(e) => setQuizQuestions(e.target.value)}
              className="w-full min-h-[250px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
              placeholder='[ { "question": "What is git?", "options": ["A tool", "A database", "A language", "A framework"], "correctAnswer": 0 } ]'
            />
          </div>
        )}

        {activeTab === "challenge" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg">Coding Challenge & Project</h3>
              <Button
                onClick={() => handleTriggerAiGeneration("challenge")}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 text-xs"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "✨ Generate Challenge via AI"}
              </Button>
            </div>
            {!!challengeStaleMarkers?.length && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-md p-3 flex items-center justify-between gap-3">
                <span>⚠ The topic's content changed since this challenge was last generated/reviewed — it may no longer match.</span>
                <div className="flex gap-2 shrink-0">
                  <button className="underline font-semibold" onClick={() => resolveStaleMarker(challengeStaleMarkers[0].id, "REGENERATE")}>Regenerate</button>
                  <button className="underline font-semibold" onClick={() => resolveStaleMarker(challengeStaleMarkers[0].id, "KEEP")}>Keep as-is</button>
                  <button className="underline font-semibold" onClick={() => resolveStaleMarker(challengeStaleMarkers[0].id, "EDIT_MANUALLY")}>I'll edit manually</button>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500">Configure starter code bases and hidden automated validation tests.</p>
            <textarea
              value={codingChallenge}
              onChange={(e) => setCodingChallenge(e.target.value)}
              className="w-full min-h-[250px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
              placeholder='{ "objective": "Build a REST endpoint...", "requirements": ["route:GET /books"], "evaluationCriteria": ["Returns valid JSON"], "hints": [], "resources": [], "expectedSkills": [] }'
            />
          </div>
        )}

        {activeTab === "rewards" && (
          <div className="space-y-4 max-w-md">
            <h3 className="font-bold text-lg">Rewards Config</h3>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">XP Reward</label>
              <Input type="number" value={xpReward} onChange={(e) => setXpReward(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Coins Reward</label>
              <Input type="number" value={coinsReward} onChange={(e) => setCoinsReward(Number(e.target.value))} />
            </div>
          </div>
        )}

        {activeTab === "validation" && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Validation Rules</h3>
            <textarea
              value={validationRules}
              onChange={(e) => setValidationRules(e.target.value)}
              className="w-full min-h-[200px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
              placeholder='{ "githubRequired": true, "testsRequired": true, "buildRequired": true }'
            />
          </div>
        )}

        {/* Slice 6-9: version history, compare, restore, and instruction history — reads
            LaunchpadContentVersion rows 5B-1 already writes on every draft save/publish/restore. */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg">Version History</h3>
                <p className="text-sm text-slate-500">Every save, publish, and restore is a new version — nothing is ever overwritten.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => refetchVersions()}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={compareSelection.length !== 2}
                  onClick={runCompare}
                >
                  Compare Selected ({compareSelection.length}/2)
                </Button>
              </div>
            </div>

            {versionsLoading && <p className="text-sm text-slate-500">Loading version history…</p>}
            {!versionsLoading && (versions || []).length === 0 && (
              <p className="text-sm text-slate-500">No versions yet — save a draft or publish to start this node&apos;s history.</p>
            )}

            <div className="space-y-2">
              {(versions || []).map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                  <input
                    type="checkbox"
                    checked={compareSelection.includes(v.id)}
                    onChange={() => toggleCompareSelection(v.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">v{v.versionNumber}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border capitalize ${
                        v.status === "published" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        {v.status}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                        {v.source}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    {/* Instruction history: the professor's own regeneration instruction, verbatim, per version. */}
                    {v.instruction && (
                      <p className="text-xs text-slate-600 mt-1 italic">&quot;{v.instruction}&quot;</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Restore v${v.versionNumber}? This publishes its content as a brand-new version — nothing in the history is deleted or overwritten.`)) {
                        restoreVersionMutation.mutate(v.id);
                      }
                    }}
                    disabled={restoreVersionMutation.isPending}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>

            {compareResult && (
              <Dialog open={true} onOpenChange={(open) => { if (!open) setCompareResult(null); }}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      Comparing v{compareResult.a.versionNumber} → v{compareResult.b.versionNumber}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    {Array.from(new Set([...Object.keys(compareResult.a.content || {}), ...Object.keys(compareResult.b.content || {})])).map((field) => {
                      const aVal = JSON.stringify(compareResult!.a.content?.[field] ?? null, null, 2);
                      const bVal = JSON.stringify(compareResult!.b.content?.[field] ?? null, null, 2);
                      const changed = aVal !== bVal;
                      return (
                        <div key={field} className={`p-3 rounded-lg border ${changed ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                          <p className="text-xs font-bold uppercase mb-2">{field}{changed ? " — changed" : ""}</p>
                          {changed ? (
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                              <pre className="p-2 bg-white border border-rose-200 rounded overflow-x-auto whitespace-pre-wrap">{aVal}</pre>
                              <pre className="p-2 bg-white border border-emerald-200 rounded overflow-x-auto whitespace-pre-wrap">{bVal}</pre>
                            </div>
                          ) : (
                            <pre className="p-2 bg-white border border-slate-200 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">{aVal}</pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
