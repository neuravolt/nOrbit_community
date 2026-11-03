/**
 * Key fragments whose values must never be written to audit_logs. Matched case-insensitively
 * against every key at any depth (so `password`, `newPassword`, `passwordHash`,
 * `razorpayKeySecret`, `refreshToken`, `totpSecret` … are all caught).
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'passwd',
  'secret',
  'token',
  'otp',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'credential',
  'authorization',
  'cookie',
];

export const REDACTED = '[REDACTED]';

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((f) => k.includes(f));
}

/** Returns a deep copy of `value` with every sensitive key's value replaced by `[REDACTED]`. */
export function redactSecrets<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || depth > 20) return value;
  if (typeof value === 'function') return undefined as any;
  if (Array.isArray(value))
    return value.map((v) => redactSecrets(v, depth + 1)) as any;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'function' || k === 'constructor') continue;
    out[k] =
      isSensitiveKey(k) && v !== null && v !== undefined && v !== ''
        ? REDACTED
        : redactSecrets(v, depth + 1);
  }
  return out as T;
}
