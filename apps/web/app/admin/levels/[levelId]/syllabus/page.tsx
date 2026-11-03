"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  ListChecks,
  ExternalLink,
  Rocket,
  RefreshCw,
  FileText,
  HelpCircle,
  Code2,
  MessagesSquare,
  FolderKanban,
  TestTube2,
  Lock,
  X,
  Zap,
  Download,
  Upload,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { GenerationProgressModal, GenerationProgressJob } from "../../../_shared/generation-progress-modal";
import type { ContentStep } from "@neuravolt/shared-types";
import { SUPPORTED_LIVE_EXECUTION_LANGUAGES } from "@neuravolt/shared-types";

const RUNNABLE_LANGUAGES: readonly string[] = SUPPORTED_LIVE_EXECUTION_LANGUAGES;

interface Chapter {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  status: string;
  // Set only when Stage 2 (Chapter Detail) has been generated + approved for this chapter —
  // the Syllabus stage never writes this field, only ai.generate.chapter-detail's approval
  // does (ai-orchestration.service.ts). Used as the "detail ready" gate for Topics generation:
  // Topics prompts read this chapter's full detail, not just its one-line syllabus theme, so
  // generating Topics before it exists produces shallower output.
  objectivesSummary?: unknown | null;
  _count?: { topics: number };
}

interface GenerationStatus {
  content: boolean;
  quiz: boolean;
  challenge: boolean;
  interview: boolean;
  miniProject: boolean;
  hiddenTests: boolean;
}

interface TopicNode {
  id: string;
  title: string;
  status: string;
  generationStatus?: GenerationStatus;
}

const GENERATION_FIELDS: { key: keyof GenerationStatus; label: string; Icon: typeof FileText }[] = [
  { key: "content", label: "Content (notes + cheatsheet)", Icon: FileText },
  { key: "quiz", label: "Quiz", Icon: HelpCircle },
  { key: "challenge", label: "Coding Challenge", Icon: Code2 },
  { key: "hiddenTests", label: "Hidden Tests", Icon: TestTube2 },
  { key: "interview", label: "AI Interview Questions", Icon: MessagesSquare },
  { key: "miniProject", label: "Mini Project", Icon: FolderKanban },
];

// One glyph per pipeline output (Content/Quiz/Challenge/Hidden Tests/Interview/Mini-Project) —
// filled + colored when that field has real data (live OR pending-draft, see
// TopicService.computeGenerationStatus), a faint outline when it's still empty. This is the
// "what's actually been generated" signal the flat Generation Jobs list can't show at a glance.
function GenerationStatusBadges({ status }: { status?: GenerationStatus }) {
  if (!status) {
    return <span className="text-[10px] text-slate-400 italic">no node shell yet</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {GENERATION_FIELDS.map(({ key, label, Icon }) => {
        const done = status[key];
        return (
          <span
            key={key}
            title={`${label}: ${done ? "generated" : "not generated yet"}`}
            className={`flex items-center justify-center w-5 h-5 rounded border ${
              done
                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-300"
            }`}
          >
            <Icon className="w-3 h-3" />
          </span>
        );
      })}
    </div>
  );
}

interface Topic {
  id: string;
  title: string;
  sortOrder: number;
  status: string;
  learningObjectives?: string[] | null;
  nodes?: TopicNode[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  published: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archived: "bg-rose-100 text-rose-700 border-rose-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-300"}>
      {status}
    </Badge>
  );
}

// Reads a "Generation Jobs" style outcome and points the admin at the existing, already-working
// review page — Stage 1-3 jobs converge on the exact same approve/reject/edit flow every other
// job type already uses there (ai-orchestration.service.ts's approveJobOutput), so there is no
// separate review surface to build here.
function ChapterRow({
  levelId,
  chapter,
  onChanged,
  forceExpanded,
  livePolling,
}: {
  levelId: string;
  chapter: Chapter;
  onChanged: () => void;
  // "Generate Full Pipeline" watch mode: forces every chapter open and polls its topics so the
  // Content/Quiz/.../Mini-Project icons below fill in live, without the admin having to manually
  // expand all 5 chapters or hit Refresh over and over.
  forceExpanded?: boolean;
  livePolling?: boolean;
}) {
  const [expandedState, setExpandedState] = useState(false);
  const expanded = expandedState || !!forceExpanded;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeArmed, setPurgeArmed] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const hasDetail = !!chapter.objectivesSummary;

  const { data: topics, isLoading: topicsLoading, refetch: refetchTopics } = useQuery<Topic[]>({
    queryKey: ["admin-chapter-topics", chapter.id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/chapters/${chapter.id}/topics`);
      return data.data;
    },
    enabled: expanded,
    refetchInterval: livePolling ? 4000 : false,
  });

  const trigger = async (type: "generate-detail" | "generate-topics") => {
    setIsGenerating(true);
    try {
      await api.post(`/launchpad/admin/ai/chapters/${chapter.id}/${type}`, {});
      alert(
        `AI job queued for "${chapter.title}". Go to Generation Jobs in the sidebar to review and approve the output — approving a ${
          type === "generate-detail" ? "chapter detail" : "topic list"
        } job materializes it here automatically.`,
      );
      onChanged();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to queue AI generation job.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Danger-zone cleanup for chapters that stacked duplicate, content-less Topics from repeated
  // "Generate Topics" runs before the confirmReplace fix existed (ai-orchestration.service.ts's
  // purgeContentlessTopics — refuses outright if any topic has real content, same guard the fix
  // itself uses, so this can never wipe real work). Two distinct buttons (arm vs. confirm/cancel)
  // rather than one button that swaps label+handler — a native confirm() dialog is unreliable in
  // automated/embedded browser contexts, and reusing the same element for two different actions
  // is its own source of mis-clicks.
  const purgeDuplicates = async () => {
    setPurgeArmed(false);
    setIsPurging(true);
    setPurgeResult(null);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/chapters/${chapter.id}/purge-empty-topics`);
      setPurgeResult(`Deleted ${data.deletedTopics} topic(s) and ${data.deletedNodes} empty node(s). Click "Generate Topics" to regenerate cleanly.`);
      refetchTopics();
      onChanged();
    } catch (err: any) {
      setPurgeResult(err.response?.data?.message || "Failed to purge topics.");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-y-2 p-4 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpandedState((e) => !e)}
      >
        <div className="flex items-center gap-3 min-w-[240px] flex-1">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400 shrink-0">#{chapter.sortOrder}</span>
              <h4 className="font-bold text-slate-900" title={chapter.title}>{chapter.title}</h4>
              <StatusBadge status={chapter.status} />
              <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                {chapter._count?.topics ?? 0} topic{chapter._count?.topics === 1 ? "" : "s"}
              </span>
            </div>
            {chapter.description && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{chapter.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            disabled={isGenerating}
            onClick={() => trigger("generate-detail")}
            title="Expand this chapter's stub into a full description + objectives"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Detail
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isGenerating || !hasDetail}
            onClick={() => trigger("generate-topics")}
            title={
              hasDetail
                ? "Generate this chapter's ordered topic list"
                : 'Locked — generate this chapter\'s Detail first. Topics are written from the full chapter detail, not just its one-line syllabus theme.'
            }
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : hasDetail ? (
              <ListChecks className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            Generate Topics
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {topicsLoading ? (
            <div className="text-xs text-slate-400 py-4 text-center">Loading topics...</div>
          ) : !topics || topics.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              No topics yet — click "Generate Topics" above, then approve the job on the Generation Jobs page.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 pl-6 flex-wrap">
                {GENERATION_FIELDS.map(({ key, label, Icon }) => (
                  <span key={key} className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Icon className="w-3 h-3" /> {label}
                  </span>
                ))}
              </div>
              <div className="ml-2 pl-4 border-l-2 border-dashed border-slate-300 space-y-2">
                {topics.map((topic) => {
                  const node = topic.nodes?.[0];
                  return (
                    <div key={topic.id} className="relative">
                      <span className="absolute -left-4 top-4 w-4 border-t-2 border-dashed border-slate-300" />
                      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono text-slate-400">#{topic.sortOrder}</span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{topic.title}</span>
                          <StatusBadge status={topic.status} />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <GenerationStatusBadges status={node?.generationStatus} />
                          {node && (
                            <Link href={`/admin/nodes/${node.id}/edit`}>
                              <Button size="sm" variant="ghost" className="text-xs gap-1">
                                Open <ExternalLink className="w-3 h-3" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="pt-1 flex items-center gap-1">
            <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => refetchTopics()}>
              <RefreshCw className="w-3 h-3" /> Refresh topics
            </Button>
            {topics && topics.length > 0 && !purgeArmed && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                disabled={isPurging}
                onClick={() => setPurgeArmed(true)}
                title="Delete every topic under this chapter and start clean — refuses if any already have real content"
              >
                <X className="w-3 h-3" />
                Purge & reset topics
              </Button>
            )}
            {purgeArmed && (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">Delete all {topics?.length ?? 0} topics?</span>
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={isPurging}
                  onClick={purgeDuplicates}
                >
                  {isPurging ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, delete"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  disabled={isPurging}
                  onClick={() => setPurgeArmed(false)}
                >
                  Cancel
                </Button>
              </span>
            )}
          </div>
          {purgeResult && <p className="text-xs text-slate-500 pt-1">{purgeResult}</p>}
        </div>
      )}
    </div>
  );
}

export default function LevelSyllabusPage() {
  const { levelId } = useParams<{ levelId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [syllabusInstruction, setSyllabusInstruction] = useState("");
  const [showSyllabusInstruction, setShowSyllabusInstruction] = useState(false);
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);
  const [isGeneratingAllDetails, setIsGeneratingAllDetails] = useState(false);
  const [isGeneratingAllTopics, setIsGeneratingAllTopics] = useState(false);
  const [isGeneratingFullPipeline, setIsGeneratingFullPipeline] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState<string | null>(null);
  const [showReadinessDetails, setShowReadinessDetails] = useState(false);
  const [isStrippingDashes, setIsStrippingDashes] = useState(false);
  const [stripDashesResult, setStripDashesResult] = useState<string | null>(null);
  const [isResettingContent, setIsResettingContent] = useState(false);
  const [resetContentArmed, setResetContentArmed] = useState(false);
  const [resetContentResult, setResetContentResult] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isPublishingAllDrafts, setIsPublishingAllDrafts] = useState(false);
  const [publishAllDraftsProgress, setPublishAllDraftsProgress] = useState<{ done: number; total: number } | null>(null);
  const [publishAllDraftsResult, setPublishAllDraftsResult] = useState<string | null>(null);
  const [progressModal, setProgressModal] = useState<{
    title: string;
    rootLabel: string;
    jobs: GenerationProgressJob[];
  } | null>(null);

  const { data: level } = useQuery({
    queryKey: ["admin-level-detail", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/levels/${levelId}`);
      return data.data;
    },
  });

  const { data: chapters, isLoading, refetch: refetchChapters } = useQuery<Chapter[]>({
    queryKey: ["admin-level-chapters", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/levels/${levelId}/chapters`);
      return data.data;
    },
  });

  // Slice 6-8 (Stage 7): no generation run exists at all until Stage 1 has been triggered once —
  // that 404 is expected state for a brand-new Level, not an error to surface as one.
  const { data: readiness, refetch: refetchReadiness } = useQuery({
    queryKey: ["admin-level-readiness", levelId],
    queryFn: async () => {
      const { data } = await api.get(`/launchpad/admin/ai/levels/${levelId}/readiness`);
      return data.data;
    },
    retry: false,
    enabled: !!chapters && chapters.length > 0,
  });

  // Gate for the bulk "Generate All Topics" button (and, per-chapter, ChapterRow's own "Generate
  // Topics") — Topics generation reads each chapter's full Stage 2 detail, so running it before
  // that exists silently falls back to the one-line syllabus theme instead.
  const allChaptersHaveDetail =
    !!chapters && chapters.length > 0 && chapters.every((c) => !!c.objectivesSummary);

  // Gate for "Generate Full Pipeline" — Content/Quiz/.../Mini-Project generate against real
  // Topic Nodes, which only exist once Topics are approved.
  const allChaptersHaveTopics =
    !!chapters && chapters.length > 0 && chapters.every((c) => (c._count?.topics ?? 0) > 0);

  const refreshAll = () => {
    refetchChapters();
    refetchReadiness();
    queryClient.invalidateQueries({ queryKey: ["admin-chapter-topics"] });
  };

  // "Generate Full Pipeline" watch mode: while running, force every chapter open (via
  // ChapterRow's forceExpanded) and re-poll the whole tree every 5s so the Content/Quiz/.../
  // Mini-Project icons fill in live as approveJobOutput's auto-advance hook works through each
  // chapter's chain. Purely a UI convenience — the chain itself runs server-side regardless of
  // whether this tab stays open (Auto mode) or waits at each stage for a human to approve
  // (Manual mode, from here or the Generation Jobs page).
  useEffect(() => {
    if (!pipelineRunning) return;
    const timer = setInterval(() => refreshAll(), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineRunning]);

  const handleGenerateSyllabus = async () => {
    setIsGeneratingSyllabus(true);
    try {
      await api.post(`/launchpad/admin/ai/levels/${levelId}/generate-syllabus`, {
        instruction: syllabusInstruction.trim() || undefined,
      });
      alert(
        'Syllabus generation job queued. Go to "Generation Jobs" in the sidebar to review the chapter list and approve it — approving materializes real Chapter rows here.',
      );
      setSyllabusInstruction("");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to queue syllabus generation.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  // Both fan-out endpoints already existed on the backend (queueChapterDetailFanOut /
  // queueTopicGenerationFanOut — one job per existing chapter) but had no button anywhere,
  // leaving an admin to click "Generate Detail"/"Generate Topics" on every chapter one at a
  // time. queueChapterDetailGeneration/queueTopicGeneration dedupe per chapter, so firing this
  // twice (or after some chapters already have their detail/topics) is harmless — chapters that
  // already have a pending job just get skipped, not duplicated.
  const chapterLabel = (chapterId: string) =>
    chapters?.find((c) => c.id === chapterId)?.title || chapterId.slice(0, 8);

  const handleGenerateAllChapterDetails = async () => {
    if (!chapters || chapters.length === 0) return;
    setIsGeneratingAllDetails(true);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/levels/${levelId}/generate-chapter-details`);
      const failedCount = data?.failed?.length ?? 0;
      setProgressModal({
        title: "Generating Chapter Details",
        rootLabel: level?.name ? `L${level.levelNumber}: ${level.name}` : "This Level",
        jobs: (data?.queued || []).map((job: any) => ({ id: job.id, label: chapterLabel(job.targetId) })),
      });
      if (failedCount > 0) {
        alert(`${failedCount} chapter(s) failed to queue — check the console/logs.`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to queue chapter detail generation.");
    } finally {
      setIsGeneratingAllDetails(false);
    }
  };

  const handleGenerateAllTopics = async () => {
    if (!chapters || chapters.length === 0) return;
    setIsGeneratingAllTopics(true);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/levels/${levelId}/generate-topics`);
      const failedCount = data?.failed?.length ?? 0;
      setProgressModal({
        title: "Generating Topics",
        rootLabel: level?.name ? `L${level.levelNumber}: ${level.name}` : "This Level",
        jobs: (data?.queued || []).map((job: any) => ({ id: job.id, label: chapterLabel(job.targetId) })),
      });
      if (failedCount > 0) {
        alert(`${failedCount} chapter(s) failed to queue — check the console/logs.`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to queue topic generation.");
    } finally {
      setIsGeneratingAllTopics(false);
    }
  };

  // One click resumes every chapter's Content -> Quiz -> Challenge -> Hidden Tests -> Interview
  // -> Mini-Project chain from wherever it left off (queueFullPipelineForLevel) — each stage
  // self-queues the next one the moment it's approved (approveJobOutput's auto-advance hook),
  // so this button only ever needs to fire once per chapter's chain, not once per stage.
  const handleGenerateFullPipeline = async () => {
    if (!chapters || chapters.length === 0) return;
    setIsGeneratingFullPipeline(true);
    setPipelineSummary(null);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/levels/${levelId}/generate-full-pipeline`);
      const queuedCount = data?.queued?.length ?? 0;
      const skippedCount = data?.skipped?.length ?? 0;
      const failedCount = data?.failed?.length ?? 0;
      setPipelineSummary(
        queuedCount > 0
          ? `Started ${queuedCount} chapter(s)${skippedCount > 0 ? `, ${skippedCount} already fully complete` : ""}.` +
              (failedCount > 0 ? ` ${failedCount} chapter(s) failed to queue.` : "") +
              " Watch the tree below — it updates live."
          : `Nothing to do — all ${skippedCount} chapter(s) are already fully complete.`,
      );
      setPipelineRunning(queuedCount > 0);
      refreshAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to start the full pipeline.");
    } finally {
      setIsGeneratingFullPipeline(false);
    }
  };

  // One-off cleanup for content generated before the em/en-dash style rule existed — replaces
  // every "—"/"–" across every Chapter/Topic/Node under this Level with a comma. Only rows that
  // actually contained a dash get written back.
  const handleStripEmDashes = async () => {
    setIsStrippingDashes(true);
    setStripDashesResult(null);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/levels/${levelId}/strip-em-dashes`);
      setStripDashesResult(
        `Cleaned up ${data.chaptersUpdated} chapter(s), ${data.topicsUpdated} topic(s), and ${data.nodesUpdated} node(s).`,
      );
      refreshAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to clean up em dashes.");
    } finally {
      setIsStrippingDashes(false);
    }
  };

  // "Start clean" reset: clears every Node's Content/Quiz/Challenge/Hidden-Tests/Interview/
  // Mini-Project (and their generation jobs) under this Level, so "Generate Full Pipeline" can
  // regenerate everything fresh with every current fix applied (em-dash rule, JSON-parse repair,
  // parameterSchema, auto-retry). Chapters/Topics are never touched. Skips (never wipes) any node
  // a real student has actual progress on.
  const handleResetGeneratedContent = async () => {
    setIsResettingContent(true);
    setResetContentResult(null);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/levels/${levelId}/reset-generated-content`);
      setResetContentResult(
        `Reset ${data.nodesReset} node(s) — deleted ${data.jobsDeleted} generation job(s) and ${data.hiddenTestsDeleted} hidden test(s).` +
          (data.nodesSkipped > 0 ? ` Skipped ${data.nodesSkipped} node(s) with real student progress.` : ""),
      );
      setResetContentArmed(false);
      refreshAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reset generated content.");
    } finally {
      setIsResettingContent(false);
    }
  };

  // ── Bulk Import Content (JSON) ──────────────────────────────────────────────────────────────
  // Lets a professor hand-author a whole Level's Content offline (spreadsheet-adjacent JSON,
  // one file, every topic) instead of clicking through each node's editor one at a time. Reuses
  // the EXISTING PUT /admin/nodes/:id/draft endpoint per node — no new backend endpoint, no new
  // server-side validation to build, since saveDraft already accepts these exact fields
  // (EDITABLE_CONTENT_FIELDS) and writes them into the same draft/publish/version flow a manual
  // single-node edit goes through. Validation below mirrors the worker/API allowlist-coercion
  // pattern (never trust a claimed runnable:true) client-side, since saveDraft itself performs no
  // content-shape validation at all (same as the existing quizQuestions/codingChallenge editors).
  interface BulkImportNodeEntry {
    nodeId: string;
    title?: string;
    learningObjectives?: string[];
    notes?: string;
    cheatsheet?: string;
    codeExamples?: ContentStep[];
  }
  interface BulkImportTemplate {
    levelId: string;
    levelName?: string;
    generatedAt?: string;
    nodes: BulkImportNodeEntry[];
  }
  interface ValidatedImportRow {
    nodeId: string;
    title: string;
    payload: BulkImportNodeEntry;
    warnings: string[];
  }
  interface ImportPreview {
    valid: ValidatedImportRow[];
    errors: { nodeId: string; reason: string }[];
  }

  const [isBuildingTemplate, setIsBuildingTemplate] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Shared by Download Template and Upload validation — the full {id, title, chapter, topic} list
  // for every node under this Level, fetched fresh (chapters -> topics, not the lazily-loaded
  // per-ChapterRow query, since Download/Upload both need every chapter at once regardless of
  // which rows are currently expanded in the tree below).
  const fetchAllLevelNodes = async (): Promise<{ id: string; title: string; chapterTitle: string; topicTitle: string }[]> => {
    const { data: chaptersData } = await api.get(`/admin/levels/${levelId}/chapters`);
    const allChapters: Chapter[] = chaptersData.data;
    const topicsPerChapter = await Promise.all(
      allChapters.map((c) => api.get(`/admin/chapters/${c.id}/topics`).then((r) => ({ chapter: c, topics: r.data.data as Topic[] }))),
    );
    const rows: { id: string; title: string; chapterTitle: string; topicTitle: string }[] = [];
    for (const { chapter, topics } of topicsPerChapter) {
      for (const topic of topics) {
        for (const node of topic.nodes || []) {
          rows.push({ id: node.id, title: node.title, chapterTitle: chapter.title, topicTitle: topic.title });
        }
      }
    }
    return rows;
  };

  const handleDownloadTemplate = async () => {
    setIsBuildingTemplate(true);
    try {
      const nodeRows = await fetchAllLevelNodes();
      const fullNodes = await Promise.all(
        nodeRows.map(async (row) => {
          const { data } = await api.get(`/admin/nodes/${row.id}`);
          const node = data.data;
          // Same "draft takes priority" merge the node editor itself uses — the template should
          // reflect what an admin would currently SEE in the editor, draft or published.
          const source = node.draftContent ? { ...node, ...node.draftContent } : node;
          const entry: BulkImportNodeEntry = {
            nodeId: row.id,
            title: row.chapterTitle + " > " + row.topicTitle + " > " + row.title,
            learningObjectives: source.learningObjectives || [],
            notes: source.notes || "",
            cheatsheet: source.cheatsheet || "",
            codeExamples: Array.isArray(source.codeExamples) ? source.codeExamples : [],
          };
          return entry;
        }),
      );
      const template: BulkImportTemplate = {
        levelId: levelId as string,
        levelName: level?.name ? `L${level.levelNumber}: ${level.name}` : undefined,
        generatedAt: new Date().toISOString(),
        nodes: fullNodes,
      };
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `level-${levelId}-content-template.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to build the template — check the console.");
    } finally {
      setIsBuildingTemplate(false);
    }
  };

  const validateStep = (step: any, index: number, warnings: string[]): ContentStep | null => {
    const hasTitle = typeof step?.title === "string" && step.title.trim().length > 0;
    const hasExplanation = typeof step?.explanation === "string" && step.explanation.trim().length > 0;
    const hasCode = typeof step?.code === "string" && step.code.trim().length > 0;
    const hasLanguage = typeof step?.language === "string" && step.language.trim().length > 0;
    if (!hasTitle || !hasExplanation || !hasCode || !hasLanguage) return null;

    const language = step.language.trim();
    let runnable = !!step.runnable;
    // Never trust a claimed runnable:true — same coercion the worker/API already enforce for
    // AI-generated content, applied here so a hand-authored file can't smuggle in a language with
    // no live adapter either.
    if (runnable && !RUNNABLE_LANGUAGES.includes(language.toLowerCase())) {
      warnings.push(`Step ${index + 1} ("${step.title}"): runnable was true for unsupported language "${language}" — set to false.`);
      runnable = false;
    }

    let predictOutput: ContentStep["predictOutput"] = undefined;
    if (step.predictOutput) {
      const po = step.predictOutput;
      const optionsOk = Array.isArray(po.options) && po.options.length > 0 && po.options.every((o: any) => typeof o === "string");
      const indexOk = typeof po.correctIndex === "number" && po.correctIndex >= 0 && optionsOk && po.correctIndex < po.options.length;
      if (typeof po.question === "string" && po.question.trim() && optionsOk && indexOk) {
        predictOutput = { question: po.question, options: po.options, correctIndex: po.correctIndex };
      } else {
        warnings.push(`Step ${index + 1} ("${step.title}"): predictOutput was malformed — dropped.`);
      }
    }

    return { title: step.title, explanation: step.explanation, code: step.code, language, runnable, diagram: step.diagram || undefined, predictOutput };
  };

  const handleFileSelected = async (file: File) => {
    setImportResult(null);
    let parsed: BulkImportTemplate;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      alert("That file isn't valid JSON — check it opens cleanly in a JSON viewer first.");
      return;
    }
    if (!parsed || !Array.isArray(parsed.nodes)) {
      alert('Expected a top-level "nodes" array (same shape as the downloaded template).');
      return;
    }

    const knownNodes = await fetchAllLevelNodes();
    const knownIds = new Set(knownNodes.map((n) => n.id));
    const idToTitle = new Map(knownNodes.map((n) => [n.id, `${n.chapterTitle} > ${n.topicTitle} > ${n.title}`]));

    const valid: ValidatedImportRow[] = [];
    const errors: { nodeId: string; reason: string }[] = [];

    for (const entry of parsed.nodes) {
      const nodeId = entry?.nodeId;
      if (typeof nodeId !== "string" || !nodeId) {
        errors.push({ nodeId: String(nodeId ?? "(missing)"), reason: "Missing nodeId." });
        continue;
      }
      if (!knownIds.has(nodeId)) {
        errors.push({ nodeId, reason: "nodeId does not belong to this Level (typo, or from a different Level's template)." });
        continue;
      }

      const warnings: string[] = [];
      let codeExamples: ContentStep[] | undefined = undefined;
      if (entry.codeExamples !== undefined) {
        if (!Array.isArray(entry.codeExamples)) {
          errors.push({ nodeId, reason: "codeExamples is present but not an array." });
          continue;
        }
        const steps: ContentStep[] = [];
        let stepFailed = false;
        entry.codeExamples.forEach((step: any, i: number) => {
          const validated = validateStep(step, i, warnings);
          if (!validated) {
            stepFailed = true;
            errors.push({ nodeId, reason: `Step ${i + 1} is missing a required field (title/explanation/code/language).` });
          } else {
            steps.push(validated);
          }
        });
        if (stepFailed) continue;
        codeExamples = steps;
      }

      valid.push({
        nodeId,
        title: idToTitle.get(nodeId) || nodeId,
        payload: {
          nodeId,
          learningObjectives: Array.isArray(entry.learningObjectives) ? entry.learningObjectives : undefined,
          notes: typeof entry.notes === "string" ? entry.notes : undefined,
          cheatsheet: typeof entry.cheatsheet === "string" ? entry.cheatsheet : undefined,
          codeExamples,
        },
        warnings,
      });
    }

    setImportPreview({ valid, errors });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.valid.length === 0) return;
    setIsImporting(true);
    setImportProgress({ done: 0, total: importPreview.valid.length });
    let succeeded = 0;
    let failed = 0;
    for (const row of importPreview.valid) {
      try {
        const { payload } = row;
        await api.put(`/admin/nodes/${row.nodeId}/draft`, {
          ...(payload.learningObjectives !== undefined ? { learningObjectives: payload.learningObjectives } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
          ...(payload.cheatsheet !== undefined ? { cheatsheet: payload.cheatsheet } : {}),
          ...(payload.codeExamples !== undefined ? { codeExamples: payload.codeExamples } : {}),
        });
        succeeded++;
      } catch (e) {
        failed++;
      }
      setImportProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }
    setIsImporting(false);
    setImportPreview(null);
    setImportProgress(null);
    setImportResult(
      `Saved ${succeeded} node(s) as drafts.` +
        (failed > 0 ? ` ${failed} failed — check console/network tab and retry those.` : "") +
        " Nothing is published yet — review each node's draft and Publish (or use Launch Level) when ready.",
    );
    refreshAll();
  };

  // "Launch Level" only flips each Topic wrapper to published — computeReadiness itself requires
  // every node's OWN status to already be 'published' as a precondition (contentReady = node?.
  // status === 'published'), and nothing in the pipeline (Generate Full Pipeline, auto-approve,
  // Bulk Import) ever calls the per-node publish-draft endpoint — they only ever write drafts, by
  // design, so nothing reaches students without a deliberate publish step. For a whole Level's
  // worth of topics that means publishing 31 node drafts one click at a time with no bulk option,
  // which nobody would actually do — this loops the exact same PUT .../publish-draft endpoint the
  // single-node editor's own "Publish" button calls, once per node that currently has a draft.
  const handlePublishAllDrafts = async () => {
    if (
      !confirm(
        "Publish every node's pending draft under this Level? Each node's draft content becomes what students see immediately (before Launch Level even runs) — this is not reversible from here.",
      )
    )
      return;
    setIsPublishingAllDrafts(true);
    setPublishAllDraftsResult(null);
    try {
      const nodeRows = await fetchAllLevelNodes();
      const nodesWithDrafts: string[] = [];
      for (const row of nodeRows) {
        const { data } = await api.get(`/admin/nodes/${row.id}`);
        if (data.data?.draftContent) nodesWithDrafts.push(row.id);
      }
      setPublishAllDraftsProgress({ done: 0, total: nodesWithDrafts.length });
      let succeeded = 0;
      let failed = 0;
      for (const nodeId of nodesWithDrafts) {
        try {
          await api.post(`/admin/nodes/${nodeId}/publish-draft`);
          succeeded++;
        } catch (e) {
          failed++;
        }
        setPublishAllDraftsProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
      }
      setPublishAllDraftsResult(
        `Published ${succeeded} node draft(s).` + (failed > 0 ? ` ${failed} failed — check console/network tab.` : ""),
      );
      refreshAll();
      refetchReadiness();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to publish node drafts — check the console.");
    } finally {
      setIsPublishingAllDrafts(false);
      setPublishAllDraftsProgress(null);
    }
  };

  const handleLaunch = async () => {
    if (!confirm("Launch this Level? This publishes every approved-draft Topic — students will be able to see it.")) return;
    setIsLaunching(true);
    try {
      const { data } = await api.post(`/launchpad/admin/ai/levels/${levelId}/launch`, {});
      alert(data.message || "Level launched.");
      refreshAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to launch this Level.");
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-4">
        <span>Admin</span>
        <span>&gt;</span>
        <span className="hover:underline cursor-pointer" onClick={() => router.back()}>
          Levels
        </span>
        <span>&gt;</span>
        <span className="text-slate-900 font-bold">
          {level?.name ? `L${level.levelNumber}: ${level.name}` : "Level"} &mdash; Syllabus
        </span>
      </nav>

      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-orange-500" />
              Syllabus — Chapters &amp; Topics
            </h2>
            <p className="text-sm text-slate-500 max-w-2xl">{level?.description || "Stage 1-3 of the AI curriculum pipeline: syllabus, chapter detail, topics."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/levels/${levelId}/nodes`}>
            <Button variant="outline">Back to Node list</Button>
          </Link>
          <Link href={`/admin/levels/${levelId}/execution-tree`}>
            <Button variant="outline" className="border-indigo-500 text-indigo-600 hover:bg-indigo-50">
              Execution Tree
            </Button>
          </Link>
          <Button
            onClick={handlePublishAllDrafts}
            disabled={isPublishingAllDrafts}
            variant="outline"
            className="border-violet-300 text-violet-700 hover:bg-violet-50 flex items-center gap-1.5"
            title="Publish every node's pending draft under this Level — Launch Level itself can't run until each node is individually published."
          >
            {isPublishingAllDrafts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Publish All Node Drafts
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={isLaunching || !readiness?.ready}
            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
            title={readiness?.ready ? "Publish every approved topic" : "Not all topics are ready yet"}
          >
            {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Launch Level
          </Button>
        </div>
      </div>

      {(publishAllDraftsProgress || publishAllDraftsResult) && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
          {publishAllDraftsProgress
            ? `Publishing node drafts: ${publishAllDraftsProgress.done}/${publishAllDraftsProgress.total}...`
            : publishAllDraftsResult}
        </div>
      )}

      {readiness && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            readiness.ready ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {readiness.ready ? (
            <span className="font-semibold">Ready — all {readiness.totalTopics} topic(s) have published content, a quiz, and cleared Stage 6.</span>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowReadinessDetails((v) => !v)}
                className="flex items-center gap-1.5 font-semibold w-full text-left"
              >
                {showReadinessDetails ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                Not ready — {readiness.outstanding.length} of {readiness.totalTopics} topic(s) still outstanding
              </button>
              {showReadinessDetails && (
                <ul className="list-disc list-inside mt-1.5 space-y-0.5 pl-5">
                  {readiness.outstanding.slice(0, 8).map((o: any) => (
                    <li key={o.topicId}>
                      {o.title}
                      {!o.contentReady && " — content not published"}
                      {!o.assessmentReady && " — no quiz"}
                      {!o.stage6Clear && " — verification contract still draft"}
                    </li>
                  ))}
                  {readiness.outstanding.length > 8 && <li>...and {readiness.outstanding.length - 8} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Generate Syllabus via AI
        </h3>
        <p className="text-xs text-slate-500">
          Produces the ordered chapter skeleton for this Level (Stage 1). Optional instruction lets you steer topic
          count, ordering, or specific coverage — e.g. "include a GitHub Basics chapter at the end."
        </p>
        {showSyllabusInstruction ? (
          <div className="space-y-1">
            <textarea
              autoFocus
              value={syllabusInstruction}
              onChange={(e) => setSyllabusInstruction(e.target.value)}
              placeholder='Optional instruction, e.g. "Produce 13 chapters covering async fundamentals through production readiness, ending with a GitHub Basics chapter."'
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="button"
              onClick={() => {
                setShowSyllabusInstruction(false);
                setSyllabusInstruction("");
              }}
              className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline"
            >
              Remove instruction
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSyllabusInstruction(true)}
            className="block text-xs font-semibold text-indigo-600 hover:underline"
          >
            + Add optional instruction
          </button>
        )}
        <Button onClick={handleGenerateSyllabus} disabled={isGeneratingSyllabus} className="bg-slate-900 text-white hover:bg-slate-800">
          {isGeneratingSyllabus ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Generate Syllabus
        </Button>
      </div>

      {chapters && chapters.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-indigo-500" />
            Generate for All Chapters
          </h3>
          <p className="text-xs text-slate-500">
            Fires one job per chapter instead of clicking "Generate Detail"/"Generate Topics" on each of the{" "}
            {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} below one at a time. Safe to re-run — a
            chapter that already has a job in flight is skipped, not duplicated.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={handleGenerateAllChapterDetails} disabled={isGeneratingAllDetails} variant="outline">
              {isGeneratingAllDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Generate All Chapter Details
            </Button>
            <Button
              onClick={handleGenerateAllTopics}
              disabled={isGeneratingAllTopics || !allChaptersHaveDetail}
              variant="outline"
              title={
                allChaptersHaveDetail
                  ? undefined
                  : "Locked — generate + approve Chapter Details for every chapter first, so Topics are written from the full detail, not just the one-line syllabus theme."
              }
            >
              {isGeneratingAllTopics ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : allChaptersHaveDetail ? (
                <ListChecks className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate All Topics
            </Button>
            <Button
              onClick={handleGenerateFullPipeline}
              disabled={isGeneratingFullPipeline || !allChaptersHaveTopics}
              variant="outline"
              className="border-violet-300 text-violet-700 hover:bg-violet-50"
              title={
                allChaptersHaveTopics
                  ? "Resume every chapter's Content → Quiz → Challenge → Hidden Tests → Interview → Mini-Project chain from wherever it left off"
                  : "Locked — every chapter needs Topics first."
              }
            >
              {isGeneratingFullPipeline ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : allChaptersHaveTopics ? (
                <Zap className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate Full Pipeline
            </Button>
          </div>
          {!allChaptersHaveDetail && (
            <p className="text-[11px] text-amber-600">
              "Generate All Topics" unlocks once every chapter below has an approved Chapter Detail.
            </p>
          )}
          {allChaptersHaveDetail && !allChaptersHaveTopics && (
            <p className="text-[11px] text-amber-600">
              "Generate Full Pipeline" unlocks once every chapter below has Topics.
            </p>
          )}
          {allChaptersHaveTopics && (
            <p className="text-[11px] text-slate-400">
              "Generate Full Pipeline" resumes, per chapter, Content → Quiz → Challenge → Hidden Tests → Interview →
              Mini-Project, one Topic at a time in order — never skips ahead. In Manual mode each stage still needs
              one Approve click (here, in the tree below, or on Generation Jobs), but the next stage queues itself
              the moment you approve — no separate "generate next" click. In Auto mode it runs end to end on its own.
            </p>
          )}
          {pipelineSummary && (
            <div className="flex items-center justify-between gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              <p className="text-xs text-violet-800">{pipelineSummary}</p>
              {pipelineRunning && (
                <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => setPipelineRunning(false)}>
                  Stop watching
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {chapters && chapters.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Clean Up Formatting</h3>
          <p className="text-xs text-slate-500">
            New generations already avoid em dashes ("—"), but everything generated before that rule existed still
            has them. One-off cleanup — replaces every em/en dash across this Level's chapters, topics, and nodes
            with a comma. Safe to re-run; only rows that still contain a dash get touched.
          </p>
          <Button
            onClick={handleStripEmDashes}
            disabled={isStrippingDashes}
            variant="outline"
            className="border-slate-300"
          >
            {isStrippingDashes ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Strip Em Dashes from Existing Content
          </Button>
          {stripDashesResult && <p className="text-xs text-slate-500">{stripDashesResult}</p>}
        </div>
      )}

      {chapters && chapters.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Bulk Import Content (JSON)</h3>
          <p className="text-xs text-slate-500">
            For hand-authoring a whole Level's Content offline instead of clicking through each node's editor.
            Download a template pre-filled with every node in this Level (id + whatever content already exists),
            edit the "codeExamples" (Interactive Steps), "notes", "cheatsheet", or "learningObjectives" fields for
            each, then upload it back. Each node is validated (same rules the AI pipeline itself enforces — a
            step needs title/explanation/code/language, and "runnable" is forced back to false for any language
            without a live adapter) before you confirm anything. This only writes drafts, exactly like editing a
            node by hand — nothing is published until you review and hit Publish (or Launch Level).
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleDownloadTemplate} disabled={isBuildingTemplate} variant="outline" className="border-slate-300 flex items-center gap-1.5">
              {isBuildingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download Template
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="border-slate-300 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload & Validate
            </Button>
          </div>
          {importResult && <p className="text-xs text-slate-500">{importResult}</p>}
        </div>
      )}

      {importPreview && (
        <Dialog open={true} onOpenChange={(open) => { if (!open && !isImporting) setImportPreview(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Bulk Import</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                <strong>{importPreview.valid.length}</strong> node(s) ready to save as drafts.
              </div>

              {importPreview.errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {importPreview.errors.length} entr{importPreview.errors.length === 1 ? "y" : "ies"} skipped — will NOT be imported
                  </p>
                  <ul className="text-xs text-rose-700 space-y-1 max-h-32 overflow-y-auto">
                    {importPreview.errors.map((e, i) => (
                      <li key={i}>
                        <code className="bg-rose-100 px-1 rounded">{e.nodeId}</code>: {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.valid.some((r) => r.warnings.length > 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs font-bold text-amber-800">Auto-fixed on import:</p>
                  <ul className="text-xs text-amber-800 space-y-1 max-h-32 overflow-y-auto">
                    {importPreview.valid.flatMap((r) => r.warnings.map((w, i) => <li key={`${r.nodeId}-${i}`}>{r.title}: {w}</li>))}
                  </ul>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {importPreview.valid.map((r) => (
                  <div key={r.nodeId} className="px-3 py-2 text-xs flex items-center justify-between">
                    <span className="truncate">{r.title}</span>
                    <span className="text-slate-400 shrink-0 ml-2">{r.payload.codeExamples?.length ?? 0} step(s)</span>
                  </div>
                ))}
              </div>

              {importProgress && (
                <p className="text-xs text-slate-500">Saving {importProgress.done}/{importProgress.total}...</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportPreview(null)} disabled={isImporting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={isImporting || importPreview.valid.length === 0}
                  className="bg-slate-900 text-white"
                >
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Confirm Import ({importPreview.valid.length} node{importPreview.valid.length === 1 ? "" : "s"})
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {chapters && chapters.length > 0 && (
        <div className="bg-white border border-rose-200 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-rose-700">Danger Zone: Start Clean</h3>
          <p className="text-xs text-slate-500">
            Deletes every Node's Content, Quiz, Challenge, Hidden Tests, Interview, and Mini-Project (plus their
            generation jobs) under this Level, so "Generate Full Pipeline" can regenerate everything fresh with
            every current fix applied. Chapters and Topics are never touched. Any node a real student already has
            progress on is skipped, never wiped.
          </p>
          {!resetContentArmed ? (
            <Button
              onClick={() => setResetContentArmed(true)}
              disabled={isResettingContent}
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Reset All Generated Content
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">
                Delete Content/Quiz/Challenge/Hidden-Tests/Interview/Mini-Project for every node in this Level?
              </span>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={isResettingContent}
                onClick={handleResetGeneratedContent}
              >
                {isResettingContent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Yes, reset"}
              </Button>
              <Button size="sm" variant="outline" disabled={isResettingContent} onClick={() => setResetContentArmed(false)}>
                Cancel
              </Button>
            </div>
          )}
          {resetContentResult && <p className="text-xs text-slate-500">{resetContentResult}</p>}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            Curriculum Tree — {chapters?.length ?? 0} Chapter(s)
          </h3>
          <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={refreshAll}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Click a chapter to expand it into its topics. Each topic shows which pipeline outputs
          (Content / Quiz / Challenge / Hidden Tests / Interview / Mini-Project) have actually been
          generated — filled = present, faint outline = not yet.
        </p>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400 text-sm">Loading chapters...</div>
        ) : !chapters || chapters.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl text-slate-400 text-sm">
            No chapters yet. Generate a syllabus above, then approve it on the Generation Jobs page.
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-slate-900 text-white rounded-lg text-sm font-bold w-fit">
              <BookOpen className="w-4 h-4 text-orange-400" />
              {level?.name ? `L${level.levelNumber}: ${level.name}` : "This Level"}
            </div>
            <div className="ml-3 pl-4 border-l-2 border-slate-300 space-y-2">
              {chapters.map((chapter) => (
                <div key={chapter.id} className="relative">
                  <span className="absolute -left-4 top-6 w-4 border-t-2 border-slate-300" />
                  <ChapterRow
                    levelId={levelId}
                    chapter={chapter}
                    onChanged={refreshAll}
                    forceExpanded={pipelineRunning}
                    livePolling={pipelineRunning}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {progressModal && (
        <GenerationProgressModal
          open={true}
          onClose={() => { setProgressModal(null); refreshAll(); }}
          title={progressModal.title}
          rootLabel={progressModal.rootLabel}
          jobs={progressModal.jobs}
        />
      )}
    </div>
  );
}
