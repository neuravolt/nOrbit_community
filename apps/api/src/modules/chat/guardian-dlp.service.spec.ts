import { GuardianDlpService } from './guardian-dlp.service';

describe('GuardianDlpService', () => {
  let service: GuardianDlpService;

  beforeEach(() => {
    service = new GuardianDlpService();
  });

  it('should pass harmless text unchanged', () => {
    const input =
      'Hey team, let us meet at 4 PM to discuss the new frontend redesign.';
    const result = service.sanitize(input);
    expect(result.hasRedactedData).toBe(false);
    expect(result.sanitizedContent).toBe(input);
    expect(result.detectedTypes).toHaveLength(0);
  });

  it('should detect and redact AWS Access Keys', () => {
    const input = 'My key is AKIAIOSFODNN7EXAMPLE for the S3 bucket.';
    const result = service.sanitize(input);
    expect(result.hasRedactedData).toBe(true);
    expect(result.detectedTypes).toContain('AWS_ACCESS_KEY');
    expect(result.sanitizedContent).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result.sanitizedContent).toContain('REDACTED_AWS_KEY');
  });

  it('should detect and redact OpenSSH / RSA Private Keys', () => {
    const fakeKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y9x7V1Vq5x4...
-----END RSA PRIVATE KEY-----`;
    const input = `Here is the server private key:\n${fakeKey}`;
    const result = service.sanitize(input);
    expect(result.hasRedactedData).toBe(true);
    expect(result.detectedTypes).toContain('SSH_PRIVATE_KEY');
    expect(result.sanitizedContent).not.toContain(
      'MIIEowIBAAKCAQEA0Y9x7V1Vq5x4',
    );
    expect(result.sanitizedContent).toContain(
      '[REDACTED_SSH_PRIVATE_KEY_BY_GUARDIAN_DLP]',
    );
  });

  it('should detect and mask database URIs containing credentials', () => {
    const input =
      'Connect using postgres://admin:superSecretPassword123@prod-db.internal:5432/neuravolt';
    const result = service.sanitize(input);
    expect(result.hasRedactedData).toBe(true);
    expect(result.detectedTypes).toContain('DATABASE_URI_WITH_PASSWORD');
    expect(result.sanitizedContent).not.toContain('superSecretPassword123');
    expect(result.sanitizedContent).toContain(
      'postgres://[USERNAME]:••••••••@',
    );
  });

  it('should detect and redact GitHub personal access tokens', () => {
    const input =
      'Use ghp_0123456789abcdefghijklmnopqrstuvwxyz for pushing the repo';
    const result = service.sanitize(input);
    expect(result.hasRedactedData).toBe(true);
    expect(result.detectedTypes).toContain('GITHUB_TOKEN');
    expect(result.sanitizedContent).toContain('[REDACTED_GITHUB_TOKEN]');
  });
});
