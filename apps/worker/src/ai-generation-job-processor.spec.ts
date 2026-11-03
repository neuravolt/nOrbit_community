import { processAiGenerationJob, AiGenerationJobDeps } from './ai-generation-job-processor';

// Phase 5A (AI Worker Fail-Closed, Step 3). This is the one production-reachable AI generation
// consumer (apps/worker's aiWorker). Before this fix, every one of these failure modes was
// caught and silently replaced with getFallbackMock()'s placeholder content, then marked
// `completed` — a mock-generated job was indistinguishable from a real success anywhere in the
// admin UI. Confirms each failure mode now marks the job `failed` with a real errorMessage, and
// that mock/fallback content is never written as if it were a real result.
describe('processAiGenerationJob', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  const launchpadJob = {
    id: 'bull-1',
    name: 'ai.generate.challenge',
    data: {
      jobId: 'job-1',
      isLaunchpad: true,
      inputData: { topic: 'Books API', technology: 'Express', difficulty: 'beginner' },
    },
  } as any;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn();
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('a valid Gemini response is persisted verbatim and the job marked completed', async () => {
    const validOutput = {
      objective: 'Build a books endpoint.',
      requirements: ['route:GET /books'],
      evaluationCriteria: ['Returns valid JSON'],
    };
    callGeminiMock.mockResolvedValue(validOutput);

    const result = await processAiGenerationJob(launchpadJob, deps);

    expect(result).toEqual(validOutput);
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'completed',
    );
    expect(completedCall[0].data.outputData).toEqual(validOutput);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('Gemini API failure marks the job failed — never substitutes mock content', async () => {
    callGeminiMock.mockRejectedValue(new Error('Gemini API returned error status 500: quota exceeded'));

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow('quota exceeded');

    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall).toBeTruthy();
    expect(failedCall[0].data.errorMessage).toMatch(/quota exceeded/);
    // The only outputData write attempted anywhere was never a "completed" one.
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('a Gemini timeout marks the job failed', async () => {
    callGeminiMock.mockRejectedValue(new Error('Gemini API call timed out after 30000ms'));

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow('timed out');

    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall[0].data.errorMessage).toMatch(/timed out/);
  });

  it('malformed JSON from Gemini marks the job failed', async () => {
    callGeminiMock.mockRejectedValue(new Error('Gemini API returned malformed JSON: Unexpected token'));

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow('malformed JSON');

    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall).toBeTruthy();
  });

  it('an empty Gemini response marks the job failed', async () => {
    callGeminiMock.mockRejectedValue(new Error('Gemini API response format invalid or empty.'));

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow('invalid or empty');

    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall).toBeTruthy();
  });

  it('a schema-invalid (but well-formed JSON) response marks the job failed, not completed', async () => {
    callGeminiMock.mockResolvedValue({ objective: 'x' }); // missing requirements/evaluationCriteria

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow(/schema validation/);

    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall[0].data.errorMessage).toMatch(/schema validation/);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('an unexpected exception mid-processing marks the job failed', async () => {
    prismaMock.launchpadAiPrompt.findUnique.mockRejectedValue(new Error('DB connection lost'));

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow('DB connection lost');

    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall[0].data.errorMessage).toBe('DB connection lost');
  });

  it('a missing/unconfigured API key marks the job failed — never silently falls back to mock data', async () => {
    getGeminiApiKeyMock.mockResolvedValue(undefined);

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow(/not configured/);

    expect(callGeminiMock).not.toHaveBeenCalled();
    const failedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'failed',
    );
    expect(failedCall).toBeTruthy();
  });

  it('a MOCK_KEY placeholder is treated the same as no key — marks the job failed', async () => {
    getGeminiApiKeyMock.mockResolvedValue('MOCK_KEY');

    await expect(processAiGenerationJob(launchpadJob, deps)).rejects.toThrow(/not configured/);
    expect(callGeminiMock).not.toHaveBeenCalled();
  });

  it('legacy (non-Launchpad) jobs are still routed to the aIGenerationJob table on both success and failure', async () => {
    const legacyJob = {
      ...launchpadJob,
      data: { ...launchpadJob.data, isLaunchpad: false, targetType: 'node' },
    };
    callGeminiMock.mockResolvedValue({
      objective: 'x',
      requirements: ['route:GET /books'],
      evaluationCriteria: ['y'],
    });

    await processAiGenerationJob(legacyJob, deps);

    expect(prismaMock.aIGenerationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalled();
  });
});

// Launchpad Phase 5B, Slice 5B-4 — the plan's own named acceptance test: "regenerate-with-
// instruction asserts the instruction reaches the persisted prompt." Proves the actual string
// sent to Gemini, not just that some job field was set.
describe('processAiGenerationJob — Slice 5B-4 scoped quiz-question regeneration', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({ questions: [{ question: 'New Q?', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'because' }] });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it("the professor's instruction reaches the actual prompt string sent to Gemini", async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Event Loop',
          technology: 'Node.js',
          scope: 'quiz-question',
          targetIndex: 1,
          existingQuizQuestions: [
            { question: 'Q1?', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'e1' },
            { question: 'Q2 (being replaced)?', options: ['a', 'b', 'c', 'd'], correct_answer: 1, explanation: 'e2' },
          ],
          context: { instruction: 'make it about microtask ordering specifically' },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('make it about microtask ordering specifically');
    expect(sentPrompt).toContain('Event Loop');
    expect(sentPrompt).toContain('Node.js');
    expect(sentPrompt).toContain('EXACTLY ONE');
    // The prompt shows the OTHER question (Q1) as context but never the one being replaced (Q2) —
    // asking the model to avoid duplicating Q1, not to avoid duplicating the thing it's replacing.
    expect(sentPrompt).toContain('Q1?');
    expect(sentPrompt).not.toContain('Q2 (being replaced)?');
  });

  it('returns exactly one question, the shape approveJobOutput expects to splice into the live array', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { topic: 'Event Loop', technology: 'Node.js', scope: 'quiz-question', targetIndex: 0, existingQuizQuestions: [] },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.questions).toHaveLength(1);
  });
});

// Launchpad Phase 5B, Slice 5B-5 — the content-revision branch of the same acceptance test:
// "V3's persisted prompt literally contains V2's content and the instruction."
describe('processAiGenerationJob — Slice 5B-5 content revision (V1 -> instruction -> V2)', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      notes: 'revised notes',
      code_examples: [{ title: 'Step 1', explanation: 'An example.', code: 'const x = 1;', language: 'javascript' }],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('a regeneration with prior version history revises the current content instead of starting from scratch', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Event Loop',
          technology: 'Node.js',
          difficulty: 'intermediate',
          context: {
            instruction: 'add a practical code example of setTimeout vs. a Promise ordering',
            currentApprovedContent: { notes: 'The event loop processes callbacks in phases: timers, I/O, then microtasks.' },
            versionHistorySummary: { versionNumber: 1, instruction: null },
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('The event loop processes callbacks in phases: timers, I/O, then microtasks.');
    expect(sentPrompt).toContain('add a practical code example of setTimeout vs. a Promise ordering');
    expect(sentPrompt).toContain('CURRENT approved content');
    expect(sentPrompt).not.toContain('Write learning content for'); // must not fall through to the from-scratch template
  });

  it('a first-ever generation (no currentApprovedContent yet) falls through to the plain from-scratch template', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Event Loop',
          technology: 'Node.js',
          difficulty: 'intermediate',
          context: { instruction: null, currentApprovedContent: null, versionHistorySummary: null },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Write learning content for');
    expect(sentPrompt).not.toContain('CURRENT approved content');
  });
});

// Launchpad Phase 5B, Slice 5B-7 — hidden-test generation prompt.
describe('processAiGenerationJob — Slice 5B-7 hidden-test generation', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      tests: [{ name: 'Returns 200', testCode: "test('returns 200', () => {});", points: 10 }],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it("the challenge's requirements and evaluation criteria reach the actual prompt sent to Gemini", async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.hidden-tests',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Books API',
          technology: 'Express',
          difficulty: 'beginner',
          codingChallenge: {
            objective: 'Build a REST endpoint that lists books.',
            requirements: ['route:GET /books', 'component:BookList'],
            evaluationCriteria: ['Returns a 200 with a JSON array'],
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('route:GET /books');
    expect(sentPrompt).toContain('Returns a 200 with a JSON array');
    expect(sentPrompt).toContain('Build a REST endpoint that lists books.');
  });

  it('returns the tests array shape approveJobOutput expects, unmodified', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.hidden-tests',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'X', technology: 'Y', codingChallenge: {} } },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe('Returns 200');
  });
});

// "Suggest Levels via AI" — Stage 0, one tier above Syllabus (Stage 1). No Level exists yet at
// this point; this is what creates them.
describe('processAiGenerationJob — level list generation ("Suggest Levels via AI")', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      levels: [
        { name: 'Dart Foundations', description: 'Variables, functions, and null safety.', difficulty: 'beginner', estimatedDurationHours: 12 },
        { name: 'Widgets & Layout', description: 'Building real screens with Flutter widgets.', difficulty: 'intermediate', estimatedDurationHours: 20 },
      ],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('builds a prompt from input.context (career/role/technology), asking for an ordered "levels" array', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.levels',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          technology: 'Flutter',
          context: {
            career: { name: 'Software Engineering' },
            role: { name: 'Mobile Developer', description: 'Builds native and cross-platform mobile apps.' },
            technology: { name: 'Flutter', slug: 'flutter' },
            existingLevelNames: [],
            instruction: null,
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Software Engineering');
    expect(sentPrompt).toContain('Mobile Developer');
    expect(sentPrompt).toContain('Flutter');
    expect(sentPrompt).toContain('Builds native and cross-platform mobile apps.');
    expect(sentPrompt).toContain('"levels"');
  });

  it('tells the model about existing Levels so a top-up run does not duplicate or renumber them', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.levels',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          technology: 'Flutter',
          context: { technology: { name: 'Flutter' }, existingLevelNames: ['L1: Dart Foundations'], instruction: null },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('L1: Dart Foundations');
  });

  it('a valid level-list response is persisted verbatim and the job marked completed', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.levels',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { technology: 'Flutter', context: { technology: { name: 'Flutter' }, existingLevelNames: [] } },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.levels).toHaveLength(2);
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'completed',
    );
    expect(completedCall[0].data.outputData.levels).toHaveLength(2);
  });

  it('an empty levels array fails schema validation — job marked failed, never completed', async () => {
    callGeminiMock.mockResolvedValue({ levels: [] });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.levels',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { technology: 'Flutter', context: { technology: { name: 'Flutter' }, existingLevelNames: [] } },
      },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/no levels/i);
  });
});

// Launchpad Phase 6, Slice 6-2 (Stage 1 — Syllabus).
describe('processAiGenerationJob — Slice 6-2 syllabus generation', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      chapters: [
        { title: 'Foundations', theme: 'Core syntax and setup', sortOrder: 1 },
        { title: 'Async Patterns', theme: 'Promises and the event loop', sortOrder: 2 },
      ],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('builds a prompt from input.context (career/role/level), not the flat topic token', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Intermediate',
          technology: 'Node.js',
          difficulty: 'intermediate',
          context: {
            career: { name: 'Software Engineering' },
            role: { name: 'Backend Developer' },
            technology: { name: 'Node.js', slug: 'nodejs' },
            level: { name: 'Intermediate', description: 'Async programming patterns', difficulty: 'intermediate' },
            instruction: null,
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Software Engineering');
    expect(sentPrompt).toContain('Backend Developer');
    expect(sentPrompt).toContain('Async programming patterns');
    expect(sentPrompt).toContain('"chapters"');
  });

  it('includes the professor instruction when regenerating', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Node.js' },
            level: { name: 'Intermediate', description: 'x', difficulty: 'intermediate' },
            instruction: 'Add a chapter specifically on streams',
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    expect(callGeminiMock.mock.calls[0][0]).toContain('Add a chapter specifically on streams');
  });

  // Role/Technology description previously never reached any prompt — only `.name` did, no
  // matter how the admin wrote it when creating the Role/Technology. Explicit design decision:
  // this is a standing quality bar, so it belongs in every stage's prompt, starting here at
  // Stage 1.
  it("includes the Role/Technology description as a standing quality bar", async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Flutter', description: 'Cross-platform mobile apps with a single Dart codebase.' },
            role: { name: 'Mobile Developer', description: 'Builds native and cross-platform mobile apps, ending in a verified portfolio.' },
            level: { name: 'Foundations', description: 'x', difficulty: 'beginner' },
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Builds native and cross-platform mobile apps, ending in a verified portfolio.');
    expect(sentPrompt).toContain('Cross-platform mobile apps with a single Dart codebase.');
  });

  it('still sends the quality-bar line (the standing style rule) when neither Role nor Technology has a description', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' } } },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    const sentPrompt = callGeminiMock.mock.calls[0][0];
    // The "no em dash" style rule is topic-independent and always sent — only the Role/
    // Technology description sentences are conditional on the admin having filled them in.
    expect(sentPrompt).toContain('Professional standard');
    expect(sentPrompt).toContain('Never use an em dash or en dash');
  });

  it('a valid syllabus response is persisted verbatim and the job marked completed', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' } } },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.chapters).toHaveLength(2);
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'completed',
    );
    expect(completedCall[0].data.outputData.chapters).toHaveLength(2);
  });

  it('an empty chapters array fails schema validation — job marked failed, never completed', async () => {
    callGeminiMock.mockResolvedValue({ chapters: [] });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' } } },
      },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/no chapters/i);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('duplicate chapter titles fail schema validation', async () => {
    callGeminiMock.mockResolvedValue({
      chapters: [
        { title: 'Foundations', theme: 'a', sortOrder: 1 },
        { title: 'foundations', theme: 'b', sortOrder: 2 }, // case-insensitive duplicate
      ],
    });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.syllabus',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' } } },
      },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/duplicate/i);
  });
});

// Launchpad Phase 6, Slice 6-3 (Stage 2 — Chapter detail).
describe('processAiGenerationJob — Slice 6-3 chapter detail generation', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      description: 'A full expansion of the chapter.',
      learningObjectives: ['Explain the event loop'],
      estimatedDurationHours: 5,
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('builds a prompt from the chapter + sibling context, not sibling detail', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.chapter-detail',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Node.js' },
            level: { name: 'Intermediate', description: 'x', difficulty: 'intermediate' },
            chapter: { title: 'Async Foundations', theme: 'Async programming', siblingChapterTitles: ['Databases'] },
            instruction: null,
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Async Foundations');
    expect(sentPrompt).toContain('Databases'); // sibling TITLE only
    expect(sentPrompt).toContain('"description"');
    expect(sentPrompt).toContain('"estimatedDurationHours"');
  });

  // Previously missing entirely: buildChapterContext has always carried ctx.level.description
  // (Stage 1's syllabus prompt reads it), but this stage never read it — a Level's own scope was
  // lost the moment Stage 2 started.
  it("includes the Level's own description, not just its name", async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.chapter-detail',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Node.js' },
            level: { name: 'Intermediate', description: 'Real-world async patterns, not toy examples.', difficulty: 'intermediate' },
            chapter: { title: 'Async Foundations', theme: 'Async programming', siblingChapterTitles: [] },
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Real-world async patterns, not toy examples.');
  });

  it('includes the Role/Technology description as a standing quality bar', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.chapter-detail',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Flutter', description: 'Cross-platform mobile apps with a single Dart codebase.' },
            role: { name: 'Mobile Developer', description: 'Builds native and cross-platform mobile apps, ending in a verified portfolio.' },
            level: { name: 'Foundations', description: 'x', difficulty: 'beginner' },
            chapter: { title: 'Dart Basics', theme: 'x', siblingChapterTitles: [] },
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Builds native and cross-platform mobile apps, ending in a verified portfolio.');
  });

  it('includes the professor instruction when regenerating', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.chapter-detail',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Node.js' },
            level: { name: 'X', description: '', difficulty: 'beginner' },
            chapter: { title: 'X', theme: 'x', siblingChapterTitles: [] },
            instruction: 'Make it beginner-friendly',
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Make it beginner-friendly');
  });

  it('a valid response is persisted verbatim and the job marked completed', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.chapter-detail',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' }, chapter: { title: 'X', theme: 'x', siblingChapterTitles: [] } } },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.estimatedDurationHours).toBe(5);
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'completed',
    );
    expect(completedCall[0].data.outputData.learningObjectives).toEqual(['Explain the event loop']);
  });

  it('an empty learningObjectives array fails schema validation — job marked failed, never completed', async () => {
    callGeminiMock.mockResolvedValue({ description: 'x', learningObjectives: [], estimatedDurationHours: 5 });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.chapter-detail',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' }, chapter: { title: 'X', theme: 'x', siblingChapterTitles: [] } } },
      },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/learningObjectives/i);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });
});

// Launchpad Phase 6, Slice 6-4 (Stage 3 — Topics).
describe('processAiGenerationJob — Slice 6-4 topic list generation', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      topics: [
        { title: 'Callbacks', objective: 'Understand callbacks', sortOrder: 1 },
        { title: 'Promises', objective: 'Understand promises', prerequisiteTopicTitles: ['Callbacks'], sortOrder: 2 },
      ],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('builds a prompt grounded in the chapter\'s own Stage 2 detail', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.topics',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          context: {
            technology: { name: 'Node.js' },
            level: { name: 'Intermediate', description: 'x', difficulty: 'intermediate' },
            chapter: { title: 'Async Foundations', theme: 'Async programming', siblingChapterTitles: [] },
            chapterDetail: { objectivesSummary: { learningObjectives: ['Explain the event loop'], estimatedDurationHours: 6 } },
            instruction: null,
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Async Foundations');
    expect(sentPrompt).toContain('Explain the event loop');
    expect(sentPrompt).toContain('"prerequisiteTopicTitles"');
  });

  it('a valid response is persisted verbatim and the job marked completed', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.topics',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' }, chapter: { title: 'X', theme: 'x', siblingChapterTitles: [] }, chapterDetail: {} } },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.topics).toHaveLength(2);
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find(
      (c: any) => c[0].data.status === 'completed',
    );
    expect(completedCall[0].data.outputData.topics).toHaveLength(2);
  });

  it('an empty topics array fails schema validation — job marked failed, never completed', async () => {
    callGeminiMock.mockResolvedValue({ topics: [] });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.topics',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' }, chapter: { title: 'X', theme: 'x', siblingChapterTitles: [] }, chapterDetail: {} } },
      },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/no topics/i);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('duplicate topic titles fail schema validation', async () => {
    callGeminiMock.mockResolvedValue({
      topics: [{ title: 'X', objective: 'a', sortOrder: 1 }, { title: 'x', objective: 'b', sortOrder: 2 }],
    });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.topics',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { context: { technology: { name: 'Node.js' }, level: { name: 'X', description: '', difficulty: 'beginner' }, chapter: { title: 'X', theme: 'x', siblingChapterTitles: [] }, chapterDetail: {} } },
      },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/duplicate/i);
  });
});

// Launchpad Phase 6, Slice 6-5 (Stage 4 — Content, re-scoped to Topic). GenerationContextBuilder
// has built and persisted this structured object onto inputData.context since 5B-3 — this slice
// is about the prompt actually READING it, which neither content branch did before now.
describe('processAiGenerationJob — Slice 6-5 topic-scoped content grounding', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  const richContext = {
    chapter: { title: 'Async Foundations', theme: 'Asynchronous programming patterns', siblingChapterTitles: [] },
    topic: {
      title: 'Event Loop',
      learningObjectives: ['Explain the event loop phases'],
      prerequisiteTopics: [{ id: 't1', title: 'Callbacks', learningObjectives: ['x'] }],
    },
    instruction: null,
    currentApprovedContent: null,
    versionHistorySummary: null,
  };

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      notes: 'generated notes',
      code_examples: [{ title: 'Step 1', explanation: 'An example.', code: 'const x = 1;', language: 'javascript' }],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('a first-ever generation is grounded in the chapter theme, the topic\'s own objectives, and prerequisite TITLES — never their full content', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'Event Loop', technology: 'Node.js', difficulty: 'intermediate', context: richContext } },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Asynchronous programming patterns');
    expect(sentPrompt).toContain('Explain the event loop phases');
    expect(sentPrompt).toContain('Callbacks'); // prerequisite TITLE
    expect(sentPrompt).not.toContain('"x"'); // never the prerequisite's own learningObjectives content
  });

  it('a regeneration is ALSO grounded in the chapter/prerequisite context, alongside the existing content being revised', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Event Loop',
          technology: 'Node.js',
          difficulty: 'intermediate',
          context: { ...richContext, currentApprovedContent: { notes: 'old notes' } },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('old notes');
    expect(sentPrompt).toContain('Asynchronous programming patterns');
  });

  it('a node with no context object at all (predates the staged pipeline) still generates — gracefully no grounding, not an error', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'Legacy Topic', technology: 'Node.js', difficulty: 'beginner' } },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.notes).toBe('generated notes');
    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Write learning content for Legacy Topic in Node.js at beginner level.');
    expect(sentPrompt).not.toMatch(/chapter is themed|learning objective\(s\)|prerequisite topics/);
  });

  it('a chapter/topic with no theme/objectives/prerequisites yields no grounding text, not empty-string artifacts', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Bare Topic',
          technology: 'Node.js',
          difficulty: 'beginner',
          context: { chapter: null, topic: null, instruction: null, currentApprovedContent: null, versionHistorySummary: null },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('Write learning content for Bare Topic in Node.js at beginner level.');
    expect(sentPrompt).not.toMatch(/chapter is themed|learning objective\(s\)|prerequisite topics/);
  });

  it('the plain first-ever generation prompt tells Gemini the required output shape', async () => {
    // Regression test for a real bug found during live pilot testing: this branch never
    // specified notes/cheatsheet as required fields, so Gemini was free to invent its own JSON
    // shape and reliably failed validateGeneratedOutput's 'ai.generate.content' check.
    const job = {
      id: 'bull-1',
      name: 'ai.generate.content',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'Fresh Topic', technology: 'Node.js', difficulty: 'beginner' } },
    } as any;

    await processAiGenerationJob(job, deps);
    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('notes');
    expect(sentPrompt).toContain('cheatsheet');
    expect(sentPrompt).toMatch(/Return a JSON object/);
  });
});

// Launchpad Phase 6, Slice 6-6 (Stage 5 — Assessment, independent per artifact).
describe('processAiGenerationJob — Slice 6-6 quiz/challenge grounding fix', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
  });

  // Before this slice, {{notes}} always resolved empty for the live path — the producer
  // (AiOrchestrationService.queueNodeGeneration) never populated inputData.notes; only the dead
  // Pipeline B (ai-generation-jobs.service.ts) did. This proves the fix reads the real approved
  // content instead, via input.context.currentApprovedContent (populated by buildContext since
  // 5B-3, and already present on every queueNodeGeneration call regardless of job type).
  it('ai.generate.quiz is grounded in the topic\'s real approved notes, not an always-empty {{notes}} token', async () => {
    callGeminiMock = jest.fn().mockResolvedValue({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'e' }] });
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { topic: 'Event Loop', technology: 'Node.js', context: { currentApprovedContent: { notes: 'The event loop processes callbacks in phases.' } } },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('The event loop processes callbacks in phases.');
  });

  it('ai.generate.quiz also includes the Role/Technology description as a standing quality bar', async () => {
    callGeminiMock = jest.fn().mockResolvedValue({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'e' }] });
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Widgets',
          technology: 'Flutter',
          context: {
            currentApprovedContent: { notes: 'Widgets compose the UI tree.' },
            role: { name: 'Mobile Developer', description: 'Builds native and cross-platform mobile apps, ending in a verified portfolio.' },
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Builds native and cross-platform mobile apps, ending in a verified portfolio.');
  });

  it('ai.generate.challenge is grounded in the topic\'s real approved notes', async () => {
    callGeminiMock = jest.fn().mockResolvedValue({ objective: 'x', requirements: ['a'], evaluationCriteria: ['b'] });
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
    const job = {
      id: 'bull-1',
      name: 'ai.generate.challenge',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { topic: 'Event Loop', technology: 'Node.js', difficulty: 'intermediate', context: { currentApprovedContent: { notes: 'Promises resolve asynchronously.' } } },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Promises resolve asynchronously.');
  });

  it('a topic with no approved content yet still generates a real prompt, not an empty substitution', async () => {
    callGeminiMock = jest.fn().mockResolvedValue({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'e' }] });
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'Event Loop', technology: 'Node.js' } },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('(no approved content yet for this topic)');
  });

  // AiOrchestrationService.assertGenerationSequenceAllowed only requires Content to be APPROVED
  // (saveDraft merges into draftContent) before unblocking Quiz — not Published (which is what
  // populates currentApprovedContent, a real LaunchpadContentVersion). Confirmed live: the gate
  // allowed Quiz generation for an approved-but-unpublished topic, yet currentApprovedContent was
  // still null. Without this fallback, that gate-approved generation would silently ground on
  // nothing, exactly the bug the gate was built to prevent.
  it('falls back to currentDraft.notes when currentApprovedContent is null (Content approved but not yet Published)', async () => {
    callGeminiMock = jest.fn().mockResolvedValue({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'e' }] });
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Event Loop',
          technology: 'Node.js',
          context: { currentApprovedContent: null, currentDraft: { notes: 'Draft notes: the event loop has phases.' } },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Draft notes: the event loop has phases.');
  });

  it('prefers currentApprovedContent over currentDraft when both exist (Published content wins)', async () => {
    callGeminiMock = jest.fn().mockResolvedValue({ questions: [{ question: 'q', options: ['a', 'b', 'c', 'd'], correct_answer: 0, explanation: 'e' }] });
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
    const job = {
      id: 'bull-1',
      name: 'ai.generate.quiz',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Event Loop',
          technology: 'Node.js',
          context: {
            currentApprovedContent: { notes: 'Published notes.' },
            currentDraft: { notes: 'A newer, unpublished draft.' },
          },
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('Published notes.');
    expect(callGeminiMock.mock.calls[0][0]).not.toContain('A newer, unpublished draft.');
  });
});

describe('processAiGenerationJob — Slice 6-6 interview question generation', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      questions: [
        { pattern: 'addEventListener', question: 'Explain the event loop.', difficulty: 'medium', expectedAnswer: 'x', evaluationRubric: ['mentions microtasks'] },
        { pattern: 'Promise', question: 'What is a Promise?', difficulty: 'easy', expectedAnswer: 'y', evaluationRubric: ['mentions resolve/reject'] },
      ],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('has its own dedicated prompt branch now — previously fell through to the content fallback and failed validation', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.interview',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { topic: 'Event Loop', technology: 'Node.js', difficulty: 'intermediate', context: { currentApprovedContent: { notes: 'x' } } },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);

    // The rich shape understanding.validator.ts actually reads.
    expect(result.questions[0].pattern).toBeDefined();
    expect(result.questions[0].expectedAnswer).toBeDefined();
    expect(result.questions[0].evaluationRubric).toBeDefined();
    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('"pattern"');
    expect(sentPrompt).toContain('"evaluationRubric"');
    expect(sentPrompt).not.toContain('Write learning content for'); // never falls to the wrong-shaped fallback
  });

  it('a valid interview response is persisted and the job marked completed', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.interview',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'X', technology: 'Y', context: {} } },
    } as any;

    await processAiGenerationJob(job, deps);
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find((c: any) => c[0].data.status === 'completed');
    expect(completedCall[0].data.outputData.questions).toHaveLength(2);
  });
});

describe('processAiGenerationJob — Slice 6-6 mini-project generation (new job type)', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      title: 'Build a Todo API',
      description: 'Build a small REST API for managing todos.',
      requirements: ['route:POST /todos'],
      deliverables: ['A working repo with tests'],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('generates the {title, description, requirements, deliverables} shape github-roadmap.service.ts requires', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.mini-project',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { topic: 'Event Loop', technology: 'Node.js', difficulty: 'intermediate', context: { currentApprovedContent: { notes: 'x' } } },
      },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.title).toBe('Build a Todo API');
    expect(result.description).toBeTruthy();
    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('"title"');
    expect(sentPrompt).toContain('"deliverables"');
  });

  it('a response missing title/description fails schema validation — job marked failed, never completed', async () => {
    callGeminiMock.mockResolvedValue({ description: 'no title here' });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.mini-project',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { topic: 'X', technology: 'Y', context: {} } },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/title|description/i);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });
});

// Launchpad Phase 5B, Slice 5B-15 (Stage 6a — Challenge Verification Contracts).
describe('processAiGenerationJob — Slice 5B-15 verification contract generation', () => {
  let prismaMock: any;
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;
  let deps: AiGenerationJobDeps;

  beforeEach(() => {
    prismaMock = {
      aIGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiGenerationJob: { update: jest.fn().mockResolvedValue({}) },
      launchpadAiPrompt: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    callGeminiMock = jest.fn().mockResolvedValue({
      expectedSolution: "app.get('/books', (req, res) => res.json([]));",
      brokenSolutions: ["app.get('/books', (req, res) => res.send());"],
    });
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
    deps = { prisma: prismaMock, callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock };
  });

  it('grounds the prompt in the real challenge spec and approved hidden tests', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.verification-contract',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: {
          topic: 'Books API',
          technology: 'Express',
          technologySlug: 'express',
          codingChallenge: { objective: 'Build a books endpoint.', requirements: ['route:GET /books'], evaluationCriteria: ['Returns valid JSON'] },
          hiddenTests: [{ name: 'Returns 200', testCode: 'expect(res.status).toBe(200);' }],
        },
      },
    } as any;

    await processAiGenerationJob(job, deps);

    const sentPrompt = callGeminiMock.mock.calls[0][0];
    expect(sentPrompt).toContain('route:GET /books');
    expect(sentPrompt).toContain('Returns 200');
    expect(sentPrompt).toContain('"expectedSolution"');
    expect(sentPrompt).toContain('"brokenSolutions"');
  });

  it('includes the professor instruction as a reason to propose customWeights/customGates when supplied', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.verification-contract',
      data: {
        jobId: 'job-1',
        isLaunchpad: true,
        inputData: { codingChallenge: {}, hiddenTests: [], instruction: 'This challenge is really about error handling — weight it more' },
      },
    } as any;

    await processAiGenerationJob(job, deps);
    expect(callGeminiMock.mock.calls[0][0]).toContain('really about error handling');
  });

  it('a valid response is persisted verbatim and the job marked completed', async () => {
    const job = {
      id: 'bull-1',
      name: 'ai.generate.verification-contract',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { codingChallenge: {}, hiddenTests: [] } },
    } as any;

    const result = await processAiGenerationJob(job, deps);
    expect(result.expectedSolution).toBeTruthy();
    const completedCall = prismaMock.launchpadAiGenerationJob.update.mock.calls.find((c: any) => c[0].data.status === 'completed');
    expect(completedCall[0].data.outputData.brokenSolutions).toHaveLength(1);
  });

  it('an empty brokenSolutions array fails schema validation — job marked failed, never completed', async () => {
    callGeminiMock.mockResolvedValue({ expectedSolution: 'x', brokenSolutions: [] });
    const job = {
      id: 'bull-1',
      name: 'ai.generate.verification-contract',
      data: { jobId: 'job-1', isLaunchpad: true, inputData: { codingChallenge: {}, hiddenTests: [] } },
    } as any;

    await expect(processAiGenerationJob(job, deps)).rejects.toThrow(/brokenSolutions/i);
    expect(prismaMock.launchpadAiGenerationJob.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });
});
