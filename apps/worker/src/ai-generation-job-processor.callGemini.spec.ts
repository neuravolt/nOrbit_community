import { callGemini } from './ai-generation-job-processor';

// Tests the REAL exported callGemini — not the dependency-injected mock every other spec in
// this directory uses for processAiGenerationJob. Confirms the fallback addon (GeminiProvider
// + LongCatProvider via AIProviderRouter) is actually wired in, without touching a live DB or
// network: getLongCatApiKey()/getGeminiApiKey() fall through to env vars when the Prisma call
// fails in this no-DB test environment, and global.fetch is mocked for both providers' HTTP calls.
describe('callGemini (real implementation — the fallback addon)', () => {
  const originalFetch = global.fetch;
  const originalLongCatKey = process.env.LONGCAT_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalLongCatKey === undefined) delete process.env.LONGCAT_API_KEY;
    else process.env.LONGCAT_API_KEY = originalLongCatKey;
    jest.restoreAllMocks();
  });

  it('returns the Gemini result directly and never calls LongCat when Gemini succeeds', async () => {
    delete process.env.LONGCAT_API_KEY;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] } }] }),
    });
    global.fetch = fetchMock as any;

    const result = await callGemini('prompt', 'gemini-key');
    expect(result).toEqual({ from: 'gemini', _meta: { provider: 'gemini', fellBackFrom: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][0] as string)).toContain('generativelanguage.googleapis.com');
  });

  it('falls back to LongCat when Gemini fails and LONGCAT_API_KEY is configured', async () => {
    process.env.LONGCAT_API_KEY = 'longcat-test-key';
    const fetchMock = jest
      .fn()
      // Gemini call — fails
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' })
      // LongCat call — succeeds
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '{"from":"longcat"}' } }] }) });
    global.fetch = fetchMock as any;

    const result = await callGemini('prompt', 'gemini-key');
    expect(result).toEqual({ from: 'longcat', _meta: { provider: 'longcat', fellBackFrom: ['gemini'] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][0] as string)).toBe('https://api.longcat.chat/openai/v1/chat/completions');
  });

  it('surfaces the original Gemini error unchanged when no LongCat key is configured — same as before this addon existed', async () => {
    delete process.env.LONGCAT_API_KEY;
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' });
    global.fetch = fetchMock as any;

    await expect(callGemini('prompt', 'gemini-key')).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a combined error when both Gemini and the configured LongCat fallback fail', async () => {
    process.env.LONGCAT_API_KEY = 'longcat-test-key';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'longcat down' });
    global.fetch = fetchMock as any;

    await expect(callGemini('prompt', 'gemini-key')).rejects.toThrow(/All AI providers failed[\s\S]*429[\s\S]*500/);
  });
});
