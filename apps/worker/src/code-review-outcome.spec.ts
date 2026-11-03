import { getCodeReviewOutcome } from './code-review-outcome';

// Phase 5A (AI Worker Fail-Closed) — residual item. Before this fix, codeReviewWorker
// (apps/worker/src/index.ts) caught any Gemini failure and substituted a hardcoded
// {score:85, passed:true} mock, and separately `reviewResult.score || 85` silently promoted a
// genuine score of 0 to a passing 85. Confirms neither happens anymore: any failure mode routes
// to an honest, mentor-reviewable {score:0, passed:false, mentorReviewRequired:true} — never a
// faked passing score.
describe('getCodeReviewOutcome', () => {
  let callGeminiMock: jest.Mock;
  let getGeminiApiKeyMock: jest.Mock;

  beforeEach(() => {
    callGeminiMock = jest.fn();
    getGeminiApiKeyMock = jest.fn().mockResolvedValue('real-api-key');
  });

  it('a valid Gemini response above the pass threshold is returned as passed, not mentor-flagged', async () => {
    callGeminiMock.mockResolvedValue({ score: 88, passed: true, feedback: 'Great work.' });

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(outcome).toEqual({ score: 88, passed: true, mentorReviewRequired: false, feedback: 'Great work.' });
  });

  it('a valid Gemini response below the pass threshold is returned as not passed, not mentor-flagged', async () => {
    callGeminiMock.mockResolvedValue({ score: 40, feedback: 'Needs work.' });

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(outcome.score).toBe(40);
    expect(outcome.passed).toBe(false);
    expect(outcome.mentorReviewRequired).toBe(false);
  });

  it('a genuine score of exactly 0 is preserved, never promoted to 85', async () => {
    callGeminiMock.mockResolvedValue({ score: 0, feedback: 'Completely unrelated submission.' });

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(outcome.score).toBe(0);
    expect(outcome.passed).toBe(false);
    expect(outcome.mentorReviewRequired).toBe(false); // a real, valid 0 from Gemini is a real result, not a failure
  });

  it('a Gemini API failure routes to mentor review with an honest score of 0 — never a mock 85', async () => {
    callGeminiMock.mockRejectedValue(new Error('Gemini API returned error status 500: quota exceeded'));

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(outcome.score).toBe(0);
    expect(outcome.passed).toBe(false);
    expect(outcome.mentorReviewRequired).toBe(true);
    expect(outcome.feedback).toMatch(/quota exceeded/);
  });

  it('a response missing a numeric score routes to mentor review instead of defaulting to 85', async () => {
    callGeminiMock.mockResolvedValue({ feedback: 'no score field' });

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(outcome.score).toBe(0);
    expect(outcome.mentorReviewRequired).toBe(true);
  });

  it('a missing API key routes to mentor review without ever calling Gemini', async () => {
    getGeminiApiKeyMock.mockResolvedValue(undefined);

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(callGeminiMock).not.toHaveBeenCalled();
    expect(outcome.score).toBe(0);
    expect(outcome.passed).toBe(false);
    expect(outcome.mentorReviewRequired).toBe(true);
  });

  it('a MOCK_KEY placeholder is treated the same as no key', async () => {
    getGeminiApiKeyMock.mockResolvedValue('MOCK_KEY');

    const outcome = await getCodeReviewOutcome('prompt', 70, { callGemini: callGeminiMock, getGeminiApiKey: getGeminiApiKeyMock });

    expect(callGeminiMock).not.toHaveBeenCalled();
    expect(outcome.mentorReviewRequired).toBe(true);
  });
});
