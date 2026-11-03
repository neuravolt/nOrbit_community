import { callGemini } from './ai-generation-job-processor';

// Phase 5A (AI Worker Fail-Closed, Step 3). callGemini previously had no timeout at all (a
// hanging call never surfaced as a failure) and parsed the response JSON outside any try/catch
// specific to parsing. Both are now real, distinctly-messaged thrown errors — the same shape as
// every other failure mode processAiGenerationJob handles.
describe('callGemini', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  function mockResponse(body: any, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as any;
  }

  it('parses a well-formed Gemini response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ candidates: [{ content: { parts: [{ text: '{"objective":"x"}' }] } }] }),
    );

    const result = await callGemini('prompt', 'key');
    // Payment-gateway-style fallback addon: callGemini now attaches _meta.provider (which
    // provider actually served the call) onto the parsed result — additive, so the real fields
    // stay exactly as before.
    expect(result).toEqual({ objective: 'x', _meta: { provider: 'gemini', fellBackFrom: [] } });
  });

  it('throws on a non-OK HTTP response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'quota exceeded',
    } as any);

    await expect(callGemini('prompt', 'key')).rejects.toThrow(/500/);
  });

  it('throws on an empty response body', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ candidates: [] }));

    await expect(callGemini('prompt', 'key')).rejects.toThrow(/invalid or empty/);
  });

  it('throws a distinct, catchable error on malformed JSON text', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ candidates: [{ content: { parts: [{ text: '{not valid json' }] } }] }),
    );

    await expect(callGemini('prompt', 'key')).rejects.toThrow(/malformed JSON/);
  });

  it('aborts and throws a timeout error when the call exceeds timeoutMs', async () => {
    global.fetch = jest.fn().mockImplementation((_url: string, init: any) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err: any = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(callGemini('prompt', 'key', 20)).rejects.toThrow(/timed out after 20ms/);
  });
});
