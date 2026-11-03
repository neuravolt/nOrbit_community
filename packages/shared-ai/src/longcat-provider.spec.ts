import { LongCatProvider } from './longcat-provider';
import { AIProviderError } from './types';

describe('LongCatProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses a real-shaped OpenAI-compatible chat-completions response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"chapters":[{"title":"A"}]}' } }] }),
    }) as any;

    const provider = new LongCatProvider('key-abc');
    const result = await provider.generateJSON('prompt');
    expect(result).toEqual({ chapters: [{ title: 'A' }] });
  });

  it('strips a markdown code fence the model added despite the JSON-only instruction', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] }),
    }) as any;

    const provider = new LongCatProvider('key-abc');
    const result = await provider.generateJSON('prompt');
    expect(result).toEqual({ ok: true });
  });

  it('sends the correct URL, bearer auth header, model, and appends the JSON-only instruction', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    });
    global.fetch = fetchMock as any;

    const provider = new LongCatProvider('key-abc', { model: 'LongCat-9.9' });
    await provider.generateJSON('write me a syllabus');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.longcat.chat/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer key-abc');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('LongCat-9.9');
    expect(body.messages[0].content).toContain('write me a syllabus');
    expect(body.messages[0].content).toContain('ONLY a single valid JSON object');
  });

  it('throws an AIProviderError on a non-ok HTTP status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid api key',
    }) as any;

    const provider = new LongCatProvider('bad-key');
    await expect(provider.generateJSON('prompt')).rejects.toThrow(AIProviderError);
    await expect(provider.generateJSON('prompt')).rejects.toThrow(/401/);
  });

  it('throws when the response has no message content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    }) as any;

    const provider = new LongCatProvider('key-abc');
    await expect(provider.generateJSON('prompt')).rejects.toThrow(/invalid or empty/);
  });
});
