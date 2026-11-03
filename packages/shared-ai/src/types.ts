// The one contract every AI provider must satisfy — the "plug" in the payment-gateway-style
// addon pattern. A provider knows nothing about prompts, job types, or persistence; it only
// knows how to turn text in and get parsed JSON back out. AIProviderRouter is the only thing
// that ever iterates a list of these — no calling code should import a specific provider and
// call it directly except to construct the router.
export interface AIProvider {
  /** Short, stable identifier — surfaces in logs and the router's providerUsed result. */
  readonly name: string;
  generateJSON(promptText: string, timeoutMs?: number): Promise<unknown>;
}

export class AIProviderError extends Error {
  constructor(
    public readonly providerName: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${providerName}] ${message}`);
    this.name = 'AIProviderError';
  }
}
