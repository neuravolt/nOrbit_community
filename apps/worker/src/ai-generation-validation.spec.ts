import { validateGeneratedOutput } from './ai-generation-validation';

describe('validateGeneratedOutput', () => {
  it('rejects a non-object response', () => {
    expect(validateGeneratedOutput('ai.generate.challenge', null).valid).toBe(false);
    expect(validateGeneratedOutput('ai.generate.challenge', 'a string').valid).toBe(false);
    expect(validateGeneratedOutput('ai.generate.challenge', ['array']).valid).toBe(false);
    expect(validateGeneratedOutput('ai.generate.challenge', undefined).valid).toBe(false);
  });

  describe('ai.generate.challenge', () => {
    it('accepts a valid challenge shape', () => {
      const result = validateGeneratedOutput('ai.generate.challenge', {
        objective: 'x',
        requirements: ['route:GET /books'],
        evaluationCriteria: ['Returns JSON'],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty requirements', () => {
      const result = validateGeneratedOutput('ai.generate.challenge', {
        requirements: [],
        evaluationCriteria: ['x'],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/requirements/);
    });

    it('rejects missing evaluationCriteria', () => {
      const result = validateGeneratedOutput('ai.generate.challenge', { requirements: ['x'] });
      expect(result.valid).toBe(false);
    });

    it('rejects the old dead shape (nested "challenge" object)', () => {
      const result = validateGeneratedOutput('ai.generate.challenge', {
        challenge: { title: 'Old Shape', starter_code: 'x' },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('ai.generate.planner', () => {
    it('accepts a non-empty levels array', () => {
      expect(validateGeneratedOutput('ai.generate.planner', { levels: [{ name: 'Level 1' }] }).valid).toBe(true);
    });

    it('rejects a missing or empty levels array', () => {
      expect(validateGeneratedOutput('ai.generate.planner', {}).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.planner', { levels: [] }).valid).toBe(false);
    });
  });

  describe('ai.generate.quiz / ai.generate.interview', () => {
    it('accepts a non-empty questions array', () => {
      expect(validateGeneratedOutput('ai.generate.quiz', { questions: [{ question: 'x' }] }).valid).toBe(true);
      expect(validateGeneratedOutput('ai.generate.interview', { questions: ['x'] }).valid).toBe(true);
    });

    it('rejects a missing or empty questions array', () => {
      expect(validateGeneratedOutput('ai.generate.quiz', {}).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.quiz', { questions: [] }).valid).toBe(false);
    });
  });

  describe('ai.generate.content', () => {
    const validStep = { title: 'Step 1', explanation: 'A short explanation.', code: 'const x = 1;', language: 'javascript' };

    it('accepts non-empty notes or a non-empty cheatsheet, plus a well-formed code_examples/steps array', () => {
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi', code_examples: [validStep] }).valid).toBe(true);
      expect(validateGeneratedOutput('ai.generate.content', { cheatsheet: 'cmds', code_examples: [validStep] }).valid).toBe(true);
    });

    it('rejects a response with neither notes nor a cheatsheet', () => {
      expect(validateGeneratedOutput('ai.generate.content', { code_examples: [validStep] }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.content', { notes: '   ', code_examples: [validStep] }).valid).toBe(false);
    });

    // Interactive content redesign: code_examples/steps is now the primary teaching unit, not an
    // optional afterthought — a response with notes/cheatsheet but no steps must still fail.
    it('rejects a response missing a non-empty code_examples (steps) array', () => {
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi' }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi', code_examples: [] }).valid).toBe(false);
    });

    it('rejects a step missing title, explanation, code, or language', () => {
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi', code_examples: [{ ...validStep, title: '' }] }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi', code_examples: [{ ...validStep, explanation: '' }] }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi', code_examples: [{ ...validStep, code: '' }] }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.content', { notes: '# hi', code_examples: [{ ...validStep, language: '' }] }).valid).toBe(false);
    });

    // Allowlist enforcement (Verification item 9 of the interactive-content plan): the AI's own
    // runnable:true claim must never be trusted for a language outside
    // SUPPORTED_LIVE_EXECUTION_LANGUAGES — validateGeneratedOutput must coerce it back to false,
    // mutating the caller's own step object in place (the caller never re-reads a return value).
    it('coerces runnable to false for a language outside the shared allowlist, even when the AI set it to true', () => {
      const step = { ...validStep, language: 'python', runnable: true };
      const output = { notes: '# hi', code_examples: [step] };
      const result = validateGeneratedOutput('ai.generate.content', output);
      expect(result.valid).toBe(true);
      expect((output.code_examples[0] as any).runnable).toBe(false);
    });

    it('leaves runnable:true untouched for a language that is actually in the allowlist', () => {
      const step = { ...validStep, language: 'jsx', runnable: true };
      const output = { notes: '# hi', code_examples: [step] };
      validateGeneratedOutput('ai.generate.content', output);
      expect((output.code_examples[0] as any).runnable).toBe(true);
    });
  });

  it('an unknown job type only requires a JSON object', () => {
    expect(validateGeneratedOutput('ai.some.unknown.type', { anything: true }).valid).toBe(true);
  });

  // Launchpad Phase 6, Slice 6-2 (Stage 1 — Syllabus) — the plan's own named validation.
  describe('ai.generate.syllabus', () => {
    it('accepts a non-empty chapters array with unique titles', () => {
      const result = validateGeneratedOutput('ai.generate.syllabus', {
        chapters: [
          { title: 'Foundations', theme: 'a', sortOrder: 1 },
          { title: 'Advanced', theme: 'b', sortOrder: 2 },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a missing or empty chapters array', () => {
      expect(validateGeneratedOutput('ai.generate.syllabus', {}).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.syllabus', { chapters: [] }).valid).toBe(false);
    });

    it('rejects a chapter with no title', () => {
      const result = validateGeneratedOutput('ai.generate.syllabus', {
        chapters: [{ theme: 'a', sortOrder: 1 }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate chapter titles, case-insensitively', () => {
      const result = validateGeneratedOutput('ai.generate.syllabus', {
        chapters: [
          { title: 'Foundations', theme: 'a', sortOrder: 1 },
          { title: 'FOUNDATIONS', theme: 'b', sortOrder: 2 },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
    });
  });

  // "Suggest Levels via AI" (Stage 0, one tier above Syllabus) — same shape/duplicate checks as
  // ai.generate.syllabus above, one tier up (levels instead of chapters).
  describe('ai.generate.levels', () => {
    it('accepts a non-empty levels array with unique names', () => {
      const result = validateGeneratedOutput('ai.generate.levels', {
        levels: [
          { name: 'L1: Dart Foundations', description: 'a', difficulty: 'beginner' },
          { name: 'L2: Widgets & Layout', description: 'b', difficulty: 'intermediate' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a missing or empty levels array', () => {
      expect(validateGeneratedOutput('ai.generate.levels', {}).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.levels', { levels: [] }).valid).toBe(false);
    });

    it('rejects a level with no name', () => {
      const result = validateGeneratedOutput('ai.generate.levels', {
        levels: [{ description: 'a', difficulty: 'beginner' }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate level names, case-insensitively', () => {
      const result = validateGeneratedOutput('ai.generate.levels', {
        levels: [
          { name: 'L1: Dart Foundations', description: 'a' },
          { name: 'l1: dart foundations', description: 'b' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
    });
  });

  // Launchpad Phase 6, Slice 6-3 (Stage 2 — Chapter detail) — the plan's own named validation.
  describe('ai.generate.chapter-detail', () => {
    it('accepts a non-empty description and at least one learning objective', () => {
      const result = validateGeneratedOutput('ai.generate.chapter-detail', {
        description: 'A full expansion.',
        learningObjectives: ['Explain the event loop'],
        estimatedDurationHours: 5,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a missing or empty description', () => {
      expect(validateGeneratedOutput('ai.generate.chapter-detail', { learningObjectives: ['a'] }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.chapter-detail', { description: '   ', learningObjectives: ['a'] }).valid).toBe(false);
    });

    it('rejects a missing or empty learningObjectives array', () => {
      expect(validateGeneratedOutput('ai.generate.chapter-detail', { description: 'x' }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.chapter-detail', { description: 'x', learningObjectives: [] }).valid).toBe(false);
    });
  });

  // Launchpad Phase 6, Slice 6-4 (Stage 3 — Topics) — structural checks only; the cross-chapter
  // prerequisite-resolution rule needs DB state this stateless function doesn't have.
  describe('ai.generate.topics', () => {
    it('accepts a non-empty topics array with unique titles', () => {
      const result = validateGeneratedOutput('ai.generate.topics', {
        topics: [
          { title: 'Callbacks', objective: 'a', sortOrder: 1 },
          { title: 'Promises', objective: 'b', sortOrder: 2 },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a missing or empty topics array', () => {
      expect(validateGeneratedOutput('ai.generate.topics', {}).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.topics', { topics: [] }).valid).toBe(false);
    });

    it('rejects a topic with no title', () => {
      const result = validateGeneratedOutput('ai.generate.topics', { topics: [{ objective: 'a', sortOrder: 1 }] });
      expect(result.valid).toBe(false);
    });

    it('rejects duplicate topic titles, case-insensitively', () => {
      const result = validateGeneratedOutput('ai.generate.topics', {
        topics: [
          { title: 'Callbacks', objective: 'a', sortOrder: 1 },
          { title: 'CALLBACKS', objective: 'b', sortOrder: 2 },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/duplicate/i);
    });
  });

  // Launchpad Phase 6, Slice 6-6 (Stage 5 — Assessment) — mirrors github-roadmap.service.ts's
  // own runtime check on title.
  describe('ai.generate.mini-project', () => {
    it('accepts a non-empty title and description', () => {
      expect(validateGeneratedOutput('ai.generate.mini-project', { title: 'Build a Todo API', description: 'x' }).valid).toBe(true);
    });

    it('rejects a missing or empty title', () => {
      expect(validateGeneratedOutput('ai.generate.mini-project', { description: 'x' }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.mini-project', { title: '  ', description: 'x' }).valid).toBe(false);
    });

    it('rejects a missing or empty description', () => {
      expect(validateGeneratedOutput('ai.generate.mini-project', { title: 'x' }).valid).toBe(false);
    });
  });

  // Launchpad Phase 5B, Slice 5B-15 (Stage 6a — Challenge Verification Contracts).
  describe('ai.generate.verification-contract', () => {
    it('accepts a non-empty expectedSolution and at least one brokenSolutions entry', () => {
      const result = validateGeneratedOutput('ai.generate.verification-contract', {
        expectedSolution: 'code',
        brokenSolutions: ['broken code'],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a missing or empty expectedSolution', () => {
      expect(validateGeneratedOutput('ai.generate.verification-contract', { brokenSolutions: ['x'] }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.verification-contract', { expectedSolution: '  ', brokenSolutions: ['x'] }).valid).toBe(false);
    });

    it('rejects a missing or empty brokenSolutions array', () => {
      expect(validateGeneratedOutput('ai.generate.verification-contract', { expectedSolution: 'x' }).valid).toBe(false);
      expect(validateGeneratedOutput('ai.generate.verification-contract', { expectedSolution: 'x', brokenSolutions: [] }).valid).toBe(false);
    });
  });
});
