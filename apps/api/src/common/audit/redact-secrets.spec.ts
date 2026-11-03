import { redactSecrets, REDACTED } from './redact-secrets';

describe('redactSecrets', () => {
  it('redacts credential-like keys at any depth and keeps everything else', () => {
    const input = {
      email: 'a@b.c',
      password: 'p1',
      user: { passwordHash: '$2b$10$x', firstName: 'A', totpSecret: 's' },
      razorpayKeySecret: 'rk',
      cashfreeWebhookSecret: 'wh',
      tokens: [{ refreshToken: 'r', note: 'n' }],
      otp: '123456',
      fileHashSha256: 'abc',
      when: new Date(0),
      empty: { password: '' },
    };
    const out: any = redactSecrets(input);
    expect(out.email).toBe('a@b.c');
    expect(out.password).toBe(REDACTED);
    expect(out.user).toEqual({
      passwordHash: REDACTED,
      firstName: 'A',
      totpSecret: REDACTED,
    });
    expect(out.razorpayKeySecret).toBe(REDACTED);
    expect(out.cashfreeWebhookSecret).toBe(REDACTED);
    expect(out.tokens).toBe(REDACTED);
    expect(out.otp).toBe(REDACTED);
    expect(out.fileHashSha256).toBe('abc');
    expect(out.when).toEqual(new Date(0));
    expect(out.empty.password).toBe('');
    expect(input.password).toBe('p1'); // input untouched
  });

  it('passes primitives and null through', () => {
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets('x')).toBe('x');
    expect(redactSecrets(5)).toBe(5);
  });
});
