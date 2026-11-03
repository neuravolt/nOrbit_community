// Shared between ChallengeInstanceGeneratorService (renders a student's problemStatement) and
// VerificationEngineService (resolves a ChallengeInstance's parameters into the actual
// requirements the structural validators check) — extracted so there is exactly one
// {{paramName}} substitution implementation, not two independently-maintained copies. Pure,
// deterministic, no AI call: a resolved parameter's value replaces its placeholder verbatim; a
// placeholder with no matching key is left untouched rather than silently dropped.
export function substituteParams(
  text: string,
  parameters: Record<string, unknown>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const value = parameters[key];
    return value !== undefined ? String(value) : match;
  });
}
