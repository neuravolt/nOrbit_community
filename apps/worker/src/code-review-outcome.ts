// Phase 5A (AI Worker Fail-Closed) — residual item from the original pass. codeReviewWorker
// (apps/worker/src/index.ts, gated behind ENABLE_CODE_REVIEW_WORKER) had the same fail-open bug
// class as the AI generation worker already fixed, plus a second, independent one:
//
//   1. Any Gemini failure (or a missing/placeholder API key) was caught and silently replaced
//      with getFallbackMock('review-code', ...)'s hardcoded { score: 85, passed: true }.
//   2. `reviewResult.score || 85` separately promoted a genuine AI-returned score of exactly 0
//      to a passing 85, since 0 is falsy in JS — independent of whether the API call itself
//      succeeded or failed.
//
// Neither case is a "success." This mirrors the fail-closed shape apps/api's
// code-reviewer.agent.ts already uses (score: 0, passed: false, mentorReviewRequired: true)
// rather than either faking a passing score or hard-failing the BullMQ job outright — a
// student's submission should route to mentor review with an honest explanation, not vanish
// into a failed job with no recorded outcome at all.

export interface CodeReviewOutcome {
  score: number;
  passed: boolean;
  feedback: string;
  mentorReviewRequired: boolean;
}

export interface GetCodeReviewOutcomeDeps {
  callGemini: (prompt: string, apiKey: string) => Promise<any>;
  getGeminiApiKey: () => Promise<string | undefined>;
}

export async function getCodeReviewOutcome(
  filledPrompt: string,
  passThreshold: number,
  deps: GetCodeReviewOutcomeDeps,
): Promise<CodeReviewOutcome> {
  const { callGemini: doCallGemini, getGeminiApiKey: doGetGeminiApiKey } = deps;
  const geminiApiKey = await doGetGeminiApiKey();

  if (!geminiApiKey || geminiApiKey === 'MOCK_KEY') {
    return {
      score: 0,
      passed: false,
      mentorReviewRequired: true,
      feedback: 'Automated AI review could not run because Gemini is not configured. A mentor will review this submission manually.',
    };
  }

  try {
    const result = await doCallGemini(filledPrompt, geminiApiKey);
    if (typeof result?.score !== 'number' || !Number.isFinite(result.score)) {
      throw new Error('Gemini code-review response is missing a valid numeric score.');
    }
    return {
      score: result.score,
      passed: result.score >= passThreshold,
      mentorReviewRequired: false,
      feedback: typeof result.feedback === 'string' ? result.feedback : 'Review completed successfully.',
    };
  } catch (err: any) {
    return {
      score: 0,
      passed: false,
      mentorReviewRequired: true,
      feedback: `Automated AI review could not be completed (${err.message}). A mentor will review this submission manually.`,
    };
  }
}
