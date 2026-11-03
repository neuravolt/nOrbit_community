import { GeminiProvider } from './gemini-provider';
import { AIProviderError } from './types';

describe('GeminiProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses a real-shaped Gemini response into the caller\'s JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"chapters":[{"title":"A"}]}' }] } }] }),
    }) as any;

    const provider = new GeminiProvider('key-123');
    const result = await provider.generateJSON('prompt');
    expect(result).toEqual({ chapters: [{ title: 'A' }] });
  });

  it('throws an AIProviderError on a non-ok HTTP status, not a silent empty result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'RESOURCE_EXHAUSTED',
    }) as any;

    const provider = new GeminiProvider('key-123');
    await expect(provider.generateJSON('prompt')).rejects.toThrow(AIProviderError);
    await expect(provider.generateJSON('prompt')).rejects.toThrow(/429/);
  });

  it('throws when the response has no candidates text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    }) as any;

    const provider = new GeminiProvider('key-123');
    await expect(provider.generateJSON('prompt')).rejects.toThrow(/invalid or empty/);
  });

  it('throws a malformed-JSON error rather than crashing when the model returns non-JSON text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }),
    }) as any;

    const provider = new GeminiProvider('key-123');
    await expect(provider.generateJSON('prompt')).rejects.toThrow(/malformed JSON/);
  });

  it('sends the configured model, timeout, and thinking budget in the request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
    });
    global.fetch = fetchMock as any;

    const provider = new GeminiProvider('key-123', { model: 'gemini-9.9-flash', thinkingBudget: 42 });
    await provider.generateJSON('prompt', 5000);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-9.9-flash');
    expect(url).toContain('key=key-123');
    const body = JSON.parse(init.body);
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(42);
  });

  it('omits temperature when not set, and includes it when it is (used by apps/api callers)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
    });
    global.fetch = fetchMock as any;

    await new GeminiProvider('k').generateJSON('p');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig.temperature).toBeUndefined();

    await new GeminiProvider('k', { temperature: 0.2 }).generateJSON('p');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig.temperature).toBe(0.2);
  });
});
