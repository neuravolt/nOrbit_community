import { AIProvider, AIProviderError } from './types';
import { parseJsonResponse } from './parse-json-response';

export interface LongCatProviderOptions {
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'LongCat-2.0';
// Confirmed live: a curriculum hidden-tests generation call failed with "response format invalid
// or empty" once Gemini's quota forced a fallback here — LongCat-2.0 is a reasoning model that
// spends part of max_tokens on reasoning_content before the actual JSON `content`; a live probe
// even on a trivial prompt showed 86 of 97 completion tokens went to reasoning. 8192 total left
// too little headroom for a longer generation task once reasoning ate its share.
const DEFAULT_MAX_TOKENS = 16384;
const DEFAULT_TIMEOUT_MS = 30000;
const CHAT_COMPLETIONS_URL = 'https://api.longcat.chat/openai/v1/chat/completions';

// LongCat's OpenAI-compatible endpoint has no documented response_format/JSON-mode parameter
// (confirmed against the official docs) — unlike Gemini's responseMimeType: 'application/json'.
// The instruction below does the same job the old way: tell the model explicitly, then parse
// defensively (parseJsonResponse strips a stray ```json fence if the model adds one anyway).
const JSON_ONLY_SUFFIX =
  '\n\nRespond with ONLY a single valid JSON object — no markdown code fences, no commentary before or after it.';

export class LongCatProvider implements AIProvider {
  readonly name = 'longcat';

  constructor(
    private readonly apiKey: string,
    private readonly options: LongCatProviderOptions = {},
  ) {}

  async generateJSON(promptText: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.options.model || DEFAULT_MODEL,
          messages: [{ role: 'user', content: `${promptText}${JSON_ONLY_SUFFIX}` }],
          max_tokens: this.options.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: 0.2,
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
    const text = data?.choices?.[0]?.message?.content;
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
