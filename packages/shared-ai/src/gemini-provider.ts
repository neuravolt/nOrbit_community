import { AIProvider, AIProviderError } from './types';
import { parseJsonResponse } from './parse-json-response';

export interface GeminiProviderOptions {
  /** gemini-3.6-flash is the current working model — see apps/worker's original comment history:
   * gemini-2.5-flash's free-tier quota (5 req/min, 20 req/day) proved too small for real use,
   * gemini-2.0-flash is fully retired (404). Override only with a model confirmed working
   * against a real key first. */
  model?: string;
  /** gemini-3.6-flash defaults to an unbounded "thinking" pass before answering — a bounded
   * budget keeps real calls under the timeout instead of failing unpredictably. */
  thinkingBudget?: number;
  maxOutputTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEFAULT_THINKING_BUDGET = 512;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_TIMEOUT_MS = 30000;

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly options: GeminiProviderOptions = {},
  ) {}

  async generateJSON(promptText: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const model = this.options.model || DEFAULT_MODEL;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: this.options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingBudget: this.options.thinkingBudget ?? DEFAULT_THINKING_BUDGET },
            ...(this.options.temperature !== undefined ? { temperature: this.options.temperature } : {}),
          },
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new AIProviderError(this.name, `call timed out after ${timeoutMs}ms`, err);
      }
      throw new AIProviderError(this.name, err.message, err);
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new AIProviderError(this.name, `returned error status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AIProviderError(this.name, 'response format invalid or empty');
    }

    try {
      return parseJsonResponse(text);
    } catch (parseErr: any) {
      throw new AIProviderError(this.name, `returned malformed JSON: ${parseErr.message}`, parseErr);
    }
  }
}
