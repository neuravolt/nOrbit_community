// Groups a Level's flat job list back into the tree shape the pipeline actually ran in —
// consumed by JobTreeExplorer (job-tree-explorer.tsx), the left-nav + right-detail view used by
// both /admin/levels/[levelId]/execution-tree and the "Tree" mode inside /admin/generation-jobs.
import { AIGenerationJob } from "./job-output-view";

const TOPIC_JOB_TYPES = new Set([
  "ai.generate.content",
  "ai.generate.quiz",
  "ai.generate.challenge",
  "ai.generate.hidden-tests",
  "ai.generate.interview",
  "ai.generate.mini-project",
  "ai.generate.verification-contract",
]);
const CHAPTER_JOB_TYPES = new Set(["ai.generate.chapter-detail", "ai.generate.topics"]);

export interface TopicGroup {
  topicTitle: string;
  jobs: AIGenerationJob[];
}
export interface ChapterGroup {
  chapterTitle: string;
  chapterJobs: AIGenerationJob[];
  topics: TopicGroup[];
}

// The pipeline's real shape: one Syllabus prompt fans out into N Chapter-Detail + Topics
// requests (one pair per chapter), and each chapter's topics each fan out again into up to 6
// assessment/content requests. Every job already carries this ancestry on inputData.context /
// inputData.topic (GenerationContextBuilder) — this just groups the flat job list back into the
// tree shape it actually executed in. A job fired directly from a node's own "Generate via AI"
// button (the older, pre-Stage-1-7 path) never went through a chapter, so it falls into a
// clearly-labeled bucket instead of a real chapter group.
export function buildJobTree(jobs: AIGenerationJob[]) {
  const syllabusJobs = jobs.filter((j) => j.jobType === "ai.generate.syllabus");
  const chapterMap = new Map<string, { chapterJobs: AIGenerationJob[]; topicMap: Map<string, AIGenerationJob[]> }>();

  for (const job of jobs) {
    if (job.jobType === "ai.generate.syllabus") continue;
    const ctx = job.inputData?.context;
    const chapterTitle = ctx?.chapter?.title || "Directly-generated nodes (no chapter)";
    if (!chapterMap.has(chapterTitle)) chapterMap.set(chapterTitle, { chapterJobs: [], topicMap: new Map() });
    const group = chapterMap.get(chapterTitle)!;
    if (CHAPTER_JOB_TYPES.has(job.jobType)) {
      group.chapterJobs.push(job);
    } else if (TOPIC_JOB_TYPES.has(job.jobType)) {
      const topicTitle = job.inputData?.topic || ctx?.topic || "Ungrouped topic";
      if (!group.topicMap.has(topicTitle)) group.topicMap.set(topicTitle, []);
      group.topicMap.get(topicTitle)!.push(job);
    }
  }

  const chapters: ChapterGroup[] = Array.from(chapterMap.entries()).map(([chapterTitle, g]) => ({
    chapterTitle,
    chapterJobs: g.chapterJobs,
    topics: Array.from(g.topicMap.entries()).map(([topicTitle, jobs]) => ({ topicTitle, jobs })),
  }));

  return { syllabusJobs, chapters };
}
