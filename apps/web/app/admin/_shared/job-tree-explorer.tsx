// A left-nav tree + right detail panel (the standard master-detail pattern) for browsing one
// Level's AI pipeline output — Syllabus -> Chapters -> Topics -> Content/Quiz/Challenge/Hidden-
// Tests/Interview/Mini-Project/Verification-Contract. Replaces the earlier boxes-and-arrows
// diagram: that laid the whole fan-out out flat, which worked as a diagram but made "is anything
// here waiting on me" and "let me read this one topic's content" both slower than they should be.
// Selecting a tree row (a job, a topic, a chapter, or the syllabus root) shows every job under it
// as a card in the Response tab — a Topic has up to 7 of these, which is the real shape of the
// data; forcing one-job-per-screen would hide that a topic's quiz was never generated at all.
import React, { useMemo, useState } from "react";
import {
  ChevronRight, ChevronDown, FileText, HelpCircle, Code2, TestTube2, MessagesSquare,
  FolderKanban, ShieldCheck, ListChecks, BookOpen, Layers, Check, X, Loader2, Link2,
} from "lucide-react";
import NextLink from "next/link";
import { AIGenerationJob, JOB_TYPE_LABELS, JobOutputView, getJobProvider } from "./job-output-view";
import { buildJobTree, ChapterGroup, TopicGroup } from "./job-tree";

const JOB_ICONS: Record<string, typeof FileText> = {
  "ai.generate.syllabus": BookOpen,
  "ai.generate.chapter-detail": Layers,
  "ai.generate.topics": ListChecks,
  "ai.generate.content": FileText,
  "ai.generate.quiz": HelpCircle,
  "ai.generate.challenge": Code2,
  "ai.generate.hidden-tests": TestTube2,
  "ai.generate.interview": MessagesSquare,
  "ai.generate.mini-project": FolderKanban,
  "ai.generate.verification-contract": ShieldCheck,
};

interface DotStatus {
  color: string;
  label: string;
}
const RANK_ORDER = ["Failed", "Pending", "In Progress", "Completed", "Rejected", "Approved"];

function jobDotStatus(job: AIGenerationJob): DotStatus {
  if (job.status === "failed") return { color: "bg-rose-500", label: "Failed" };
  if (job.status === "queued") return { color: "bg-amber-400", label: "Pending" };
  if (job.status === "processing") return { color: "bg-violet-500", label: "In Progress" };
  if (job.reviewStatus === "approved") return { color: "bg-emerald-500", label: "Approved" };
  if (job.reviewStatus === "rejected") return { color: "bg-rose-400", label: "Rejected" };
  return { color: "bg-blue-500", label: "Completed" };
}
function aggregateDotStatus(jobs: AIGenerationJob[]): DotStatus {
  if (jobs.length === 0) return { color: "bg-slate-300", label: "Empty" };
  let worst = jobDotStatus(jobs[0]);
  for (const job of jobs.slice(1)) {
    const s = jobDotStatus(job);
    if (RANK_ORDER.indexOf(s.label) < RANK_ORDER.indexOf(worst.label)) worst = s;
  }
  return worst;
}

const canReview = (job: AIGenerationJob) => job.status === "completed" && (!job.reviewStatus || job.reviewStatus === "pending");

interface Selection {
  kind: "syllabus" | "chapter" | "topic" | "job";
  title: string;
  nodeType: string;
  breadcrumb: string[];
  jobs: AIGenerationJob[];
}

function Dot({ status }: { status: DotStatus }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${status.color}`} title={status.label} />;
}

function TreeRow({
  depth, icon: Icon, label, dot, selected, expandable, expanded, onToggleExpand, onSelect,
}: {
  depth: number; icon?: typeof FileText; label: string; dot: DotStatus; selected: boolean;
  expandable?: boolean; expanded?: boolean; onToggleExpand?: () => void; onSelect: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 py-1.5 rounded-md cursor-pointer text-sm ${selected ? "bg-indigo-50 text-indigo-900 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
      style={{ paddingLeft: 8 + depth * 16 }}
      onClick={onSelect}
    >
      {expandable ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
          className="p-0.5 rounded hover:bg-slate-200 shrink-0"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </button>
      ) : (
        <span className="w-[18px] shrink-0" />
      )}
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      <Dot status={dot} />
      <span className="truncate">{label}</span>
    </div>
  );
}

export function JobTreeExplorer({
  jobs, levelLabel, onApprove, onReject, onRetry, approvingId, rejectingId, retryingId,
}: {
  jobs: AIGenerationJob[];
  levelLabel: string;
  onApprove?: (job: AIGenerationJob) => void;
  onReject?: (job: AIGenerationJob) => void;
  onRetry?: (job: AIGenerationJob) => void;
  approvingId?: string;
  rejectingId?: string;
  retryingId?: string;
}) {
  const tree = useMemo(() => buildJobTree(jobs), [jobs]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["syllabus"]));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTab] = useState<"response" | "metadata" | "request">("response");

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const select = (s: Selection) => {
    setSelection(s);
    setTab("response");
  };

  const selectSyllabus = () =>
    select({ kind: "syllabus", title: "Syllabus", nodeType: "Level", breadcrumb: [levelLabel], jobs: tree.syllabusJobs });
  const selectChapter = (chapter: ChapterGroup, i: number) =>
    select({
      kind: "chapter",
      title: `Chapter ${i + 1}: ${chapter.chapterTitle}`,
      nodeType: "Chapter",
      breadcrumb: [levelLabel, chapter.chapterTitle],
      jobs: chapter.chapterJobs,
    });
  const selectTopic = (chapter: ChapterGroup, ci: number, topic: TopicGroup, ti: number) =>
    select({
      kind: "topic",
      title: `Topic ${ci + 1}.${ti + 1}: ${topic.topicTitle}`,
      nodeType: "Topic",
      breadcrumb: [levelLabel, chapter.chapterTitle, topic.topicTitle],
      jobs: topic.jobs,
    });
  const selectJob = (chapter: ChapterGroup | null, topic: TopicGroup | null, job: AIGenerationJob) =>
    select({
      kind: "job",
      title: JOB_TYPE_LABELS[job.jobType] || job.jobType,
      nodeType: JOB_TYPE_LABELS[job.jobType] || job.jobType,
      breadcrumb: [levelLabel, chapter?.chapterTitle, topic?.topicTitle, JOB_TYPE_LABELS[job.jobType]].filter(Boolean) as string[],
      jobs: [job],
    });

  // A topic-scoped job's targetId is the LaunchpadRoadmapNode it generates content for
  // (ai-orchestration.service.ts's targetType 'NODE') — safe to link to its editor whenever the
  // current selection is exactly one such job.
  const editableNodeId =
    selection?.jobs.length === 1 && selection.jobs[0].targetType === "NODE" ? selection.jobs[0].targetId : null;

  return (
    <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[500px]">
      <div className="w-72 shrink-0 bg-white border border-slate-200 rounded-xl overflow-y-auto p-2">
        <TreeRow
          depth={0}
          icon={BookOpen}
          label={`Syllabus: ${levelLabel}`}
          dot={aggregateDotStatus(tree.syllabusJobs)}
          selected={selection?.kind === "syllabus"}
          expandable
          expanded={expanded.has("syllabus")}
          onToggleExpand={() => toggle("syllabus")}
          onSelect={selectSyllabus}
        />
        {expanded.has("syllabus") &&
          tree.chapters.map((chapter, ci) => {
            const chapterKey = `chapter-${ci}`;
            const allChapterJobs = [...chapter.chapterJobs, ...chapter.topics.flatMap((t) => t.jobs)];
            return (
              <React.Fragment key={chapterKey}>
                <TreeRow
                  depth={1}
                  icon={Layers}
                  label={`Chapter ${ci + 1}: ${chapter.chapterTitle}`}
                  dot={aggregateDotStatus(allChapterJobs)}
                  selected={selection?.kind === "chapter" && selection.title.startsWith(`Chapter ${ci + 1}:`)}
                  expandable
                  expanded={expanded.has(chapterKey)}
                  onToggleExpand={() => toggle(chapterKey)}
                  onSelect={() => selectChapter(chapter, ci)}
                />
                {expanded.has(chapterKey) && (
                  <>
                    {chapter.chapterJobs.map((job) => (
                      <TreeRow
                        key={job.id}
                        depth={2}
                        icon={JOB_ICONS[job.jobType] || FileText}
                        label={JOB_TYPE_LABELS[job.jobType] || job.jobType}
                        dot={jobDotStatus(job)}
                        selected={selection?.kind === "job" && selection.jobs[0]?.id === job.id}
                        onSelect={() => selectJob(chapter, null, job)}
                      />
                    ))}
                    {chapter.topics.map((topic, ti) => {
                      const topicKey = `${chapterKey}-topic-${ti}`;
                      return (
                        <React.Fragment key={topicKey}>
                          <TreeRow
                            depth={2}
                            icon={FileText}
                            label={`Topic ${ci + 1}.${ti + 1}: ${topic.topicTitle}`}
                            dot={aggregateDotStatus(topic.jobs)}
                            selected={selection?.kind === "topic" && selection.title.startsWith(`Topic ${ci + 1}.${ti + 1}:`)}
                            expandable
                            expanded={expanded.has(topicKey)}
                            onToggleExpand={() => toggle(topicKey)}
                            onSelect={() => selectTopic(chapter, ci, topic, ti)}
                          />
                          {expanded.has(topicKey) &&
                            topic.jobs.map((job) => (
                              <TreeRow
                                key={job.id}
                                depth={3}
                                icon={JOB_ICONS[job.jobType] || FileText}
                                label={JOB_TYPE_LABELS[job.jobType] || job.jobType}
                                dot={jobDotStatus(job)}
                                selected={selection?.kind === "job" && selection.jobs[0]?.id === job.id}
                                onSelect={() => selectJob(chapter, topic, job)}
                              />
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </>
                )}
              </React.Fragment>
            );
          })}
        <div className="border-t border-slate-100 mt-2 pt-2 px-2 flex flex-wrap gap-x-3 gap-y-1">
          {[
            { label: "Approved", color: "bg-emerald-500" },
            { label: "Completed", color: "bg-blue-500" },
            { label: "Pending", color: "bg-amber-400" },
            { label: "In Progress", color: "bg-violet-500" },
            { label: "Rejected", color: "bg-rose-400" },
            { label: "Failed", color: "bg-rose-500" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} /> {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl overflow-y-auto">
        {!selection ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            Pick anything on the left to see what's been generated for it.
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="text-xs text-slate-400 flex items-center gap-1 flex-wrap">
              {selection.breadcrumb.map((b, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  <span className={i === selection.breadcrumb.length - 1 ? "text-slate-600 font-semibold" : ""}>{b}</span>
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{selection.title}</h3>
                <Dot status={aggregateDotStatus(selection.jobs)} />
                <span className="text-xs font-semibold text-slate-500">{aggregateDotStatus(selection.jobs).label}</span>
              </div>
              {editableNodeId && (
                <NextLink href={`/admin/nodes/${editableNodeId}/edit`}>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                    <Link2 className="w-3.5 h-3.5" /> Edit Node
                  </span>
                </NextLink>
              )}
            </div>

            <div className="flex items-center gap-4 border-b border-slate-200 text-sm font-semibold">
              {(["response", "metadata", "request"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2 -mb-px border-b-2 ${tab === t ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  {t === "response" ? "Response" : t === "metadata" ? "Metadata" : "Request Details"}
                </button>
              ))}
            </div>

            {selection.jobs.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-6">Nothing generated here yet.</p>
            ) : tab === "response" ? (
              <div className="space-y-4">
                {selection.jobs.map((job) => {
                  const status = jobDotStatus(job);
                  const provider = getJobProvider(job);
                  const reviewable = canReview(job) && (onApprove || onReject);
                  return (
                    <div key={job.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-wrap">
                        <span className="font-bold text-sm text-slate-800">{JOB_TYPE_LABELS[job.jobType] || job.jobType}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${status.color.replace("bg-", "border-")} ${status.color.replace("bg-", "text-")} bg-white`}>
                          {status.label}
                        </span>
                        {provider && <span className="text-[10px] font-semibold text-slate-400 uppercase">{provider}</span>}
                        {job.errorMessage && <span className="text-[10px] text-rose-600">{job.errorMessage}</span>}
                        <div className="ml-auto flex items-center gap-1.5">
                          {job.status === "failed" && onRetry && (
                            <button
                              onClick={() => onRetry(job)}
                              disabled={retryingId === job.id}
                              className="px-2 py-1 rounded border border-slate-300 text-slate-600 text-[10px] font-semibold hover:bg-slate-50 disabled:opacity-50"
                            >
                              {retryingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Retry"}
                            </button>
                          )}
                          {reviewable && (
                            <>
                            {onReject && (
                              <button
                                onClick={() => onReject(job)}
                                disabled={approvingId === job.id || rejectingId === job.id}
                                className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                title="Reject"
                              >
                                {rejectingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {onApprove && (
                              <button
                                onClick={() => onApprove(job)}
                                disabled={approvingId === job.id || rejectingId === job.id}
                                className="p-1 rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                title="Approve"
                              >
                                {approvingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        {job.outputData ? <JobOutputView job={job} /> : <p className="text-sm text-slate-400 italic">No output yet.</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : tab === "metadata" ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="text-left font-bold px-3 py-2">Job Type</th>
                      <th className="text-left font-bold px-3 py-2">Status</th>
                      <th className="text-left font-bold px-3 py-2">Review</th>
                      <th className="text-left font-bold px-3 py-2">Provider</th>
                      <th className="text-left font-bold px-3 py-2">Requests</th>
                      <th className="text-left font-bold px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selection.jobs.map((job) => (
                      <tr key={job.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold">{JOB_TYPE_LABELS[job.jobType] || job.jobType}</td>
                        <td className="px-3 py-2">{job.status}</td>
                        <td className="px-3 py-2">{job.reviewStatus || "—"}</td>
                        <td className="px-3 py-2 uppercase text-slate-500">{getJobProvider(job) || "—"}</td>
                        <td className="px-3 py-2">{job.retryCount + 1}</td>
                        <td className="px-3 py-2 text-slate-500">{new Date(job.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {selection.jobs.map((job) => (
                  <details key={job.id} className="border border-slate-200 rounded-lg" open={selection.jobs.length === 1}>
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold bg-slate-50">
                      {JOB_TYPE_LABELS[job.jobType] || job.jobType} — request payload
                    </summary>
                    <pre className="p-3 text-xs overflow-x-auto max-h-80 overflow-y-auto">{JSON.stringify(job.inputData, null, 2)}</pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
