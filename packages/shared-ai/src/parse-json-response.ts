// Shared between providers: a model asked for raw JSON sometimes still wraps it in a markdown
// code fence (```json ... ```) even when told not to — strip that defensively before parsing
// rather than failing a genuinely-good response over formatting.
//
// LLM providers (confirmed live: LongCat, on long-form ai.generate.content responses) also
// sometimes emit JSON whose STRUCTURE is valid but whose string literals aren't properly
// escaped — a literal newline/tab typed straight into a multi-paragraph "notes" field instead
// of "\n", or a literal backslash (a Windows path, a regex, a currency symbol like \$) that
// isn't a valid JSON escape. Both are fatal to JSON.parse ("Bad control character in string
// literal" / "Bad escaped character") even though the intent is unambiguous. sanitizeJsonString
// repairs exactly those two cases by scanning character-by-character with string-state tracking
// (never via a blind regex, which can't reliably tell "inside a string" from "outside one") — it
// does not attempt to repair structural damage (mismatched braces, truncated output), which
// should keep failing loudly rather than being silently patched into something wrong.
function sanitizeJsonString(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);

    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }

    // Inside a string literal from here on.
    if (escaped) {
      // Valid JSON escapes are \" \\ \/ \b \f \n \r \t \u — anything else means the model's
      // backslash was meant literally, so escape the backslash itself instead of the char after it.
      out += '"\\/bfnrtu'.includes(ch) ? ch : '\\' + ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (code < 0x20) {
      // A raw control character sitting inside a string literal is always invalid JSON.
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += '\\u' + code.toString(16).padStart(4, '0');
      continue;
    }

    out += ch;
  }

  return out;
}

export function parseJsonResponse(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Retry once against a sanitized copy — a model that emits raw control characters or invalid
    // backslash escapes inside a string is still structurally sound JSON otherwise, and failing
    // a fully-generated response over formatting wastes the whole generation call (and, since
    // the AI orchestration "Generate Full Pipeline" auto-advance stalls a chapter's entire chain
    // on any failed job, wastes every stage queued behind it too).
    try {
      return JSON.parse(sanitizeJsonString(cleaned));
    } catch {
      throw err; // sanitizing didn't help — surface the ORIGINAL parse error, not one from mangled input
    }
  }
}
