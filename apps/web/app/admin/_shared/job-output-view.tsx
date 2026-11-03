// Shared between /admin/generation-jobs (flat review queue) and /admin/levels/[levelId]/
// execution-tree (the fan-out tree view) — both render the exact same AI job shape and need
// the exact same "what did the model actually produce" renderer. Extracted rather than
// duplicated so a new job type only needs handling in one place.
import React from "react";

export interface AIGenerationJob {
  id: string;
  jobType: string;
  status: string;
  targetType: string;
  targetId: string;
  retryCount: number;
  inputData: any;
  outputData?: any;
  errorMessage?: string;
  reviewStatus?: string;
  createdAt: string;
}

// The job-type levels whose own generated output IS the chapter/level itself — these never
// append a leaf title, unlike topic-scoped jobs (content/quiz/challenge/etc.) which do.
export const STRUCTURAL_JOB_TYPES = new Set(["ai.generate.syllabus", "ai.generate.chapter-detail", "ai.generate.topics"]);

export const JOB_TYPE_LABELS: Record<string, string> = {
  "ai.generate.levels": "Suggested Levels",
  "ai.generate.syllabus": "Syllabus",
  "ai.generate.chapter-detail": "Chapter Detail",
  "ai.generate.topics": "Topics",
  "ai.generate.content": "Content",
  "ai.generate.quiz": "Quiz",
  "ai.generate.challenge": "Challenge",
  "ai.generate.hidden-tests": "Hidden Tests",
  "ai.generate.interview": "Interview",
  "ai.generate.mini-project": "Mini-Project",
  "ai.generate.verification-contract": "Verification Contract",
  "ai.generate.planner": "Planner",
};

// GenerationContextBuilder already puts the full Career → Role → Technology → Level → Chapter →
// Topic ancestry on every job's inputData.context — this was sitting unused. No backend change
// needed: just read what's already there instead of showing a bare truncated UUID.
export function getJobBreadcrumb(job: AIGenerationJob): string {
  return getJobBreadcrumbParts(job).join(" › ");
}

// Same ancestry as getJobBreadcrumb, as an array — the tree explorer renders it as a real
// breadcrumb trail (separate clickable/visual segments) rather than one joined string.
export function getJobBreadcrumbParts(job: AIGenerationJob): string[] {
  const ctx = job.inputData?.context;
  const parts: string[] = [];
  if (ctx?.technology?.name) parts.push(ctx.technology.name);
  if (ctx?.level?.name) parts.push(ctx.level.name);
  if (ctx?.chapter?.title) parts.push(ctx.chapter.title);
  if (!STRUCTURAL_JOB_TYPES.has(job.jobType) && job.inputData?.topic) {
    parts.push(job.inputData.topic);
  }
  if (parts.length === 0) {
    return [`${job.targetType} (${job.targetId ? job.targetId.substring(0, 8) : "N/A"})`];
  }
  // A node authored before the Chapter/Topic pipeline has no real chapter — the context builder
  // falls back to the node's own title for that slot too, showing it twice back-to-back.
  return parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
}

// Which provider (Gemini or the LongCat fallback) actually served this job — persisted onto
// outputData._meta by apps/worker's callGemini since it's additive and never leaked into the
// node's real content fields (roadmap-node.service.ts's pickEditableContent uses an explicit
// allowlist that _meta isn't part of). null for any job generated before that started, or one
// whose outputData isn't populated yet.
export function getJobProvider(job: AIGenerationJob): string | null {
  return job.outputData?._meta?.provider ?? null;
}

// Renders each job type's real output shape readably instead of a raw JSON dump — the thing
// a reviewer actually needs to judge before approving. Falls back to raw JSON for any shape
// this doesn't recognize yet, so nothing is ever hidden.
export function JobOutputView({ job }: { job: AIGenerationJob }) {
  const out = job.outputData;
  if (!out) return null;
  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
  const Prose = ({ text }: { text?: string }) =>
    text ? <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{text}</pre> : null;

  switch (job.jobType) {
    case "ai.generate.levels": {
      const levels = Array.isArray(out.levels) ? out.levels : [];
      return (
        <div className="space-y-3 font-sans">
          <Section label={`${levels.length} Level(s) proposed`}>
            <ol className="list-decimal list-inside space-y-2">
              {levels.map((l: any, i: number) => (
                <li key={i}>
                  <span className="font-semibold">{l.name}</span>
                  {l.difficulty && <span className="text-[10px] text-slate-400 ml-1">({l.difficulty}{l.estimatedDurationHours ? `, ${l.estimatedDurationHours}h` : ""})</span>}
                  {l.description && <div className="text-slate-500 ml-5">{l.description}</div>}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      );
    }
    case "ai.generate.syllabus": {
      const chapters = Array.isArray(out.chapters) ? out.chapters : [];
      return (
        <div className="space-y-3 font-sans">
          <Section label={`${chapters.length} Chapter(s) proposed`}>
            <ol className="list-decimal list-inside space-y-2">
              {chapters.map((c: any, i: number) => (
                <li key={i}><span className="font-semibold">{c.title}</span>{c.theme && <span className="text-slate-500"> — {c.theme}</span>}</li>
              ))}
            </ol>
          </Section>
        </div>
      );
    }
    case "ai.generate.chapter-detail": {
      return (
        <div className="space-y-3 font-sans">
          <Section label="Description"><Prose text={out.description} /></Section>
          {Array.isArray(out.learningObjectives) && out.learningObjectives.length > 0 && (
            <Section label="Learning objectives">
              <ul className="list-disc list-inside space-y-0.5">
                {out.learningObjectives.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </Section>
          )}
          {out.estimatedDurationHours && <Section label="Estimated duration">{out.estimatedDurationHours} hour(s)</Section>}
        </div>
      );
    }
    case "ai.generate.topics": {
      const topics = Array.isArray(out.topics) ? out.topics : [];
      return (
        <div className="space-y-3 font-sans">
          <Section label={`${topics.length} Topic(s) proposed`}>
            <ol className="list-decimal list-inside space-y-2">
              {topics.map((t: any, i: number) => (
                <li key={i}>
                  <span className="font-semibold">{t.title}</span>
                  {t.objective && <div className="text-slate-500 ml-5">{t.objective}</div>}
                  {Array.isArray(t.prerequisiteTopicTitles) && t.prerequisiteTopicTitles.length > 0 && (
                    <div className="text-[11px] text-slate-400 ml-5">Needs: {t.prerequisiteTopicTitles.join(", ")}</div>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      );
    }
    case "ai.generate.content": {
      return (
        <div className="space-y-3 font-sans">
          {out.notes && <Section label="Notes"><Prose text={out.notes} /></Section>}
          {out.cheatsheet && <Section label="Cheatsheet"><Prose text={out.cheatsheet} /></Section>}
          {Array.isArray(out.learning_objectives) && out.learning_objectives.length > 0 && (
            <Section label="Learning objectives">
              <ul className="list-disc list-inside space-y-0.5">
                {out.learning_objectives.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </Section>
          )}
          {Array.isArray(out.code_examples) && out.code_examples.length > 0 && (
            <Section label="Code examples">
              <div className="space-y-2">
                {out.code_examples.map((ex: any, i: number) => (
                  <div key={i}>
                    {ex.title && <div className="font-semibold text-[12px] mb-0.5">{ex.title}</div>}
                    <pre className="bg-slate-900 text-slate-100 rounded-md p-2.5 overflow-x-auto text-[12px]">{ex.code}</pre>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {Array.isArray(out.official_docs) && out.official_docs.length > 0 && (
            <Section label="Official docs">
              <ul className="list-disc list-inside space-y-0.5">
                {out.official_docs.map((d: any, i: number) => <li key={i}>{d.title} — <span className="text-slate-500">{d.url}</span></li>)}
              </ul>
            </Section>
          )}
        </div>
      );
    }
    case "ai.generate.quiz": {
      const questions = Array.isArray(out.questions) ? out.questions : [];
      return (
        <div className="space-y-3 font-sans">
          <Section label={`${questions.length} Question(s)`}>
            <ol className="list-decimal list-inside space-y-3">
              {questions.map((q: any, i: number) => (
                <li key={i}>
                  <div className="font-semibold">{q.question}</div>
                  <ul className="ml-5 mt-1 space-y-0.5">
                    {(q.options || []).map((opt: string, j: number) => (
                      <li key={j} className={j === q.correct_answer ? "text-emerald-700 font-semibold" : "text-slate-600"}>
                        {j === q.correct_answer ? "✓ " : "○ "}{opt}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && <div className="ml-5 text-[11px] text-slate-400 italic mt-0.5">{q.explanation}</div>}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      );
    }
    case "ai.generate.challenge": {
      return (
        <div className="space-y-3 font-sans">
          <Section label="Objective"><Prose text={out.objective} /></Section>
          {Array.isArray(out.requirements) && out.requirements.length > 0 && (
            <Section label="Requirements">
              <ul className="list-disc list-inside space-y-0.5">
                {out.requirements.map((r: string, i: number) => <li key={i} className="font-mono text-[12px]">{r}</li>)}
              </ul>
            </Section>
          )}
          {Array.isArray(out.evaluationCriteria) && out.evaluationCriteria.length > 0 && (
            <Section label="Evaluation criteria">
              <ul className="list-disc list-inside space-y-0.5">
                {out.evaluationCriteria.map((c: string, i: number) => <li key={i}>{c}</li>)}
              </ul>
            </Section>
          )}
          {Array.isArray(out.hints) && out.hints.length > 0 && (
            <Section label="Hints">
              <ul className="list-disc list-inside space-y-0.5">
                {out.hints.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </Section>
          )}
          {Array.isArray(out.expectedSkills) && out.expectedSkills.length > 0 && (
            <Section label="Expected skills">{out.expectedSkills.join(", ")}</Section>
          )}
        </div>
      );
    }
    case "ai.generate.hidden-tests": {
      const tests = Array.isArray(out.tests) ? out.tests : [];
      return (
        <div className="space-y-3 font-sans">
          <Section label={`${tests.length} Test(s) — pending review before they can grade anything`}>
            <div className="space-y-2">
              {tests.map((t: any, i: number) => (
                <div key={i}>
                  <div className="font-semibold text-[12px]">{t.name} {t.isRequired && <span className="text-rose-500 text-[10px]">(required)</span>}</div>
                  <pre className="bg-slate-900 text-slate-100 rounded-md p-2.5 overflow-x-auto text-[12px] mt-1">{t.testCode}</pre>
                </div>
              ))}
            </div>
          </Section>
        </div>
      );
    }
    case "ai.generate.interview": {
      const questions = Array.isArray(out.questions) ? out.questions : [];
      return (
        <div className="space-y-3 font-sans">
          <Section label={`${questions.length} Question(s)`}>
            <ol className="list-decimal list-inside space-y-3">
              {questions.map((q: any, i: number) => (
                <li key={i}>
                  <div className="font-semibold">{q.question} <span className="text-[10px] text-slate-400">({q.difficulty})</span></div>
                  {q.expectedAnswer && <div className="text-[12px] text-slate-600 mt-0.5">{q.expectedAnswer}</div>}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      );
    }
    case "ai.generate.mini-project": {
      return (
        <div className="space-y-3 font-sans">
          <Section label={out.title || "Mini-project"}><Prose text={out.description} /></Section>
          {Array.isArray(out.requirements) && out.requirements.length > 0 && (
            <Section label="Requirements">
              <ul className="list-disc list-inside space-y-0.5">
                {out.requirements.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </Section>
          )}
        </div>
      );
    }
    default:
      return (
        <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
          {JSON.stringify(out, null, 2)}
        </pre>
      );
  }
}
