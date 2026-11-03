import { Job } from 'bullmq';
import { prisma } from '@neuravolt/shared-prisma';
import { AIProvider, AIProviderRouter, GeminiProvider, LongCatProvider } from '@neuravolt/shared-ai';
import { SUPPORTED_LIVE_EXECUTION_LANGUAGES } from '@neuravolt/shared-types';
import { validateGeneratedOutput } from './ai-generation-validation';

// Phase 5A (AI Worker Fail-Closed, Step 3). Pulled out of index.ts on purpose: index.ts's
// top-level code opens a live Redis connection and registers several BullMQ Workers as a side
// effect of being imported, which makes it unsafe to import from a unit test. This module has
// no side effects on import — everything here is a plain function — so
// ai-worker-processing.spec.ts can exercise the real production logic without a live
// queue/DB/Gemini connection.

export const getGeminiApiKey = async (): Promise<string | undefined> => {
  try {
    const config = await prisma.launchpadConfig.findUnique({
      where: { key: 'GEMINI_CONFIG' },
    });
    if (config && typeof config.value === 'object' && config.value !== null) {
      const val = config.value as any;
      if (val.apiKey) {
        return val.apiKey;
      }
    }
  } catch (e: any) {
    console.warn('Failed to load GEMINI_CONFIG from database config:', e.message);
  }
  return process.env.GEMINI_API_KEY;
};

// Fallback provider — same DB-config-then-env lookup pattern as Gemini's own key above, under
// its own config key so it can be set independently. Optional by design: if this resolves to
// undefined, the router below runs Gemini-only, exactly like before this addon existed.
export const getLongCatApiKey = async (): Promise<string | undefined> => {
  try {
    const config = await prisma.launchpadConfig.findUnique({
      where: { key: 'LONGCAT_CONFIG' },
    });
    if (config && typeof config.value === 'object' && config.value !== null) {
      const val = config.value as any;
      if (val.apiKey) {
        return val.apiKey;
      }
    }
  } catch (e: any) {
    console.warn('Failed to load LONGCAT_CONFIG from database config:', e.message);
  }
  return process.env.LONGCAT_API_KEY;
};

// Phase 5A (AI Worker Fail-Closed, Step 3): previously had no timeout at all — a hanging Gemini
// call never surfaced as a failure, it just hung the BullMQ job indefinitely. AbortController
// bounds every call to this timeout (default 30s, matching apps/api's AIBaseService axios
// timeout). JSON parsing is now inside the same try/catch as the network call, so a malformed
// response is a normal thrown error like any other failure mode, not a separate crash path.
//
// Real bug found live (pilot-testing the LongCat fallback): this used to be a top-level
// `export const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10)`,
// evaluated once at module-import time. index.ts imports this module BEFORE it calls
// dotenv.config() (imports always execute before the code that follows them in the same file),
// so process.env.GEMINI_TIMEOUT_MS was reliably still unset every time this ran — the env var
// has silently never worked in production, always 30000 regardless of .env. Made a function so
// it's read fresh at call time instead, the same lazy-read pattern getGeminiApiKey/
// getLongCatApiKey already use correctly above.
function getTimeoutMs(): number {
  return parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10);
}

// Payment-gateway-style addon: this function's own signature and every caller of it is
// completely unchanged by the fallback below — @neuravolt/shared-ai's GeminiProvider carries the
// exact same request shape this function used to build inline (gemini-3.6-flash, the bounded
// thinkingBudget: 512, the 8192 output cap — see that package for the full history of why each
// of those values is what it is). LongCatProvider only ever gets constructed and tried if a
// LONGCAT_CONFIG/LONGCAT_API_KEY is actually set — with none configured, behavior is identical
// to before this addon existed: one provider, its own error surfaces unchanged.
export const callGemini = async (promptText: string, geminiApiKey: string, timeoutMs: number = getTimeoutMs()): Promise<any> => {
  const providers: AIProvider[] = [new GeminiProvider(geminiApiKey)];
  const longcatApiKey = await getLongCatApiKey();
  if (longcatApiKey) {
    providers.push(new LongCatProvider(longcatApiKey));
  }

  const router = new AIProviderRouter(providers);
  const { result, providerUsed, fellBackFrom } = await router.generateJSON(promptText, timeoutMs);
  if (fellBackFrom.length > 0) {
    console.warn(`[ai-generation] ${fellBackFrom.join(', ')} failed — served by fallback provider "${providerUsed}".`);
  }
  // Which provider actually served this job was previously only ever console.warn'd — lost the
  // moment the log scrolled away, so there was no way to answer "did this run on Gemini or the
  // LongCat fallback?" after the fact. _meta is additive (validateGeneratedOutput only checks for
  // required keys being present, never rejects extras) and pickEditableContent's explicit
  // allowlist already keeps it out of the node's real content fields on approval.
  return { ...(result as Record<string, unknown>), _meta: { provider: providerUsed, fellBackFrom } };
};

// Slice 6-5 (Stage 4 — Content, re-scoped to Topic): buildContext (apps/api's
// GenerationContextBuilder, since 5B-3) has always built and persisted this structured object
// onto inputData.context, but neither ai.generate.content prompt branch below ever actually READ
// it before this slice — both only used the flat {{topic}}/{{technology}}/{{difficulty}} tokens.
// This is the "repoint the existing content path to consume the Topic-scoped context" fix §13
// names — grounds the prompt in the topic's own chapter theme, its own learning objective(s),
// and its prerequisite topics' titles (never their full content, per §3/§4's bounding rule).
// Gracefully empty for a node with no context object at all (any node predating the staged
// pipeline, or the legacy roadmapNode fallback) — never fabricated.
function buildTopicGroundingLines(context: any): string {
  if (!context) return '';
  const chapterLine = context.chapter?.theme ? `\n\nThis topic's chapter is themed: ${context.chapter.theme}.` : '';
  const objectiveLine =
    Array.isArray(context.topic?.learningObjectives) && context.topic.learningObjectives.length
      ? `\n\nThis topic's own learning objective(s): ${JSON.stringify(context.topic.learningObjectives)}.`
      : '';
  const prereqTitles = Array.isArray(context.topic?.prerequisiteTopics)
    ? context.topic.prerequisiteTopics.map((p: any) => p.title).filter(Boolean)
    : [];
  const prereqLine = prereqTitles.length
    ? `\n\nStudents already learned these prerequisite topics (do not re-teach from scratch, you may build on them): ${prereqTitles.join(', ')}.`
    : '';
  return `${chapterLine}${objectiveLine}${prereqLine}`;
}

// The Role/Technology `description` an admin writes ("Builds native and cross-platform mobile
// apps... ending in a verified portfolio") previously never reached any prompt — buildContext
// and its siblings only ever carried `.name` through. Explicit design decision (discussed at
// length): this is a *standing quality bar*, not scoped content like a chapter theme or topic
// objective, so unlike those, it belongs in EVERY stage's prompt — Syllabus through Quiz/
// Challenge — not narrowed away as the pipeline goes deeper. One short line, cheap regardless of
// how many stages read it. Deliberately does NOT include level/chapter/topic descriptions here —
// those are scoped content and each stage already receives its own via other lines.
// Style rule lives here rather than a separate injection point: this function already reaches
// every single prompt branch below, and "no em dashes" is exactly the same kind of standing,
// topic-independent bar as the role/technology description lines below it — confirmed live, the
// model's own default prose leans hard on em dashes in every generated field (chapter
// descriptions, topic objectives, node notes), which is what an admin was actually flagging.
const STYLE_RULE =
  'Write in plain prose. Never use an em dash or en dash anywhere in your response. Use a period, a comma, or a word like "and", "but", or "so" instead.';

function buildQualityBarLine(context: any): string {
  const parts: string[] = [STYLE_RULE];
  if (context?.role?.description) parts.push(context.role.description);
  if (context?.technology?.description) parts.push(context.technology.description);
  return `\n\nProfessional standard to hold every response to, regardless of topic: ${parts.join(' ')}`;
}

// Interactive content redesign: "code_examples" is the primary teaching unit now, one small
// step at a time (title + explanation + one complete runnable example), not one markdown wall.
// Mirrors how w3schools actually teaches — one idea, one runnable example, then the next idea
// builds on it. `runnable` may only be true for a language in SUPPORTED_LIVE_EXECUTION_LANGUAGES
// — the worker's own validateGeneratedOutput coerces it to false otherwise, so the wording here
// is guidance, not the enforcement point.
const CONTENT_STEPS_INSTRUCTIONS =
  `Structure "code_examples" as an ordered array of small teaching steps, each a JSON object with: ` +
  `"title" (short, e.g. "Your First Component"), "explanation" (1-3 sentences of markdown prose, ` +
  `the ONLY prose for this step), "code" (one COMPLETE, self-contained example runnable exactly as ` +
  `shown, not a fragment), "language" (e.g. "jsx", "javascript", "typescript", "css", "html"), ` +
  `"runnable" (boolean — true ONLY when language is "${SUPPORTED_LIVE_EXECUTION_LANGUAGES.join('" or "')}", ` +
  `false otherwise). When "runnable" is true, "code" MUST end with a call to render(<YourComponent />) ` +
  `(a "render" function is provided in scope; this is how the live preview knows what to mount, ` +
  `it is not a real import) — a runnable step whose code never calls render() will show nothing. ` +
  `When "runnable" is false, also include "predictOutput": an object with ` +
  `"question" (e.g. "What does this log to the console?"), "options" (array of strings), and ` +
  `"correctIndex" (integer index into options) — a quick self-check standing in for live execution. ` +
  `Optionally include "diagram" (Mermaid diagram syntax as a string) on a step ONLY when a visual ` +
  `genuinely clarifies something (data flow, component tree, box model) — most steps should omit it. ` +
  `Each step must assume only what earlier steps in this topic already taught (progressive, not ` +
  `standalone). Write at least 3 steps, building from the simplest idea to the topic's full scope.`;

export const getPromptMapping = (jobType: string) => {
  switch (jobType) {
    case 'ai.generate.planner':
      return 'roadmap_planner';
    case 'ai.generate.content':
      return 'content_generator';
    case 'ai.generate.quiz':
      return 'quiz_generator';
    case 'ai.generate.challenge':
      return 'challenge_generator';
    case 'ai.generate.interview':
      return 'interview_generator';
    case 'ai.generate.syllabus':
      return 'syllabus_generator';
    case 'ai.generate.levels':
      return 'level_list_generator';
    case 'ai.generate.chapter-detail':
      return 'chapter_detail_generator';
    case 'ai.generate.topics':
      return 'topic_list_generator';
    case 'ai.generate.mini-project':
      return 'mini_project_generator';
    case 'ai.generate.verification-contract':
      return 'verification_contract_generator';
    default:
      return 'content_generator';
  }
};

// Kept for tests/fixtures and for codeReviewWorker's own (separately scoped, still fail-open —
// see the Phase 5A report's residual risks) fallback in index.ts. NEVER called from
// processAiGenerationJob below — a mock-generated job must never be indistinguishable from a
// real success.
export const getFallbackMock = (jobType: string, topic: string, technology: string) => {
  console.log(`Generating fallback mock data for job type: ${jobType}`);
  if (jobType === 'ai.generate.planner') {
    return {
      levels: [
        {
          level_number: 1,
          name: 'Level 1: Foundations',
          description: `Learn the essential building blocks of ${technology}`,
          nodes: [
            { node_number: 1, title: `Introduction to ${technology}`, description: `Setting up your development environment for ${technology}` },
            { node_number: 2, title: `${technology} Basics`, description: `Core variables, structure, and running simple modules` }
          ]
        },
        {
          level_number: 2,
          name: 'Level 2: Mastering REST APIs',
          description: `Advanced architecture and production patterns in ${technology}`,
          nodes: [
            { node_number: 1, title: 'Asynchronous Event Processing', description: `Callbacks, queues, and concurrency operations` },
            { node_number: 2, title: 'Integrating PostgreSQL & Docker', description: `Storing relational entities and containerizing the project` }
          ]
        }
      ]
    };
  } else if (jobType === 'ai.generate.content') {
    return {
      notes: `# Learning Topic: ${topic}\n\nThis guide explains how to construct high-quality projects using **${technology}**.\n\n## Core Concepts\n- Maintain clean configurations\n- Follow SOLID programming principles`,
      cheatsheet: `## ${topic} Cheatsheet\n- run dev: start local node\n- format: prettier check`,
      learning_objectives: [`Understand the foundations of ${topic}`, `Implement clean examples using ${technology}`, `Build local tests`],
      code_examples: [
        { title: `${topic} Sample`, code: `// Demo implementation\nconsole.log("Loading ${topic}");`, language: 'javascript' }
      ],
      official_docs: [
        { title: `${topic} Official Docs`, url: 'https://example.com/docs' }
      ]
    };
  } else if (jobType === 'ai.generate.quiz') {
    return {
      questions: [
        {
          question: `What is the primary advantage of ${topic}?`,
          options: ['Scalability', 'Synchronous execution only', 'Requires no dependencies', 'Limited capability'],
          correct_answer: 0,
          explanation: 'Scalability is a core feature of modern architecture.'
        },
        {
          question: `Which configuration is ideal for ${topic}?`,
          options: ['Production-ready values', 'Hardcoded API secrets', 'Defaults only', 'Empty parameters'],
          correct_answer: 0,
          explanation: 'Always use proper configuration for production pipelines.'
        }
      ]
    };
  } else if (jobType === 'ai.generate.challenge') {
    // Phase 5A (Schema Reconciliation): matches ChallengeOutputDto's shape — kept for tests and
    // for whatever still legitimately wants a fixture — never used as a production fallback.
    return {
      objective: `Implement a small ${technology} module for ${topic} that satisfies the stated requirements.`,
      requirements: [`component:${topic.replace(/\s+/g, '')}`],
      hints: [],
      resources: [],
      evaluationCriteria: ['Meets the stated requirements', 'Builds and lints cleanly'],
      expectedSkills: [technology],
    };
  } else if (jobType === 'review-code' || jobType === 'code_reviewer') {
    return {
      score: 85,
      passed: true,
      feedback: `### AI Code Review Report\n\n- **Score**: 85%\n- **Status**: PASSED (Min threshold met)\n\n#### Positives:\n- Express/Node setup is clean and follows best practices.\n- Endpoints are properly mapped and return clean JSON payloads.\n\n#### Areas for Improvement:\n- Add more comprehensive error handling middleware.\n- Implement detailed log trace keys for production request-response monitoring.\n\n*Review completed successfully.*`,
    };
  } else {
    return {
      questions: [
        `Can you describe how ${topic} works internally?`,
        `What are the security implications when using ${technology}?`,
        `How do you monitor performance bottlenecks?`
      ]
    };
  }
};

// Phase 5A (AI Worker Fail-Closed, Step 3): this is the one production-reachable AI generation
// consumer. It previously caught every Gemini failure mode (API error, timeout — now that one
// exists, per callGemini above — malformed JSON, empty response, missing API key) and silently
// substituted getFallbackMock()'s placeholder content, then marked the job `completed` — a
// mock-generated job was indistinguishable from a real success anywhere in the UI. Every one of
// those paths now marks the job `failed` with a real errorMessage instead. getFallbackMock()
// itself is untouched and still used by tests/fixtures — it is simply never called from this
// success path anymore. Dependency-injected (prisma/callGemini/getGeminiApiKey) so it's
// unit-testable without a live queue/DB/Gemini connection (see ai-worker-processing.spec.ts).
export interface AiGenerationJobDeps {
  prisma: Pick<typeof prisma, 'aIGenerationJob' | 'launchpadAiGenerationJob' | 'launchpadAiPrompt'>;
  callGemini: typeof callGemini;
  getGeminiApiKey: typeof getGeminiApiKey;
}

export async function processAiGenerationJob(job: Job, deps: AiGenerationJobDeps): Promise<any> {
  const { prisma: db, callGemini: doCallGemini, getGeminiApiKey: doGetGeminiApiKey } = deps;
  const jobId = job.data.jobId;
  const isLegacy = job.data.targetType === 'node' || job.data.isLaunchpad === false;
  // Slice 6-7 (Root-cause fix): the BullMQ producer (AiOrchestrationService.queueNodeGeneration /
  // queueSyllabusGeneration / queueChapterDetailGeneration) spreads `inputData` FLAT into job.data
  // via `...inputData` (api/src/modules/ai-orchestration/ai-orchestration.service.ts L194-196).
  // That means `context`, `topic`, `technology`, etc. live directly on `job.data`, not nested
  // under a `job.data.inputData` key — which never exists at all. The previous `job.data.inputData
  // || {}` always resolved to `{}`, silently destroying every context-grounded prompt and making
  // every generation appear to "work" (Gemini returned something) while never reading the bounded
  // career/role/technology/level/chapter/topic context that GenerationContextBuilder builds.
  // Read `job.data` directly. For any legacy jobs that were enqueued with the old `{inputData:{…}}`
  // wrapper shape (pre-slice-6-2), fall back to `job.data.inputData` so they don't regress.
  const input = (job.data.topic || job.data.context) ? job.data : (job.data.inputData || {});
  const topic = input.topic || '';
  const technology = input.technology || job.data.technologyName || '';
  const difficulty = input.difficulty || 'beginner';
  const durationWeeks = input.durationWeeks || job.data.durationWeeks || 8;
  const projectIdea = input.projectIdea || '';
  const industry = input.industry || '';

  console.log(`Processing AI generation job ID: ${jobId}, Type: ${job.name}, Topic: ${topic}, Tech: ${technology}`);

  const markFailed = async (message: string) => {
    console.error(`AI generation job ${jobId} failed: ${message}`);
    if (isLegacy) {
      await db.aIGenerationJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message, completedAt: new Date() },
      });
    } else {
      await db.launchpadAiGenerationJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message },
      });
    }
  };

  // Update job to processing
  if (isLegacy) {
    await db.aIGenerationJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });
  } else {
    await db.launchpadAiGenerationJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });
  }

  try {
    const promptName = getPromptMapping(job.name);
    const dbPrompt = await db.launchpadAiPrompt.findUnique({
      where: { name: promptName },
    });

    let promptTemplate = '';
    if (dbPrompt) {
      promptTemplate = dbPrompt.promptTemplate;
    } else {
      // Safe default prompts
      if (job.name === 'ai.generate.planner') {
        promptTemplate = 'Create a learning roadmap for {{technology}} at {{difficulty}} level for {{duration}} weeks.';
      } else if (job.name === 'ai.generate.levels') {
        // "Suggest Levels via AI" (Stage 0 — one tier above Syllabus): titles and one-line
        // descriptions/difficulty progression only, per the same "titles and themes, not full
        // detail" rule Stage 1 uses for chapters — a Level's own full description is written by
        // the admin who reviews and approves this suggestion, not generated wholesale here.
        // Context comes entirely from input.context (GenerationContextBuilder.
        // buildTechnologyContext) — there's no single "topic" at this stage, only a career/role/
        // technology.
        const ctx = input.context || {};
        const careerLine = ctx.career?.name ? `Career track: ${ctx.career.name}.` : '';
        const roleLine = ctx.role?.name ? `Role: ${ctx.role.name}.` : '';
        const existingLevels = Array.isArray(ctx.existingLevelNames) ? ctx.existingLevelNames : [];
        const existingLevelsLine = existingLevels.length
          ? `\n\nThis Technology already has these Levels — do not repeat or renumber them, only propose what comes after: ${JSON.stringify(existingLevels)}`
          : '';
        const instructionLine = ctx.instruction ? `\n\nMANDATORY REQUIREMENTS: ${ctx.instruction}` : '';
        promptTemplate =
          `Design the ordered Level progression for the "${ctx.technology?.name || technology}" technology. ` +
          `${careerLine} ${roleLine}${existingLevelsLine}${instructionLine}${buildQualityBarLine(ctx)}\n\n` +
          `Return a JSON object with a "levels" array. Each element must have "name" (short, distinct, e.g. ` +
          `"Foundations" or "Advanced Patterns" — do not include a level number prefix, that's assigned separately), ` +
          `"description" (one sentence — content covered and why it matters, in the style "X, Y, and Z — the thing ` +
          `that actually matters for Q"), "difficulty" (one of "beginner"|"explorer"|"intermediate"|"advanced"|"expert"|"professional", ` +
          `roughly in that order of increasing difficulty), ` +
          `and "estimatedDurationHours" (integer). Provide at least 1 level, ordered from easiest to hardest, and ` +
          `never repeat a name.`;
      } else if (job.name === 'ai.generate.syllabus') {
        // Slice 6-2 (Stage 1 — Syllabus): titles and one-line themes only, per §3 — not full
        // chapter detail (that's Stage 2, slice 6-3). Context comes entirely from
        // input.context (GenerationContextBuilder.buildLevelContext), not the flat
        // {{topic}}/{{technology}}/{{difficulty}} tokens, since there's no single "topic" at
        // this stage — only a career/role/technology/level.
        const ctx = input.context || {};
        const level = ctx.level || {};
        const careerLine = ctx.career?.name ? `Career track: ${ctx.career.name}.` : '';
        const roleLine = ctx.role?.name ? `Role: ${ctx.role.name}.` : '';
        // Node.js curriculum E2E validation: a professor instruction appended mid-paragraph (the
        // prior wording) was empirically ignored by Gemini 2.5 Flash on a real run — it produced
        // a generic, shorter syllabus that dropped an explicitly mandatory chapter. Restructured
        // so the instruction, when present, is the FIRST thing the model reads and is framed as
        // an authoritative requirement rather than one clause in a longer paragraph, then
        // reiterated immediately before the JSON-format directive — both positions models
        // attend to more reliably than the middle of a prose block.
        const instructionBlock = ctx.instruction
          ? `MANDATORY REQUIREMENTS (follow exactly — do not summarize, shorten, or drop any of these):\n${ctx.instruction}\n\n`
          : '';
        const instructionReminder = ctx.instruction
          ? ` Re-confirm every mandatory requirement above is fully reflected in the chapters array before responding.`
          : '';
        promptTemplate =
          `${instructionBlock}` +
          `Design the ordered chapter skeleton (syllabus) for a "${level.name || technology}" level of ${technology}, ` +
          `at ${level.difficulty || difficulty} difficulty. ${careerLine} ${roleLine}\n` +
          `Level description: ${level.description || '(none provided)'}` +
          `${buildQualityBarLine(ctx)}\n\n` +
          `Return a JSON object with a "chapters" array. Each element must have "title" (short, distinct), ` +
          `"theme" (one sentence describing what this chapter covers — no full detail, that comes later), ` +
          `and "sortOrder" (integer, starting at 1). Provide at least 1 chapter, and never repeat a title.${instructionReminder}`;
      } else if (job.name === 'ai.generate.chapter-detail') {
        // Slice 6-3 (Stage 2 — Chapter detail): expand one Stage 1 chapter stub into full
        // description, learning objectives, and estimated duration. Sibling chapter TITLES only
        // (continuity), never their own detail, per §3.
        const ctx = input.context || {};
        const chapter = ctx.chapter || {};
        const siblings = Array.isArray(chapter.siblingChapterTitles) ? chapter.siblingChapterTitles : [];
        const siblingsLine = siblings.length ? `\n\nOther chapters in this Level (for continuity, do not repeat their content): ${JSON.stringify(siblings)}` : '';
        // Previously missing entirely — buildChapterContext has always carried ctx.level.
        // description (it's how Stage 1's syllabus prompt uses it), but this stage never read
        // it, so a Level's own scope/intent was lost the moment Stage 2 started.
        const levelDescriptionLine = ctx.level?.description ? `\n\nLevel description: ${ctx.level.description}` : '';
        const instructionLine = ctx.instruction ? `\n\nProfessor's instruction: ${ctx.instruction}` : '';
        promptTemplate =
          `Expand chapter "${chapter.title || topic}" (theme: ${chapter.theme || '(none provided)'}) into full detail, ` +
          `for a "${ctx.level?.name || ''}" level of ${technology} at ${ctx.level?.difficulty || difficulty} difficulty.` +
          `${levelDescriptionLine}${siblingsLine}${instructionLine}${buildQualityBarLine(ctx)}\n\n` +
          `Return a JSON object with "description" (a full paragraph expanding the chapter's theme), ` +
          `"learningObjectives" (array of strings, at least one), and "estimatedDurationHours" (integer, hours a student would need for this chapter).`;
      } else if (job.name === 'ai.generate.topics') {
        // Slice 6-4 (Stage 3 — Topics): the ordered topic list for ONE chapter, grounded in that
        // chapter's full Stage 2 detail — never other chapters' topics, per §3.
        const ctx = input.context || {};
        const chapter = ctx.chapter || {};
        const objectivesSummary = ctx.chapterDetail?.objectivesSummary;
        const instructionLine = ctx.instruction ? `\n\nProfessor's instruction: ${ctx.instruction}` : '';
        promptTemplate =
          `Generate the ordered list of topics for the chapter "${chapter.title || topic}" ` +
          `(theme: ${chapter.theme || '(none provided)'}) in a "${ctx.level?.name || ''}" level of ${technology}.\n` +
          `Chapter detail: ${JSON.stringify(objectivesSummary || {})}${instructionLine}${buildQualityBarLine(ctx)}\n\n` +
          `Return a JSON object with a "topics" array. Each element must have "title" (short, distinct), ` +
          `"objective" (one sentence describing what the student learns), "prerequisiteTopicTitles" (array of ` +
          `strings, optional — titles of topics from THIS SAME chapter that must come earlier in the list, or ` +
          `from an earlier chapter; never a topic that appears later or in a later chapter), and "sortOrder" ` +
          `(integer, starting at 1). Provide at least 1 topic, and never repeat a title.`;
      } else if (job.name === 'ai.generate.quiz' && input.scope === 'quiz-question') {
        // Slice 5B-4: the sub-field regeneration case — one new question, informed by the
        // existing ones (so it doesn't duplicate) and an optional professor instruction. Still
        // returns the same {"questions": [...]} shape (validateGeneratedOutput's existing quiz
        // check already accepts a single-element array), just with exactly one element —
        // approveJobOutput is what actually splices it into the live array at targetIndex.
        const existing = Array.isArray(input.existingQuizQuestions) ? input.existingQuizQuestions : [];
        const instructionLine = input.context?.instruction ? `\n\nProfessor's instruction: ${input.context.instruction}` : '';
        promptTemplate =
          `Generate exactly ONE new multiple choice quiz question for {{topic}} in {{technology}}, ` +
          `replacing question ${Number(input.targetIndex) + 1} of ${existing.length}. ` +
          `Here are the OTHER existing questions in this quiz, so the new one does not duplicate them:\n` +
          `${JSON.stringify(existing.filter((_: unknown, i: number) => i !== input.targetIndex))}` +
          `${instructionLine}${buildQualityBarLine(input.context)}\n\n` +
          `Return a JSON object with a "questions" array containing EXACTLY ONE object with "question", ` +
          `"options" (array of 4 choices), "correct_answer" (index 0-3), and "explanation".`;
      } else if (job.name === 'ai.generate.quiz') {
        // Slice 6-6 (Stage 5 — Assessment): previously read {{notes}}, a flat token substituted
        // from job.data.inputData?.notes — a field the live producer (AiOrchestrationService.
        // queueNodeGeneration) has never populated (only the dead Pipeline B's
        // ai-generation-jobs.service.ts ever set it). Genuinely grounded quiz generation requires
        // the topic's real taught content, which buildContext has provided as
        // input.context.currentApprovedContent since 5B-3 — just never read here until now.
        // Explicit product decision: the generation-sequence gate (AiOrchestrationService.
        // assertGenerationSequenceAllowed) treats a merely-APPROVED Content job as sufficient to
        // unblock Quiz/Challenge/Interview/Mini-Project — it does not require Publish. But
        // currentApprovedContent only ever holds a PUBLISHED LaunchpadContentVersion, so without
        // this fallback, a gate-approved-but-unpublished topic would still silently ground on
        // nothing (confirmed live: the gate allowed generation, yet currentApprovedContent was
        // null while currentDraft already held the real, just-approved notes). currentDraft is
        // exactly what saveDraft() populates the moment a Content job is approved, before Publish.
        const approvedNotes =
          input.context?.currentApprovedContent?.notes ||
          input.context?.currentDraft?.notes ||
          '(no approved content yet for this topic)';
        promptTemplate =
          `Generate a multiple choice quiz based on the following notes:\n${approvedNotes}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `Topic: {{topic}} in {{technology}}. Return a JSON object with a "questions" array containing objects ` +
          `with "question", "options" (array of 4 choices), "correct_answer" (index 0-3), and "explanation".`;
      } else if (job.name === 'ai.generate.challenge') {
        // Phase 5A (Schema Reconciliation): previously asked for {challenge:{title,description,
        // starter_code}, validation_rules, xp_reward, coins_reward} — a shape the Verification
        // Engine's buildBlueprint() never reads at all (it reads requirements/evaluationCriteria/
        // expectedSkills from codingChallenge, and evaluationConfig/skillMapping from the node's
        // own columns). Asking for the real, ChallengeBlueprint-compatible shape here so the one
        // production-reachable generation path can actually produce a verifiable challenge.
        // Slice 6-6: same {{notes}}-was-never-populated fix as ai.generate.quiz above.
        // Explicit product decision: the generation-sequence gate (AiOrchestrationService.
        // assertGenerationSequenceAllowed) treats a merely-APPROVED Content job as sufficient to
        // unblock Quiz/Challenge/Interview/Mini-Project — it does not require Publish. But
        // currentApprovedContent only ever holds a PUBLISHED LaunchpadContentVersion, so without
        // this fallback, a gate-approved-but-unpublished topic would still silently ground on
        // nothing (confirmed live: the gate allowed generation, yet currentApprovedContent was
        // null while currentDraft already held the real, just-approved notes). currentDraft is
        // exactly what saveDraft() populates the moment a Content job is approved, before Publish.
        const approvedNotes =
          input.context?.currentApprovedContent?.notes ||
          input.context?.currentDraft?.notes ||
          '(no approved content yet for this topic)';
        promptTemplate =
          `Create a coding challenge specification based on the following notes:\n${approvedNotes}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `Topic: {{topic}} in {{technology}} at {{difficulty}} level. Return a JSON object with exactly these fields: ` +
          `"objective" (string, 1-2 sentences describing the task), "requirements" (array of strings, each a specific ` +
          `checkable requirement, e.g. "route:GET /books" or "component:BookList"), "hints" (array of strings, optional), ` +
          `"resources" (array of strings, optional), "evaluationCriteria" (array of strings describing how the ` +
          `submission is judged), "expectedSkills" (array of skill-name strings, optional). Do not include any other fields, ` +
          `except optionally "parameterSchema" (see below).\n\n` +
          `Per-student variation (optional, only include if it genuinely fits this challenge): if a meaningful part of ` +
          `this challenge can vary per student without changing what's actually being tested (e.g. the resource name in ` +
          `a CRUD API, the page type in a content page), you may add "parameterSchema": an object mapping a short ` +
          `variable name to an array of possible values, e.g. {"resourceName": ["orders","movies","products"]}. When ` +
          `you do, reference that variable with {{variableName}} inside "objective" and inside "requirements" — but ` +
          `ONLY inside the value half of a "prefix:value" requirement, never the prefix itself: "route:GET /{{resourceName}}" ` +
          `is correct, "{{prefix}}:GET /books" is not. Most challenges do not need this — omit "parameterSchema" entirely ` +
          `unless the variation is meaningful and doesn't change the actual skill being assessed.`;
      } else if (job.name === 'ai.generate.interview') {
        // Slice 6-6 (Stage 5 — Assessment): previously had NO dedicated prompt branch at all —
        // fell through to the generic "Write learning content..." fallback, which asks for
        // notes/cheatsheet-shaped JSON, not a questions array. validateGeneratedOutput's own
        // ai.generate.interview case has always required a non-empty "questions" array, so this
        // job type was reliably failing validation in the live path until now. The rich shape
        // below (pattern/expectedAnswer/evaluationRubric) is what understanding.validator.ts
        // actually reads from ctx.blueprint.aiInterviewQuestions — generating anything narrower
        // would leave that already-live validator with nothing real to check.
        // Explicit product decision: the generation-sequence gate (AiOrchestrationService.
        // assertGenerationSequenceAllowed) treats a merely-APPROVED Content job as sufficient to
        // unblock Quiz/Challenge/Interview/Mini-Project — it does not require Publish. But
        // currentApprovedContent only ever holds a PUBLISHED LaunchpadContentVersion, so without
        // this fallback, a gate-approved-but-unpublished topic would still silently ground on
        // nothing (confirmed live: the gate allowed generation, yet currentApprovedContent was
        // null while currentDraft already held the real, just-approved notes). currentDraft is
        // exactly what saveDraft() populates the moment a Content job is approved, before Publish.
        const approvedNotes =
          input.context?.currentApprovedContent?.notes ||
          input.context?.currentDraft?.notes ||
          '(no approved content yet for this topic)';
        // BUG FIX: confirmed live across 280 already-generated questions — 71% came back "easy",
        // only 1.8% "hard", because the old prompt said "at {{difficulty}} level" (the node's OWN
        // stated difficulty, mostly "beginner" this early in a curriculum) with no requirement to
        // spread across depths, and literally called them "mock" questions. understanding-
        // evaluator.service.ts's grading is fine (already guards against superficial pattern-
        // matching) — the gap was purely in what got asked. Now requires a real depth spread per
        // topic regardless of the node's own difficulty label.
        promptTemplate =
          `Generate real interview questions for a "${topic}" topic in {{technology}}, ` +
          `based on this taught content:\n${approvedNotes}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `Return a JSON object with a "questions" array of at least 3 questions covering a genuine MIX of depths: ` +
          `at least one "easy" (recall/definition), at least one "medium" (apply the concept to a small scenario), ` +
          `and at least one "hard" (reason about an edge case, a failure mode, or how this interacts with another ` +
          `concept from the same content) — do not make every question the same difficulty just because the topic ` +
          `itself is introductory. Each element must have "pattern" (a regex string that would plausibly match real ` +
          `submitted code demonstrating understanding of this question — e.g. a function or keyword name), ` +
          `"question" (the interview question text), "difficulty" (one of "easy"|"medium"|"hard"), "expectedAnswer" ` +
          `(a model answer), and "evaluationRubric" (array of strings, criteria a mentor would check a student's ` +
          `spoken answer against).`;
      } else if (job.name === 'ai.generate.mini-project') {
        // Slice 6-6 (Stage 5 — Assessment): did not exist at all before this slice — no queue
        // route change was needed (queueNodeGeneration already handles any jobType string
        // generically), but there was no prompt branch, so triggering it would have silently
        // fallen through to the generic content fallback and failed the shape github-roadmap.
        // service.ts actually requires ({title, description, ...}) when a student starts it.
        // Explicit product decision: the generation-sequence gate (AiOrchestrationService.
        // assertGenerationSequenceAllowed) treats a merely-APPROVED Content job as sufficient to
        // unblock Quiz/Challenge/Interview/Mini-Project — it does not require Publish. But
        // currentApprovedContent only ever holds a PUBLISHED LaunchpadContentVersion, so without
        // this fallback, a gate-approved-but-unpublished topic would still silently ground on
        // nothing (confirmed live: the gate allowed generation, yet currentApprovedContent was
        // null while currentDraft already held the real, just-approved notes). currentDraft is
        // exactly what saveDraft() populates the moment a Content job is approved, before Publish.
        const approvedNotes =
          input.context?.currentApprovedContent?.notes ||
          input.context?.currentDraft?.notes ||
          '(no approved content yet for this topic)';
        promptTemplate =
          `Design a mini-project (a lighter-weight, exploratory practice project — not the machine-graded coding ` +
          `challenge) for the "${topic}" topic in {{technology}} at {{difficulty}} level, building on this taught ` +
          `content:\n${approvedNotes}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `Return a JSON object with "title" (string), "description" (a paragraph explaining what to build), ` +
          `"requirements" (array of strings, optional), and "deliverables" (array of strings describing what the ` +
          `student should end up with, optional).`;
      } else if (job.name === 'ai.generate.verification-contract') {
        // Slice 5B-15 (Stage 6a — Challenge Verification Contracts): a reference solution + N
        // deliberately-broken variants for Stage 6b's Broken Solutions validation (5B-14, not
        // built by this branch). customWeights/customGates are optional — most challenges never
        // need to diverge from their technology's default profile; only ask the AI to propose
        // them when there's a real reason to (an explicit instruction), never invent an override
        // just because the field exists.
        const challenge = input.codingChallenge || {};
        const hiddenTests = Array.isArray(input.hiddenTests) ? input.hiddenTests : [];
        const instructionLine = input.instruction
          ? `\n\nProfessor's instruction (e.g. a reason to propose customWeights/customGates): ${input.instruction}`
          : '\n\nNo special instruction — omit customWeights/customGates unless this specific challenge genuinely needs them.';
        promptTemplate =
          `Write a reference solution for this coding challenge on {{topic}} in {{technology}} (${input.technologySlug || technology}) ` +
          `at {{difficulty}} level, plus deliberately-broken variants for automated test validation.\n\n` +
          `Challenge objective: ${challenge.objective || '(none provided)'}\n` +
          `Requirements: ${JSON.stringify(challenge.requirements || [])}\n` +
          `Evaluation criteria: ${JSON.stringify(challenge.evaluationCriteria || [])}\n` +
          `Approved hidden tests this solution must pass, and each broken variant must mostly fail:\n${JSON.stringify(hiddenTests)}` +
          `${instructionLine}\n\n` +
          `Return a JSON object with "expectedSolution" (a complete, correct solution as a string, satisfying every ` +
          `requirement and passing the hidden tests above), "brokenSolutions" (array of strings, at least one — each ` +
          `a plausible but deliberately incorrect variant that should fail most hidden tests), "customWeights" (object, ` +
          `optional — only include a key from "architecture"/"requirement"/"build"/"lint"/"unit-tests" if this specific ` +
          `challenge's evidence should count more or less than the technology default), "customGates" (array of strings, ` +
          `optional — additional "prefix:value" requirement strings this specific challenge must satisfy beyond its own ` +
          `requirements, e.g. "error-handling:required"). Do not include any other fields.`;
      } else if (job.name === 'ai.generate.hidden-tests') {
        // Slice 5B-7: hidden tests grounded in the challenge's own requirements/evaluationCriteria
        // — grading only means something if the tests actually check what the challenge asked
        // for. Whatever comes back lands as reviewStatus "pending-review" (approveJobOutput,
        // ChallengeTestSuiteService.createFromGeneration) — never directly usable for grading no
        // matter how this prompt is worded; that guarantee lives in the persistence layer, not here.
        const challenge = input.codingChallenge || {};
        promptTemplate =
          `Write hidden Jest test cases for a coding challenge on {{topic}} in {{technology}} at {{difficulty}} level.\n\n` +
          `Challenge objective: ${challenge.objective || '(none provided)'}\n` +
          `Requirements: ${JSON.stringify(challenge.requirements || [])}\n` +
          `Evaluation criteria: ${JSON.stringify(challenge.evaluationCriteria || [])}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `Return a JSON object with a "tests" array. Each element must have "name" (short, descriptive), ` +
          `"testCode" (a complete, runnable Jest test file's contents as a string), "points" (integer, optional), ` +
          `"isRequired" (boolean, optional). Write one test per requirement where practical — do not include any other fields.`;
      } else if (job.name === 'ai.generate.content' && input.context?.currentApprovedContent) {
        // Slice 5B-5: §5's V1 → instruction → V2 flow — a regeneration must revise the existing
        // approved content given the professor's instruction, not blindly start over. Only
        // engages when a prior published version genuinely exists (5B-3's context builder
        // leaves currentApprovedContent null otherwise) — a first-ever generation for this node
        // still falls through to the plain "write from scratch" branch below.
        const current = input.context.currentApprovedContent;
        const priorInstructionLine = input.context.versionHistorySummary?.instruction
          ? `\n\nThe previous revision (version ${input.context.versionHistorySummary.versionNumber}) was made with this instruction: "${input.context.versionHistorySummary.instruction}" — for continuity, don't undo that change unless the new instruction below asks you to.`
          : '';
        const newInstructionLine = input.context.instruction
          ? `\n\nProfessor's new instruction: ${input.context.instruction}`
          : '';
        promptTemplate =
          `Revise the existing learning content for {{topic}} in {{technology}} at {{difficulty}} level. ` +
          `Here is the CURRENT approved content — base your revision on this, do not start from scratch:\n` +
          `${JSON.stringify(current)}` +
          `${buildTopicGroundingLines(input.context)}` +
          `${priorInstructionLine}` +
          `${newInstructionLine}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `${CONTENT_STEPS_INSTRUCTIONS}\n\n` +
          `Return a JSON object with "notes" (short 2-4 sentence overview, markdown), "cheatsheet" (markdown), ` +
          `"learning_objectives" (array of strings), "code_examples" (the steps array described above), ` +
          `"official_docs" (array of {title, url} objects, optional) — revised per the instruction above.`;
      } else if (job.name === 'ai.generate.content') {
        // Slice 6-5: the plain first-ever generation, now grounded in the topic's own chapter/
        // prerequisite context when one exists (any node materialized via Stage 3, slice 6-4,
        // always has it).
        // Fix (found during live pilot testing): unlike every sibling branch in this file, this
        // one never told Gemini the required output shape — validateGeneratedOutput's
        // 'ai.generate.content' case requires a non-empty "notes" or "cheatsheet" string, but
        // nothing in the prompt asked for those field names, so Gemini was free to invent its
        // own JSON shape and reliably failed schema validation. Mirrors the sibling revision
        // branch's own "Return a JSON object with..." instruction immediately above.
        promptTemplate =
          `Write learning content for {{topic}} in {{technology}} at {{difficulty}} level.` +
          `${buildTopicGroundingLines(input.context)}` +
          `${buildQualityBarLine(input.context)}\n\n` +
          `${CONTENT_STEPS_INSTRUCTIONS}\n\n` +
          `Return a JSON object with "notes" (short 2-4 sentence overview of what the student will build ` +
          `in this topic, markdown string, NOT the main content), "cheatsheet" (denser markdown reference), ` +
          `"learning_objectives" (array of strings), "code_examples" (the steps array described above), ` +
          `"official_docs" (array of {title, url} objects, optional).`;
      } else {
        promptTemplate = 'Write learning content for {{topic}} in {{technology}} at {{difficulty}} level.';
      }
    }

    // Replace prompt template variables
    const filledPrompt = promptTemplate
      .replace(/\{\{technology\}\}/g, technology || '')
      .replace(/\{\{topic\}\}/g, topic || '')
      .replace(/\{\{difficulty\}\}/g, difficulty || 'beginner')
      .replace(/\{\{duration\}\}/g, String(durationWeeks || 8))
      .replace(/\{\{project\}\}/g, projectIdea || '')
      .replace(/\{\{industry\}\}/g, industry || '')
      .replace(/\{\{notes\}\}/g, input.notes || '')
      .replace(/\{\{cheatsheet\}\}/g, input.cheatsheet || '');

    const geminiApiKey = await doGetGeminiApiKey();
    if (!geminiApiKey || geminiApiKey === 'MOCK_KEY') {
      // Previously fell back to getFallbackMock() and marked the job completed — a missing/mock
      // API key is a configuration failure, not a success, and must never be indistinguishable
      // from one.
      throw new Error('GEMINI_API_KEY is not configured (checked database config and environment) — cannot generate content.');
    }

    console.log(`Calling Gemini API for Prompt: ${promptName}`);
    const generatedJson = await doCallGemini(filledPrompt, geminiApiKey);

    const validation = validateGeneratedOutput(job.name, generatedJson);
    if (!validation.valid) {
      throw new Error(`Gemini response failed schema validation: ${validation.error}`);
    }

    // Save output — only ever reached for a real, schema-valid Gemini response.
    if (isLegacy) {
      await db.aIGenerationJob.update({
        where: { id: jobId },
        data: { status: 'completed', outputData: generatedJson, completedAt: new Date() },
      });
    } else {
      // LaunchpadAiGenerationJob has no completedAt column (only the legacy AIGenerationJob
      // above does) — updatedAt already captures this moment via Prisma's @updatedAt. Writing
      // completedAt here was a genuine bug: every Stage 1-7 job crashed on this exact line the
      // first time it ran against a real Postgres client (silent in every unit test, which mocks
      // Prisma and never validates the update payload against the real schema).
      await db.launchpadAiGenerationJob.update({
        where: { id: jobId },
        data: { status: 'completed', outputData: generatedJson },
      });
    }

    console.log(`AI generation job ${jobId} successfully completed.`);
    return generatedJson;
  } catch (err: any) {
    await markFailed(err.message);
    throw err;
  }
}
