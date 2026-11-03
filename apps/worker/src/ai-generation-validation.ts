// Phase 5A (AI Worker Fail-Closed, Step 3). Runtime schema validation for a Gemini generation
// response before it can be marked as a completed job — mirrors the shape checks already
// enforced in-API for the same job types (ChallengeAgent's class-validator DTO, QuizAgent's
// manual Array.isArray(questions) check) so the one production-reachable generation path
// (apps/worker's aiWorker) can no longer mark a structurally-empty or malformed response as a
// success. This does not replace ChallengeOutputDto — it's a lighter, dependency-free check
// usable outside the NestJS/class-validator context this worker runs in.

import { SUPPORTED_LIVE_EXECUTION_LANGUAGES } from '@neuravolt/shared-types';

export interface GeneratedOutputValidation {
  valid: boolean;
  error?: string;
}

const RUNNABLE_LANGUAGES: readonly string[] = SUPPORTED_LIVE_EXECUTION_LANGUAGES;

function isPlainObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateGeneratedOutput(jobType: string, output: any): GeneratedOutputValidation {
  if (!isPlainObject(output)) {
    return { valid: false, error: 'Generated output is not a JSON object.' };
  }

  switch (jobType) {
    case 'ai.generate.challenge': {
      const requirements = Array.isArray(output.requirements) ? output.requirements : [];
      const evaluationCriteria = Array.isArray(output.evaluationCriteria) ? output.evaluationCriteria : [];
      if (requirements.length === 0 || evaluationCriteria.length === 0) {
        return { valid: false, error: 'Challenge output is missing a non-empty requirements/evaluationCriteria array.' };
      }
      return { valid: true };
    }
    case 'ai.generate.planner': {
      if (!Array.isArray(output.levels) || output.levels.length === 0) {
        return { valid: false, error: 'Planner output is missing a non-empty levels array.' };
      }
      return { valid: true };
    }
    case 'ai.generate.quiz': {
      if (!Array.isArray(output.questions) || output.questions.length === 0) {
        return { valid: false, error: 'Quiz output is missing a non-empty questions array.' };
      }
      return { valid: true };
    }
    case 'ai.generate.interview': {
      if (!Array.isArray(output.questions) || output.questions.length === 0) {
        return { valid: false, error: 'Interview output is missing a non-empty questions array.' };
      }
      return { valid: true };
    }
    // Slice 6-6 (Stage 5 — Assessment): mirrors github-roadmap.service.ts's own runtime check
    // (`!miniProject.title` throws BadRequestException when a student starts the project) —
    // failing fast here means a malformed mini-project is never even approved/merged.
    case 'ai.generate.mini-project': {
      const hasTitle = typeof output.title === 'string' && output.title.trim().length > 0;
      const hasDescription = typeof output.description === 'string' && output.description.trim().length > 0;
      if (!hasTitle || !hasDescription) {
        return { valid: false, error: 'Mini-project output is missing a non-empty title or description.' };
      }
      return { valid: true };
    }
    // Slice 5B-15 (Stage 6a — Challenge Verification Contracts).
    case 'ai.generate.verification-contract': {
      const hasSolution = typeof output.expectedSolution === 'string' && output.expectedSolution.trim().length > 0;
      if (!hasSolution) {
        return { valid: false, error: 'Verification contract output is missing a non-empty expectedSolution.' };
      }
      if (!Array.isArray(output.brokenSolutions) || output.brokenSolutions.length === 0) {
        return { valid: false, error: 'Verification contract output is missing a non-empty brokenSolutions array.' };
      }
      return { valid: true };
    }
    case 'ai.generate.content': {
      const hasNotes = typeof output.notes === 'string' && output.notes.trim().length > 0;
      const hasCheatsheet = typeof output.cheatsheet === 'string' && output.cheatsheet.trim().length > 0;
      if (!hasNotes && !hasCheatsheet) {
        return { valid: false, error: 'Content output has neither notes nor a cheatsheet.' };
      }
      // Interactive content redesign: code_examples is now the primary teaching unit — one
      // step per small idea (title/explanation/code/language), not an optional afterthought.
      const steps = Array.isArray(output.code_examples) ? output.code_examples : [];
      if (steps.length === 0) {
        return { valid: false, error: 'Content output is missing a non-empty code_examples (steps) array.' };
      }
      for (const step of steps) {
        const hasTitle = typeof step?.title === 'string' && step.title.trim().length > 0;
        const hasExplanation = typeof step?.explanation === 'string' && step.explanation.trim().length > 0;
        const hasCode = typeof step?.code === 'string' && step.code.trim().length > 0;
        const hasLanguage = typeof step?.language === 'string' && step.language.trim().length > 0;
        if (!hasTitle || !hasExplanation || !hasCode || !hasLanguage) {
          return { valid: false, error: 'Every content step must have a title, explanation, code, and language.' };
        }
        // Never trust the AI's own runnable claim — coerce to false for any language outside
        // the shared allowlist, mutating the step in place (same object the caller holds).
        if (step.runnable && !RUNNABLE_LANGUAGES.includes(step.language)) {
          step.runnable = false;
        }
      }
      return { valid: true };
    }
    // Slice 6-4 (Stage 3 — Topics): structural checks only — minimum 1 topic, every topic has a
    // title, no duplicate titles. The cross-chapter prerequisite-resolution rule ("no forward-
    // only or circular prerequisites") needs DB state this stateless function doesn't have —
    // that's AiOrchestrationService.assertValidTopicListShape's job, at approval time.
    case 'ai.generate.topics': {
      const topics = Array.isArray(output.topics) ? output.topics : [];
      if (topics.length === 0) {
        return { valid: false, error: 'Topic list output has no topics.' };
      }
      if (topics.some((t: any) => typeof t?.title !== 'string' || !t.title.trim())) {
        return { valid: false, error: 'Every topic in the topic list output must have a title.' };
      }
      const titles = topics.map((t: any) => t.title.trim().toLowerCase());
      if (new Set(titles).size !== titles.length) {
        return { valid: false, error: 'Topic list output has duplicate topic titles.' };
      }
      return { valid: true };
    }
    // Slice 6-2 (Stage 1 — Syllabus): the plan's own named validation — minimum 1 chapter, no
    // duplicate titles. Mirrored again as the API-side gate in AiOrchestrationService before
    // materialization (assertValidSyllabusShape) — same defense-in-depth as ai.generate.challenge
    // above, one check at generation-completion time, one at approval time.
    case 'ai.generate.syllabus': {
      const chapters = Array.isArray(output.chapters) ? output.chapters : [];
      if (chapters.length === 0) {
        return { valid: false, error: 'Syllabus output has no chapters.' };
      }
      if (chapters.some((c: any) => typeof c?.title !== 'string' || !c.title.trim())) {
        return { valid: false, error: 'Every chapter in the syllabus output must have a title.' };
      }
      const titles = chapters.map((c: any) => c.title.trim().toLowerCase());
      if (new Set(titles).size !== titles.length) {
        return { valid: false, error: 'Syllabus output has duplicate chapter titles.' };
      }
      return { valid: true };
    }
    // "Suggest Levels via AI" (Stage 0 — one tier above Syllabus): the plan's own named
    // validation for that stage, mirrored here — minimum 1 level, every level has a name, no
    // duplicate names. Also mirrored as the API-side gate in AiOrchestrationService before
    // materialization (assertValidLevelListShape), same defense-in-depth as ai.generate.syllabus.
    case 'ai.generate.levels': {
      const levels = Array.isArray(output.levels) ? output.levels : [];
      if (levels.length === 0) {
        return { valid: false, error: 'Level list output has no levels.' };
      }
      if (levels.some((l: any) => typeof l?.name !== 'string' || !l.name.trim())) {
        return { valid: false, error: 'Every level in the level list output must have a name.' };
      }
      const names = levels.map((l: any) => l.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) {
        return { valid: false, error: 'Level list output has duplicate level names.' };
      }
      return { valid: true };
    }
    // Slice 6-3 (Stage 2 — Chapter detail): non-empty description, at least one objective.
    case 'ai.generate.chapter-detail': {
      const hasDescription = typeof output.description === 'string' && output.description.trim().length > 0;
      if (!hasDescription) {
        return { valid: false, error: 'Chapter detail output is missing a non-empty description.' };
      }
      if (!Array.isArray(output.learningObjectives) || output.learningObjectives.length === 0) {
        return { valid: false, error: 'Chapter detail output is missing a non-empty learningObjectives array.' };
      }
      return { valid: true };
    }
    default:
      // Unknown job types aren't given a stricter contract here than "must be a JSON object" —
      // already checked above.
      return { valid: true };
  }
}
