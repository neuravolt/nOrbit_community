import { Injectable, Logger } from '@nestjs/common';

export interface DlpScanResult {
  sanitizedContent: string;
  hasRedactedData: boolean;
  detectedTypes: string[];
}

@Injectable()
export class GuardianDlpService {
  private readonly logger = new Logger(GuardianDlpService.name);

  // High-confidence patterns for enterprise secret & credential leakage
  private readonly secretPatterns: Array<{
    name: string;
    regex: RegExp;
    replacer: (match: string, ...args: any[]) => string;
  }> = [
    {
      name: 'AWS_ACCESS_KEY',
      regex: /\b(AKIA[0-9A-Z]{16})\b/g,
      replacer: (_m, key) => `[REDACTED_AWS_KEY:••••${key.slice(-4)}]`,
    },
    {
      name: 'SSH_PRIVATE_KEY',
      regex:
        /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP)? PRIVATE KEY-----[\s\S]+?-----END (?:RSA|OPENSSH|EC|DSA|PGP)? PRIVATE KEY-----/g,
      replacer: () => '[REDACTED_SSH_PRIVATE_KEY_BY_GUARDIAN_DLP]',
    },
    {
      name: 'GENERIC_PRIVATE_KEY',
      regex: /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g,
      replacer: () => '[REDACTED_PRIVATE_KEY_BY_GUARDIAN_DLP]',
    },
    {
      name: 'DATABASE_URI_WITH_PASSWORD',
      regex:
        /(postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[a-zA-Z0-9_\-\.]+:(.+?)@/gi,
      replacer: (_m, protocol) => `${protocol}://[USERNAME]:••••••••@`,
    },
    {
      name: 'GITHUB_TOKEN',
      regex: /\b(gh[pousr]_[a-zA-Z0-9]{36,255})\b/g,
      replacer: () => '[REDACTED_GITHUB_TOKEN]',
    },
    {
      name: 'STRIPE_SECRET_KEY',
      regex: /\b(sk_live_[0-9a-zA-Z]{24,99})\b/g,
      replacer: () => '[REDACTED_STRIPE_LIVE_KEY]',
    },
    {
      name: 'SLACK_TOKEN',
      regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g,
      replacer: () => '[REDACTED_SLACK_TOKEN]',
    },
    {
      name: 'JWT_BEARER_TOKEN',
      regex:
        /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
      replacer: () => '[REDACTED_JWT_TOKEN]',
    },
  ];

  /**
   * Scans and sanitizes raw text before it is persisted in the database or broadcast to clients.
   */
  sanitize(content: string): DlpScanResult {
    if (!content || typeof content !== 'string') {
      return {
        sanitizedContent: content || '',
        hasRedactedData: false,
        detectedTypes: [],
      };
    }

    let sanitized = content;
    const detected: string[] = [];

    for (const rule of this.secretPatterns) {
      if (rule.regex.test(sanitized)) {
        detected.push(rule.name);
        // Reset regex state after test
        rule.regex.lastIndex = 0;
        sanitized = sanitized.replace(rule.regex, (...args) => {
          this.logger.warn(
            `Guardian DLP detected and redacted sensitive credential: ${rule.name}`,
          );
          return rule.replacer(args[0], ...args.slice(1));
        });
      }
    }

    return {
      sanitizedContent: sanitized,
      hasRedactedData: detected.length > 0,
      detectedTypes: detected,
    };
  }
}
