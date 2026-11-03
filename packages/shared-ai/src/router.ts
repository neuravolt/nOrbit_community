import { AIProvider } from './types';

export interface AIProviderResult {
  result: unknown;
  providerUsed: string;
  /** Providers that were tried and failed before providerUsed succeeded, if any. */
  fellBackFrom: string[];
}

// The payment-gateway-style addon router: callers ask for JSON, get it back plus which provider
// actually served it — the prompt-building, validation, and persistence code around every call
// site never needs to know or care which provider ran. Falls back on ANY error from one provider
// to the next (quota exhaustion, timeout, malformed response, network failure) — a
// generation pipeline degraded to a secondary provider is better than one that's down.
export class AIProviderRouter {
  constructor(private readonly providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error('AIProviderRouter needs at least one provider.');
    }
  }

  async generateJSON(promptText: string, timeoutMs?: number): Promise<AIProviderResult> {
    const fellBackFrom: string[] = [];
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const result = await provider.generateJSON(promptText, timeoutMs);
        return { result, providerUsed: provider.name, fellBackFrom: [...fellBackFrom] };
      } catch (err: any) {
        errors.push(err?.message || String(err));
        fellBackFrom.push(provider.name);
      }
    }

    throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
  }
}
