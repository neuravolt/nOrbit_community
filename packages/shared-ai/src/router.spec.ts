import { AIProviderRouter } from './router';
import { AIProvider } from './types';

function fakeProvider(name: string, behavior: () => Promise<unknown>): AIProvider {
  return { name, generateJSON: behavior };
}

describe('AIProviderRouter', () => {
  it('returns the primary provider\'s result with no fallback when it succeeds', async () => {
    const primary = fakeProvider('gemini', async () => ({ ok: 'from-gemini' }));
    const secondary = fakeProvider('longcat', async () => {
      throw new Error('should never be called');
    });

    const router = new AIProviderRouter([primary, secondary]);
    const { result, providerUsed, fellBackFrom } = await router.generateJSON('prompt');

    expect(result).toEqual({ ok: 'from-gemini' });
    expect(providerUsed).toBe('gemini');
    expect(fellBackFrom).toEqual([]);
  });

  it('falls back to the next provider when the primary fails, and reports the fallback', async () => {
    const primary = fakeProvider('gemini', async () => {
      throw new Error('RESOURCE_EXHAUSTED: quota exceeded');
    });
    const secondary = fakeProvider('longcat', async () => ({ ok: 'from-longcat' }));

    const router = new AIProviderRouter([primary, secondary]);
    const { result, providerUsed, fellBackFrom } = await router.generateJSON('prompt');

    expect(result).toEqual({ ok: 'from-longcat' });
    expect(providerUsed).toBe('longcat');
    expect(fellBackFrom).toEqual(['gemini']);
  });

  it('falls back on ANY error type, not just quota errors — e.g. a timeout or malformed response', async () => {
    const primary = fakeProvider('gemini', async () => {
      throw new Error('call timed out after 30000ms');
    });
    const secondary = fakeProvider('longcat', async () => ({ ok: true }));

    const router = new AIProviderRouter([primary, secondary]);
    const { providerUsed } = await router.generateJSON('prompt');
    expect(providerUsed).toBe('longcat');
  });

  it('throws a combined error listing every provider\'s failure when all providers fail', async () => {
    const primary = fakeProvider('gemini', async () => {
      throw new Error('gemini down');
    });
    const secondary = fakeProvider('longcat', async () => {
      throw new Error('longcat down');
    });

    const router = new AIProviderRouter([primary, secondary]);
    await expect(router.generateJSON('prompt')).rejects.toThrow(/gemini down/);
    await expect(router.generateJSON('prompt')).rejects.toThrow(/longcat down/);
  });

  it('works with a single provider and no fallback configured', async () => {
    const only = fakeProvider('gemini', async () => ({ solo: true }));
    const router = new AIProviderRouter([only]);
    const { result, providerUsed } = await router.generateJSON('prompt');
    expect(result).toEqual({ solo: true });
    expect(providerUsed).toBe('gemini');
  });

  it('refuses to construct with zero providers', () => {
    expect(() => new AIProviderRouter([])).toThrow(/at least one provider/);
  });
});
