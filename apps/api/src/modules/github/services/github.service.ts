import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { AppConfig } from '@neuravolt/shared-config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LaunchpadEventBus } from '../../launchpad/services/launchpad-event-bus';
import { ProjectGithubSyncService } from './project-github-sync.service';
import { encrypt, decrypt, getEncryptionKey } from '@neuravolt/shared-utils';
import * as crypto from 'crypto';

const GITHUB_API_BASE = 'https://api.github.com';

// Launch Blocker 3: connect state TTL — how long a student has to complete the GitHub App
// install flow before the state token expires and they'd need to click "Connect" again.
const OAUTH_STATE_TTL_SECONDS = 600;
const OAUTH_STATE_REDIS_PREFIX = 'launchpad:github-oauth-state:';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly redis = new Redis(
    AppConfig.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
  );
  private readonly tokenCache = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: LaunchpadEventBus,
    private readonly jwtService: JwtService,
    private readonly projectSyncService: ProjectGithubSyncService,
  ) {}

  /**
   * Launch Blocker 3: previously `state` was the raw, unsigned studentId — anyone could install
   * the GitHub App on their own account and hit the callback with an arbitrary victim's
   * studentId as `state`, linking their GitHub identity to someone else's Launchpad account.
   * This issues a token that is (a) HMAC-signed, so it can't be forged or edited, (b) time-
   * boxed via an embedded expiry, and (c) single-use, enforced by a Redis key that's deleted
   * the moment the callback consumes it — a replayed or reused state is rejected.
   */
  private signOAuthState(
    studentId: string,
    nonce: string,
    exp: number,
  ): string {
    const secret =
      process.env.JWT_SECRET || process.env.LAUNCHPAD_MANIFEST_SECRET;
    if (!secret) {
      throw new BadRequestException(
        'Server is not configured to issue GitHub connect links (missing JWT_SECRET).',
      );
    }
    const payload = JSON.stringify({ studentId, nonce, exp });
    const sig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return Buffer.from(JSON.stringify({ p: payload, s: sig })).toString(
      'base64url',
    );
  }

  private async issueOAuthState(studentId: string): Promise<string> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const exp = Date.now() + OAUTH_STATE_TTL_SECONDS * 1000;
    const token = this.signOAuthState(studentId, nonce, exp);
    await this.redis.set(
      `${OAUTH_STATE_REDIS_PREFIX}${nonce}`,
      studentId,
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );
    return token;
  }

  /** Verifies signature + expiry, then atomically consumes the single-use nonce. Throws if any check fails. */
  private async verifyAndConsumeOAuthState(state: string): Promise<string> {
    const secret =
      process.env.JWT_SECRET || process.env.LAUNCHPAD_MANIFEST_SECRET;
    let payload: { studentId: string; nonce: string; exp: number };
    try {
      const outer = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      );
      const { p, s } = outer;
      if (!secret) throw new Error('no secret configured');
      const expected = crypto
        .createHmac('sha256', secret)
        .update(p)
        .digest('hex');
      const sigBuf = Buffer.from(s, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        throw new Error('signature mismatch');
      }
      payload = JSON.parse(p);
    } catch {
      throw new UnauthorizedException(
        'Invalid GitHub connect link. Please try connecting again.',
      );
    }

    if (Date.now() > payload.exp) {
      throw new UnauthorizedException(
        'This GitHub connect link has expired. Please try connecting again.',
      );
    }

    const key = `${OAUTH_STATE_REDIS_PREFIX}${payload.nonce}`;
    // GETDEL — read and delete the nonce atomically so two racing callbacks with the same
    // (replayed) state can't both pass the single-use check.
    const stored = await this.redis.getdel(key);
    if (!stored || stored !== payload.studentId) {
      throw new UnauthorizedException(
        'This GitHub connect link was already used or has expired.',
      );
    }

    return payload.studentId;
  }

  public async getScopedCredentials(
    scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS',
  ): Promise<{
    appId: string | null;
    privateKey: string | null;
    webhookSecret: string | null;
    appName: string;
    source: 'DATABASE_ENCRYPTED' | 'ENVIRONMENT';
  }> {
    const configKey =
      scope === 'PROJECTS'
        ? 'PROJECT_GITHUB_CONFIG'
        : 'LAUNCHPAD_GITHUB_CONFIG';

    // 1. Try to load encrypted database configuration
    try {
      const dbConfig = await this.prisma.launchpadConfig.findUnique({
        where: { key: configKey },
      });
      if (
        dbConfig &&
        typeof dbConfig.value === 'object' &&
        dbConfig.value !== null
      ) {
        const val: any = dbConfig.value;
        let decryptedKey: string | null = null;
        let decryptedSecret: string | null = null;
        try {
          const encryptionKey = getEncryptionKey();
          if (val.privateKeyEnc)
            decryptedKey = decrypt(val.privateKeyEnc, encryptionKey);
          if (val.webhookSecretEnc)
            decryptedSecret = decrypt(val.webhookSecretEnc, encryptionKey);
        } catch (encErr: any) {
          this.logger.warn(
            `Failed decrypting ${configKey} credentials: ${encErr.message}`,
          );
        }

        if (val.appId && decryptedKey) {
          return {
            appId: String(val.appId),
            privateKey: decryptedKey.replace(/\\n/g, '\n'),
            webhookSecret: decryptedSecret || null,
            appName:
              val.appName ||
              (scope === 'PROJECTS'
                ? 'neuravolt-os-projects'
                : 'neuravolt-launchpad'),
            source: 'DATABASE_ENCRYPTED',
          };
        }
      }
    } catch (e: any) {
      this.logger.warn(
        `Error reading ${configKey} from database: ${e.message}`,
      );
    }

    // 2. Backward compatibility for Launchpad: check legacy GITHUB_CONFIG
    if (scope === 'LAUNCHPAD') {
      try {
        const legacy = await this.prisma.launchpadConfig.findUnique({
          where: { key: 'GITHUB_CONFIG' },
        });
        if (
          legacy &&
          typeof legacy.value === 'object' &&
          legacy.value !== null
        ) {
          const val: any = legacy.value;
          if (val.webhookSecret) {
            return {
              appId: process.env.GITHUB_APP_ID || null,
              privateKey:
                (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(
                  /\\n/g,
                  '\n',
                ) || null,
              webhookSecret:
                val.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || null,
              appName: val.appName || 'neuravolt-launchpad',
              source: 'ENVIRONMENT',
            };
          }
        }
      } catch {}
    }

    // 3. Fallback to process.env
    if (scope === 'PROJECTS') {
      const projAppId =
        process.env.PROJECT_GITHUB_APP_ID || process.env.GITHUB_APP_ID || null;
      const projKey =
        (
          process.env.PROJECT_GITHUB_APP_PRIVATE_KEY ||
          process.env.GITHUB_APP_PRIVATE_KEY ||
          ''
        ).replace(/\\n/g, '\n') || null;
      const projSecret =
        process.env.PROJECT_GITHUB_WEBHOOK_SECRET ||
        process.env.GITHUB_WEBHOOK_SECRET ||
        null;
      return {
        appId: projAppId,
        privateKey: projKey,
        webhookSecret: projSecret,
        appName: 'neuravolt-os-projects',
        source: 'ENVIRONMENT',
      };
    } else {
      const launchAppId = process.env.GITHUB_APP_ID || null;
      const launchKey =
        (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n') ||
        null;
      const launchSecret = process.env.GITHUB_WEBHOOK_SECRET || null;
      return {
        appId: launchAppId,
        privateKey: launchKey,
        webhookSecret: launchSecret,
        appName: 'neuravolt-launchpad',
        source: 'ENVIRONMENT',
      };
    }
  }

  public isGithubAppConfigured(
    scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS',
  ): boolean {
    if (scope === 'PROJECTS') {
      return !!(
        (process.env.PROJECT_GITHUB_APP_ID || process.env.GITHUB_APP_ID) &&
        (process.env.PROJECT_GITHUB_APP_PRIVATE_KEY ||
          process.env.GITHUB_APP_PRIVATE_KEY)
      );
    }
    return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
  }

  public async signAppJwt(
    scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS',
  ): Promise<string> {
    const creds = await this.getScopedCredentials(scope);
    if (!creds.appId || !creds.privateKey) {
      throw new BadRequestException(
        `GitHub App is not configured for ${scope} (missing GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY).`,
      );
    }
    const now = Math.floor(Date.now() / 1000);
    return this.jwtService.sign(
      { iat: now - 60, exp: now + 540, iss: creds.appId },
      { algorithm: 'RS256', privateKey: creds.privateKey },
    );
  }

  public async getInstallationAccessToken(
    installationId: string,
    scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS',
  ): Promise<string> {
    const cacheKey = `gh_inst_token:${scope}:${installationId}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    const appJwt = await this.signAppJwt(scope);
    const res = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to obtain GitHub installation token for ${scope} (status ${res.status}).`,
      );
    }
    const data = await res.json();
    const expiresAt = Date.now() + 55 * 60 * 1000;
    this.tokenCache.set(cacheKey, { token: data.token, expiresAt });
    return data.token;
  }

  public async getInstallationAccount(
    installationId: string,
    scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS',
  ): Promise<any> {
    const appJwt = await this.signAppJwt(scope);
    const res = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to fetch GitHub installation details (status ${res.status}).`,
      );
    }
    return res.json();
  }

  public async getAppInstallations(
    scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS',
  ): Promise<any[]> {
    try {
      const appJwt = await this.signAppJwt(scope);
      const res = await fetch(`${GITHUB_API_BASE}/app/installations`, {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) {
        this.logger.warn(
          `Failed to fetch GitHub installations (status ${res.status}).`,
        );
        return [];
      }
      return await res.json();
    } catch (err: any) {
      this.logger.error('Error fetching GitHub installations', err);
      return [];
    }
  }

  public async getInstallationRepositories(
    installationId: string,
  ): Promise<any[]> {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    };
    const repositories: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`,
        {
          headers: authHeaders,
        },
      );
      if (!res.ok) break;
      const data = await res.json();
      const repos = data.repositories || [];
      repositories.push(...repos);
      if (repos.length < 100) break;
    }
    return repositories;
  }

  public async getRepositoryDetails(
    installationId: string,
    owner: string,
    repo: string,
  ): Promise<any> {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      throw new BadRequestException(
        `Repository ${owner}/${repo} not found or not accessible by installation ${installationId}.`,
      );
    }
    return res.json();
  }

  public async getPullRequestDetails(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<any> {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) {
      throw new BadRequestException(
        `Pull request #${pullNumber} in ${owner}/${repo} not found (status ${res.status}).`,
      );
    }
    return res.json();
  }

  public async checkPullRequestMergeability(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<{
    canMerge: boolean;
    mergeable: boolean | null;
    mergeableState: string;
    reason?: string;
    headSha: string;
    title: string;
    state: string;
    isMerged: boolean;
  }> {
    const pr = await this.getPullRequestDetails(
      installationId,
      owner,
      repo,
      pullNumber,
    );
    const headSha = pr.head?.sha || '';
    const isMerged = !!pr.merged;

    if (isMerged) {
      return {
        canMerge: false,
        mergeable: false,
        mergeableState: 'already_merged',
        reason: 'Pull request is already merged.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: true,
      };
    }

    if (pr.state === 'closed') {
      return {
        canMerge: false,
        mergeable: false,
        mergeableState: 'closed',
        reason: 'Pull request is closed.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: false,
      };
    }

    if (pr.draft) {
      return {
        canMerge: false,
        mergeable: false,
        mergeableState: 'draft',
        reason: 'Pull request is in draft state.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: false,
      };
    }

    if (pr.mergeable === false) {
      return {
        canMerge: false,
        mergeable: false,
        mergeableState: 'conflicting',
        reason: 'Pull request has merge conflicts with the target branch.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: false,
      };
    }

    if (pr.mergeable === null || pr.mergeable_state === 'unknown') {
      return {
        canMerge: false,
        mergeable: false,
        mergeableState: 'unknown',
        reason:
          'GitHub is currently calculating mergeability. Please retry in a few moments.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: false,
      };
    }

    const accessToken = await this.getInstallationAccessToken(installationId);
    const baseBranch = pr.base?.ref || 'main';
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    };

    // 1. Inspect branch protection policy for target base branch
    const protectionRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${encodeURIComponent(baseBranch)}/protection`,
      { headers },
    );

    let requiredChecks: any = null;
    let requiredReviews: any = null;
    let isBranchProtected = false;
    let protectionLookupError: string | null = null;

    if (protectionRes.ok) {
      isBranchProtected = true;
      const protectionData = await protectionRes.json();
      requiredChecks = protectionData.required_status_checks;
      requiredReviews = protectionData.required_pull_request_reviews;
    } else if (protectionRes.status === 404) {
      const data =
        typeof protectionRes.json === 'function'
          ? await protectionRes.json().catch(() => ({}))
          : {};
      const msg = String(data?.message || '').toLowerCase();
      // Only treat as un-protected if GitHub explicitly reports "branch not protected" (or default 404 mock)
      if (!data?.message || msg.includes('not protected')) {
        isBranchProtected = false;
      } else {
        protectionLookupError = `Branch protection lookup returned 404: ${data.message || 'Branch not found'}`;
        this.logger.warn(
          `Project PR #${pullNumber} policy lookup: ${protectionLookupError}`,
        );
      }
    } else if (protectionRes.status === 403) {
      const data =
        typeof protectionRes.json === 'function'
          ? await protectionRes.json().catch(() => ({}))
          : {};
      protectionLookupError = `Insufficient GitHub App permissions to read branch protection (HTTP 403: ${data?.message || 'Forbidden'}).`;
      this.logger.warn(
        `Project PR #${pullNumber} policy lookup: ${protectionLookupError}`,
      );
    } else {
      protectionLookupError = `Failed to query branch protection (HTTP ${protectionRes.status}).`;
      this.logger.warn(
        `Project PR #${pullNumber} policy lookup: ${protectionLookupError}`,
      );
    }

    // 2. Strict branch up-to-date policy
    // Rejects 'behind' ONLY when required policy specifies strict branch up-to-date checks
    const requiresUpToDate = isBranchProtected && !!requiredChecks?.strict;
    if (pr.mergeable_state === 'behind' && requiresUpToDate) {
      return {
        canMerge: false,
        mergeable: pr.mergeable,
        mergeableState: 'behind',
        reason:
          'Pull request branch is out of date with the target branch and required status checks policy specifies it must be up to date before merging.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: false,
      };
    }

    // 3. Required Pull Request Reviews (if branch protection requires reviews)
    if (isBranchProtected && requiredReviews) {
      const minApprovals = requiredReviews.required_approving_review_count ?? 1;
      const reviewsRes = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
        { headers },
      );
      if (reviewsRes.ok) {
        const reviews = await reviewsRes.json();
        const latestReviewByUser: Record<string, string> = {};
        for (const rev of reviews) {
          if (rev.user?.login) {
            latestReviewByUser[rev.user.login] = rev.state;
          }
        }
        if (Object.values(latestReviewByUser).includes('CHANGES_REQUESTED')) {
          return {
            canMerge: false,
            mergeable: pr.mergeable,
            mergeableState: 'blocked',
            reason: 'Changes have been requested by a reviewer.',
            headSha,
            title: pr.title,
            state: pr.state,
            isMerged: false,
          };
        }
        const approvedCount = Object.values(latestReviewByUser).filter(
          (s) => s === 'APPROVED',
        ).length;
        if (approvedCount < minApprovals) {
          return {
            canMerge: false,
            mergeable: pr.mergeable,
            mergeableState: 'blocked',
            reason: `Requires at least ${minApprovals} approving review(s) before merging (currently ${approvedCount}).`,
            headSha,
            title: pr.title,
            state: pr.state,
            isMerged: false,
          };
        }
      }
    }

    // 4. Required Status Checks (Distinguish Required vs Optional Checks)
    if (
      isBranchProtected &&
      requiredChecks &&
      (requiredChecks.contexts?.length || requiredChecks.checks?.length)
    ) {
      const requiredContextNames: string[] = [
        ...(requiredChecks.contexts || []),
        ...(requiredChecks.checks || []).map((c: any) => c.context),
      ];

      if (requiredContextNames.length > 0) {
        const checksRes = await fetch(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${headSha}/check-runs`,
          { headers },
        );
        if (checksRes.ok) {
          const checkData = await checksRes.json();
          const checkRuns = checkData.check_runs || [];

          // Check for failed required checks
          const failedRequired = checkRuns.filter(
            (cr: any) =>
              requiredContextNames.includes(cr.name) &&
              (cr.conclusion === 'failure' || cr.conclusion === 'timed_out'),
          );
          if (failedRequired.length > 0) {
            const names = failedRequired.map((c: any) => c.name).join(', ');
            return {
              canMerge: false,
              mergeable: pr.mergeable,
              mergeableState: 'blocked',
              reason: `Required CI check(s) failed: ${names}`,
              headSha,
              title: pr.title,
              state: pr.state,
              isMerged: false,
            };
          }

          // Check for pending/missing required checks
          const incompleteRequired = requiredContextNames.filter(
            (reqName) =>
              !checkRuns.some(
                (cr: any) => cr.name === reqName && cr.conclusion === 'success',
              ),
          );
          if (incompleteRequired.length > 0) {
            return {
              canMerge: false,
              mergeable: pr.mergeable,
              mergeableState: 'blocked',
              reason: `Required CI check(s) have not completed successfully: ${incompleteRequired.join(', ')}`,
              headSha,
              title: pr.title,
              state: pr.state,
              isMerged: false,
            };
          }
        }
      }
    }

    // 5. Fallback for repository rulesets or enterprise policies where mergeable_state is 'blocked'
    if (pr.mergeable_state === 'blocked') {
      const reviewsRes = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`,
        { headers },
      );
      if (reviewsRes.ok) {
        const reviews = await reviewsRes.json();
        const latestReviewByUser: Record<string, string> = {};
        for (const rev of reviews) {
          if (rev.user?.login) {
            latestReviewByUser[rev.user.login] = rev.state;
          }
        }
        if (Object.values(latestReviewByUser).includes('CHANGES_REQUESTED')) {
          return {
            canMerge: false,
            mergeable: pr.mergeable,
            mergeableState: 'blocked',
            reason: 'Changes have been requested by a reviewer.',
            headSha,
            title: pr.title,
            state: pr.state,
            isMerged: false,
          };
        }
      }
      return {
        canMerge: false,
        mergeable: pr.mergeable,
        mergeableState: 'blocked',
        reason: 'Blocked by repository branch protection rules or rulesets.',
        headSha,
        title: pr.title,
        state: pr.state,
        isMerged: false,
      };
    }

    // Clean, unstable (optional checks only), or behind (without strict policy): allow merge!
    return {
      canMerge: true,
      mergeable: pr.mergeable,
      mergeableState: pr.mergeable_state || 'clean',
      headSha,
      title: pr.title,
      state: pr.state,
      isMerged: false,
    };
  }

  public async mergePullRequest(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
    options?: {
      commitTitle?: string;
      commitMessage?: string;
      mergeMethod?: 'squash' | 'merge' | 'rebase';
    },
  ): Promise<{
    sha: string;
    merged: boolean;
    message: string;
    mergedAt: Date;
  }> {
    const mergeability = await this.checkPullRequestMergeability(
      installationId,
      owner,
      repo,
      pullNumber,
    );
    if (!mergeability.canMerge) {
      throw new BadRequestException(
        mergeability.reason || 'Pull request cannot be merged at this time.',
      );
    }

    const accessToken = await this.getInstallationAccessToken(installationId);
    const bodyPayload: any = {
      merge_method: options?.mergeMethod || 'squash',
    };
    if (options?.commitTitle) bodyPayload.commit_title = options.commitTitle;
    if (options?.commitMessage)
      bodyPayload.commit_message = options.commitMessage;

    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg =
        data.message || `GitHub merge failed with status ${res.status}`;
      throw new BadRequestException(`GitHub merge error: ${errMsg}`);
    }

    // Verify GitHub's actual merge result
    const verifiedPR = await this.getPullRequestDetails(
      installationId,
      owner,
      repo,
      pullNumber,
    );
    if (!verifiedPR.merged) {
      throw new BadRequestException(
        'GitHub merge call succeeded but PR status remains unmerged.',
      );
    }

    return {
      sha: data.sha || verifiedPR.merge_commit_sha,
      merged: true,
      message: data.message || 'Pull Request merged successfully',
      mergedAt: verifiedPR.merged_at
        ? new Date(verifiedPR.merged_at)
        : new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REPOSITORY COLLABORATOR ACCESS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  public async searchUsers(
    installationId: string,
    query: string,
  ): Promise<
    Array<{ login: string; id: number; avatar_url: string; html_url: string }>
  > {
    if (!query || query.trim().length === 0) return [];
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/search/users?q=${encodeURIComponent(query.trim())}&per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new BadRequestException(
        err.message || `GitHub user search failed with status ${res.status}`,
      );
    }
    const data = await res.json();
    return (data.items || []).map((u: any) => ({
      login: u.login,
      id: u.id,
      avatar_url: u.avatar_url,
      avatarUrl: u.avatar_url,
      html_url: u.html_url,
    }));
  }

  public async listCollaborators(
    installationId: string,
    owner: string,
    repo: string,
  ): Promise<
    Array<{
      login: string;
      id: number;
      avatar_url: string;
      permissions: any;
      role_name?: string;
    }>
  > {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) {
      if (res.status === 403) {
        throw new BadRequestException(
          'GitHub App lacks required permissions to list collaborators (requires Administration: Read or Members: Read).',
        );
      }
      const err = await res.json().catch(() => ({}));
      throw new BadRequestException(
        err.message || `Failed to list collaborators (HTTP ${res.status})`,
      );
    }
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((c: any) => ({
      login: c.login,
      id: c.id,
      avatar_url: c.avatar_url,
      permissions: c.permissions || {},
      role_name:
        c.role_name ||
        (c.permissions?.admin
          ? 'admin'
          : c.permissions?.push
            ? 'write'
            : 'read'),
    }));
  }

  public async listInvitations(
    installationId: string,
    owner: string,
    repo: string,
  ): Promise<
    Array<{
      id: number;
      invitee: any;
      permissions: string;
      created_at: string;
      html_url: string;
    }>
  > {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/invitations`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) {
      if (res.status === 403) {
        // Invitations endpoint may not be accessible if lack admin permissions; return empty
        return [];
      }
      const err = await res.json().catch(() => ({}));
      throw new BadRequestException(
        err.message || `Failed to list invitations (HTTP ${res.status})`,
      );
    }
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((inv: any) => ({
      id: inv.id,
      invitee: inv.invitee
        ? {
            login: inv.invitee.login,
            avatar_url: inv.invitee.avatar_url,
            id: inv.invitee.id,
          }
        : null,
      permissions: inv.permissions,
      created_at: inv.created_at,
      html_url: inv.html_url,
    }));
  }

  public async inviteCollaborator(
    installationId: string,
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' = 'push',
  ): Promise<{
    id?: number;
    invitee?: any;
    permissions?: string;
    html_url?: string;
    status: string;
  }> {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permission: permission || 'push' }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new BadRequestException(
          'GitHub App lacks permission to invite collaborators to this repository. The GitHub App must be granted "Administration: Read & write" repository permissions.',
        );
      }
      if (res.status === 404) {
        throw new NotFoundException(
          `GitHub user "${username}" or repository not found.`,
        );
      }
      if (res.status === 422) {
        throw new BadRequestException(
          err.message ||
            `Unable to invite ${username}: user may already be a direct collaborator or organization owner.`,
        );
      }
      throw new BadRequestException(
        err.message || `Failed to invite collaborator (HTTP ${res.status})`,
      );
    }

    // HTTP 201: Invitation created; HTTP 204: User was already a collaborator and permissions were updated
    if (res.status === 204) {
      return { status: 'UPDATED', permissions: permission };
    }
    const data = await res.json().catch(() => ({}));
    return {
      id: data.id,
      invitee: data.invitee,
      permissions: data.permissions || permission,
      html_url: data.html_url,
      status: 'INVITATION_SENT',
    };
  }

  public async cancelInvitation(
    installationId: string,
    owner: string,
    repo: string,
    invitationId: number,
  ): Promise<{ success: boolean }> {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/invitations/${invitationId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!res.ok) {
      if (res.status === 404) {
        return { success: true }; // Already deleted
      }
      const err = await res.json().catch(() => ({}));
      throw new BadRequestException(
        err.message || `Failed to cancel invitation (HTTP ${res.status})`,
      );
    }
    return { success: true };
  }

  public async removeCollaborator(
    installationId: string,
    owner: string,
    repo: string,
    username: string,
  ): Promise<{ success: boolean }> {
    const accessToken = await this.getInstallationAccessToken(installationId);
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!res.ok) {
      if (res.status === 404) {
        return { success: true }; // Not a collaborator or already removed
      }
      if (res.status === 403) {
        // If GitHub returns 403, check if the collaborator is already not present on GitHub
        try {
          const currentList = await this.listCollaborators(
            installationId,
            owner,
            repo,
          );
          const stillThere = currentList.some(
            (c) => c.login?.toLowerCase() === username.toLowerCase(),
          );
          if (!stillThere) {
            return { success: true }; // Collaborator is already absent from GitHub repository
          }
        } catch {
          // Fall through to error
        }
        throw new BadRequestException(
          'GitHub App lacks permission to remove collaborators. Requires "Administration: Read & write" repository permissions.',
        );
      }
      const err = await res.json().catch(() => ({}));
      throw new BadRequestException(
        err.message || `Failed to remove collaborator (HTTP ${res.status})`,
      );
    }
    return { success: true };
  }

  private async getGithubConfig(): Promise<any> {
    try {
      const config = await this.prisma.launchpadConfig.findUnique({
        where: { key: 'GITHUB_CONFIG' },
      });
      if (config && typeof config.value === 'object' && config.value !== null) {
        return config.value;
      }
    } catch (e) {
      console.warn('Failed to load GITHUB_CONFIG from database.');
    }
    return {};
  }

  async getConnectUrl(studentId: string): Promise<string> {
    const config = await this.getGithubConfig();
    const appName = config.appName || 'neuravolt-launchpad';
    const state = await this.issueOAuthState(studentId);
    return `https://github.com/apps/${appName}/installations/new?state=${encodeURIComponent(state)}`;
  }

  /** Admin-facing status for the GitHub App settings page — never returns secret values, only presence. */
  async getAdminStatus() {
    const config = await this.getGithubConfig();
    const appName = config.appName || 'neuravolt-launchpad';
    const base = process.env.FRONTEND_URL || 'https://teams.neuravolt.in';
    return {
      appIdConfigured: !!process.env.GITHUB_APP_ID,
      privateKeyConfigured: !!process.env.GITHUB_APP_PRIVATE_KEY,
      webhookSecretConfigured: !!(
        config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET
      ),
      appName,
      installUrl: `https://github.com/apps/${appName}`,
      webhookUrl: `${base}/api/launchpad/github/webhook`,
      callbackUrl: `${base}/api/launchpad/github/callback`,
    };
  }

  public async getSettingsView(scope: 'PROJECTS' | 'LAUNCHPAD' = 'PROJECTS') {
    const creds = await this.getScopedCredentials(scope);
    const configKey =
      scope === 'PROJECTS'
        ? 'PROJECT_GITHUB_CONFIG'
        : 'LAUNCHPAD_GITHUB_CONFIG';
    const dbRecord = await this.prisma.launchpadConfig.findUnique({
      where: { key: configKey },
    });
    const val: any = dbRecord?.value || {};
    const base = process.env.FRONTEND_URL || 'https://teams.neuravolt.in';

    return {
      scope,
      appId: creds.appId || '',
      appName:
        creds.appName ||
        (scope === 'PROJECTS'
          ? 'neuravolt-os-projects'
          : 'neuravolt-launchpad'),
      isPrivateKeyConfigured: !!creds.privateKey,
      isWebhookSecretConfigured: !!creds.webhookSecret,
      source: creds.source,
      hasRollback: !!val.previousConfig,
      lastTestedAt: val.lastTestedAt || null,
      lastTestStatus: val.lastTestStatus || null,
      lastTestMessage: val.lastTestMessage || null,
      webhookUrl:
        scope === 'PROJECTS'
          ? `${base}/api/v1/github/webhook/project`
          : `${base}/api/launchpad/github/webhook`,
      legacySharedWebhookUrl: `${base}/api/launchpad/github/webhook`,
      callbackUrl: `${base}/api/v1/auth/github/callback`,
    };
  }

  public async updateSettings(
    scope: 'PROJECTS' | 'LAUNCHPAD',
    dto: {
      appId?: string;
      appName?: string;
      privateKey?: string;
      webhookSecret?: string;
    },
    adminUser: any,
  ) {
    const configKey =
      scope === 'PROJECTS'
        ? 'PROJECT_GITHUB_CONFIG'
        : 'LAUNCHPAD_GITHUB_CONFIG';
    const existing = await this.prisma.launchpadConfig.findUnique({
      where: { key: configKey },
    });
    const existingVal: any = existing?.value || {};

    if (dto.appId !== undefined && dto.appId !== null && dto.appId !== '') {
      if (!/^\d+$/.test(dto.appId.trim())) {
        throw new BadRequestException(
          'GitHub App ID must be a numeric string.',
        );
      }
    }
    if (
      dto.privateKey !== undefined &&
      dto.privateKey !== null &&
      dto.privateKey !== ''
    ) {
      if (!dto.privateKey.includes('PRIVATE KEY')) {
        throw new BadRequestException(
          'Invalid private key format. Must be an RSA private key in PEM format.',
        );
      }
    }

    let encryptionKey: string;
    try {
      encryptionKey = getEncryptionKey();
    } catch (e: any) {
      throw new BadRequestException(
        `Cannot save encrypted settings: ${e.message}`,
      );
    }

    const previousConfig = {
      appId: existingVal.appId || null,
      appName: existingVal.appName || null,
      privateKeyEnc: existingVal.privateKeyEnc || null,
      webhookSecretEnc: existingVal.webhookSecretEnc || null,
      updatedAt: existing?.updatedAt || new Date(),
    };

    const updatedVal: any = {
      appId:
        dto.appId !== undefined
          ? dto.appId
            ? dto.appId.trim()
            : null
          : existingVal.appId,
      appName:
        dto.appName !== undefined
          ? dto.appName
            ? dto.appName.trim()
            : null
          : existingVal.appName,
      privateKeyEnc: dto.privateKey
        ? encrypt(dto.privateKey.trim(), encryptionKey)
        : existingVal.privateKeyEnc,
      webhookSecretEnc: dto.webhookSecret
        ? encrypt(dto.webhookSecret.trim(), encryptionKey)
        : existingVal.webhookSecretEnc,
      previousConfig:
        existingVal.appId || existingVal.privateKeyEnc
          ? previousConfig
          : existingVal.previousConfig || null,
      updatedBy: adminUser?.id || 'admin',
      updatedByEmail: adminUser?.email || 'admin',
      updatedAt: new Date(),
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
    };

    await this.prisma.launchpadConfig.upsert({
      where: { key: configKey },
      create: {
        key: configKey,
        value: updatedVal,
        description: `Encrypted GitHub App configuration for ${scope}`,
        updatedBy: adminUser?.id || 'admin',
      },
      update: {
        value: updatedVal,
        updatedBy: adminUser?.id || 'admin',
      },
    });

    // Invalidate token cache for this scope
    for (const key of this.tokenCache.keys()) {
      if (key.startsWith(`gh_inst_token:${scope}:`)) {
        this.tokenCache.delete(key);
      }
    }

    // Write audit log with strictly redacted values
    this.logger.log(
      `[AUDIT] GitHub integration settings updated for scope ${scope} by admin ${adminUser?.id || 'admin'} (${adminUser?.email || 'unknown'}). Private key: ${dto.privateKey ? '[REDACTED_UPDATED]' : '[UNCHANGED]'}, Webhook secret: ${dto.webhookSecret ? '[REDACTED_UPDATED]' : '[UNCHANGED]'}.`,
    );

    return this.getSettingsView(scope);
  }

  public async rollbackSettings(
    scope: 'PROJECTS' | 'LAUNCHPAD',
    adminUser: any,
  ) {
    const configKey =
      scope === 'PROJECTS'
        ? 'PROJECT_GITHUB_CONFIG'
        : 'LAUNCHPAD_GITHUB_CONFIG';
    const existing = await this.prisma.launchpadConfig.findUnique({
      where: { key: configKey },
    });
    const existingVal: any = existing?.value || {};

    if (!existingVal.previousConfig) {
      throw new BadRequestException(
        `No previous configuration exists to rollback for scope ${scope}.`,
      );
    }

    const prev = existingVal.previousConfig;
    const restoredVal = {
      appId: prev.appId,
      appName: prev.appName,
      privateKeyEnc: prev.privateKeyEnc,
      webhookSecretEnc: prev.webhookSecretEnc,
      previousConfig: null,
      updatedBy: adminUser?.id || 'admin',
      updatedByEmail: adminUser?.email || 'admin',
      updatedAt: new Date(),
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: 'Rolled back to previous configuration',
    };

    await this.prisma.launchpadConfig.update({
      where: { key: configKey },
      data: {
        value: restoredVal,
        updatedBy: adminUser?.id || 'admin',
      },
    });

    for (const key of this.tokenCache.keys()) {
      if (key.startsWith(`gh_inst_token:${scope}:`)) {
        this.tokenCache.delete(key);
      }
    }

    this.logger.log(
      `[AUDIT] GitHub integration settings rolled back for scope ${scope} by admin ${adminUser?.id || 'admin'}.`,
    );
    return this.getSettingsView(scope);
  }

  public async testScopedConnection(
    scope: 'PROJECTS' | 'LAUNCHPAD',
  ): Promise<{ success: boolean; message: string; slug?: string }> {
    const creds = await this.getScopedCredentials(scope);
    if (!creds.appId || !creds.privateKey) {
      return {
        success: false,
        message: `GitHub App credentials are not configured for ${scope}.`,
      };
    }
    try {
      const appJwt = await this.signAppJwt(scope);
      const res = await fetch(`${GITHUB_API_BASE}/app`, {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) {
        const errorMsg = `GitHub rejected credentials (HTTP ${res.status}). Verify App ID and Private Key.`;
        await this.recordTestResult(scope, false, errorMsg);
        return { success: false, message: errorMsg };
      }
      const data = await res.json();
      const successMsg = `Connected as "${data.name}" (slug: ${data.slug}).`;
      await this.recordTestResult(scope, true, successMsg);
      return {
        success: true,
        message: successMsg,
        slug: data.slug,
      };
    } catch (err: any) {
      const failMsg = `Connection test failed: ${err.message}`;
      await this.recordTestResult(scope, false, failMsg);
      return { success: false, message: failMsg };
    }
  }

  private async recordTestResult(
    scope: 'PROJECTS' | 'LAUNCHPAD',
    success: boolean,
    message: string,
  ) {
    const configKey =
      scope === 'PROJECTS'
        ? 'PROJECT_GITHUB_CONFIG'
        : 'LAUNCHPAD_GITHUB_CONFIG';
    try {
      const existing = await this.prisma.launchpadConfig.findUnique({
        where: { key: configKey },
      });
      if (
        existing &&
        typeof existing.value === 'object' &&
        existing.value !== null
      ) {
        const val: any = existing.value;
        val.lastTestedAt = new Date();
        val.lastTestStatus = success ? 'SUCCESS' : 'FAILED';
        val.lastTestMessage = message;
        await this.prisma.launchpadConfig.update({
          where: { key: configKey },
          data: { value: val },
        });
      }
    } catch {}
  }

  async updateAppName(appName: string, adminId: string) {
    if (!appName || !/^[a-z0-9-]+$/i.test(appName)) {
      throw new BadRequestException(
        'App slug must contain only letters, numbers, and hyphens (this is the part of the URL after github.com/apps/).',
      );
    }
    const current = await this.getGithubConfig();
    const value = { ...current, appName };
    await this.prisma.launchpadConfig.upsert({
      where: { key: 'GITHUB_CONFIG' },
      update: { value, updatedBy: adminId },
      create: { key: 'GITHUB_CONFIG', value, updatedBy: adminId },
    });
    return { success: true, appName };
  }

  /** Signs a real App JWT and calls GitHub's own /app endpoint, so this actually validates the
   *  configured App ID + private key — unlike a generic unauthenticated rate_limit ping. */
  async testAppConnection(): Promise<{
    success: boolean;
    message: string;
    slug?: string;
  }> {
    if (!this.isGithubAppConfigured()) {
      return {
        success: false,
        message:
          'GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set on the server.',
      };
    }
    try {
      const appJwt = this.signAppJwt();
      const res = await fetch(`${GITHUB_API_BASE}/app`, {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) {
        return {
          success: false,
          message: `GitHub rejected the App credentials (status ${res.status}). Check GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY.`,
        };
      }
      const data = await res.json();
      return {
        success: true,
        message: `Connected as "${data.name}" (slug: ${data.slug}).`,
        slug: data.slug,
      };
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async getRecentWebhookDeliveries() {
    return this.prisma.githubWebhook.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
  }

  async handleCallback(code: string, installationId: string, state: string) {
    if (!installationId || !state) {
      throw new BadRequestException('Invalid callback parameters');
    }

    // Launch Blocker 3: studentId now comes only from a verified, single-use, non-expired
    // state token — never trusted as a raw, attacker-suppliable query parameter.
    const studentId = await this.verifyAndConsumeOAuthState(state);
    const student = await this.prisma.launchpadStudent.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException('Student account not found');

    // Fetch the real installed GitHub account (login/avatar/id) from the App API.
    const installation = await this.getInstallationAccount(installationId);
    const ghAccount = installation.account || {};

    // Create or update GithubAccount
    const account = await this.prisma.githubAccount.upsert({
      where: { userId: studentId },
      create: {
        userId: studentId,
        githubUserId: String(ghAccount.id || installationId),
        username:
          ghAccount.login ||
          student.fullName.toLowerCase().replace(/\s+/g, '_'),
        avatar: ghAccount.avatar_url || null,
        email: student.email,
        installationId,
        connectedAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        githubUserId: String(ghAccount.id || installationId),
        username: ghAccount.login || undefined,
        avatar: ghAccount.avatar_url || undefined,
        installationId,
        status: 'ACTIVE',
        lastSync: new Date(),
      },
    });

    this.eventBus.emit('GithubConnected', studentId, account.id);

    // Trigger initial sync job
    await this.triggerFullSync(studentId);

    return account;
  }

  async disconnect(studentId: string) {
    const account = await this.prisma.githubAccount.findUnique({
      where: { userId: studentId },
    });
    if (!account)
      throw new NotFoundException('Connected GitHub account not found');

    await this.prisma.githubAccount.delete({
      where: { userId: studentId },
    });

    this.eventBus.emit('GithubDisconnected', studentId, account.id);

    return {
      success: true,
      message: 'GitHub account disconnected successfully',
    };
  }

  async getProfile(studentId: string) {
    const account = await this.prisma.githubAccount.findUnique({
      where: { userId: studentId },
    });
    if (!account) throw new NotFoundException('No GitHub account linked');
    return account;
  }

  async getRepositories(studentId: string) {
    return this.prisma.githubRepository.findMany({
      where: { studentId },
    });
  }

  async getStatistics(studentId: string) {
    const repositories = await this.prisma.githubRepository.findMany({
      where: { studentId },
    });
    const repoIds = repositories.map((r) => r.id);

    const commitsCount = await this.prisma.githubCommit.count({
      where: { repositoryId: { in: repoIds } },
    });

    const prsCount = await this.prisma.githubPullRequest.count({
      where: { repositoryId: { in: repoIds } },
    });

    const mergedPrsCount = await this.prisma.githubPullRequest.count({
      where: { repositoryId: { in: repoIds }, merged: true },
    });

    return {
      commitsCount,
      prsCount,
      mergedPrsCount,
      repositoriesCount: repositories.length,
      contributionScore: commitsCount * 2 + mergedPrsCount * 10,
    };
  }

  async toggleTrackRepository(repoId: string, track: boolean) {
    const repository = await this.prisma.githubRepository.findUnique({
      where: { id: repoId },
    });
    if (!repository) throw new NotFoundException('Repository not found');

    const updated = await this.prisma.githubRepository.update({
      where: { id: repoId },
      data: { tracked: track },
    });

    this.eventBus.emit(
      'RepositoryTracked',
      repository.studentId,
      repoId,
      track,
    );

    return updated;
  }

  async triggerFullSync(studentId: string) {
    const account = await this.prisma.githubAccount.findUnique({
      where: { userId: studentId },
    });
    if (!account) throw new NotFoundException('No GitHub account linked');

    if (!this.isGithubAppConfigured()) {
      this.logger.warn(
        `Skipped GitHub sync for student ${studentId}: GitHub App not configured (set GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY).`,
      );
      return {
        success: false,
        message: 'GitHub App is not configured on this server.',
      };
    }

    const accessToken = await this.getInstallationAccessToken(
      account.installationId,
    );
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    };

    // Returns null (not throwing) on a rate limit, so the caller can stop early and report a
    // clean partial success instead of a hard failure — GitHub Sync Robustness fix.
    const isRateLimited = (res: Response): boolean =>
      (res.status === 403 || res.status === 429) &&
      res.headers.get('x-ratelimit-remaining') === '0';
    const rateLimitResetAt = (res: Response): string => {
      const resetHeader = res.headers.get('x-ratelimit-reset');
      return resetHeader
        ? new Date(Number(resetHeader) * 1000).toISOString()
        : 'unknown';
    };

    // Pagination fix: previously only page 1 (GitHub's default page size) was ever fetched, so
    // an account with more repos than that silently had the rest missing from sync.
    const repositories: any[] = [];
    let rateLimited = false;
    let rateLimitedAt = '';
    for (let page = 1; page <= 20; page++) {
      const reposRes = await fetch(
        `${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`,
        {
          headers: authHeaders,
        },
      );
      if (isRateLimited(reposRes)) {
        rateLimited = true;
        rateLimitedAt = rateLimitResetAt(reposRes);
        break;
      }
      if (!reposRes.ok) {
        if (page === 1)
          throw new BadRequestException(
            `Failed to list installation repositories (status ${reposRes.status}).`,
          );
        break; // partial data already collected from earlier pages — keep it, stop paginating
      }
      const reposData = await reposRes.json();
      const pageRepos: any[] = reposData.repositories || [];
      repositories.push(...pageRepos);
      if (pageRepos.length < 100) break; // last page
    }

    const importedRepos: any[] = [];
    for (const r of repositories) {
      const dbRepo = await this.prisma.githubRepository.upsert({
        where: { githubRepoId: String(r.id) },
        create: {
          githubRepoId: String(r.id),
          owner: r.owner?.login || 'unknown',
          name: r.name,
          defaultBranch: r.default_branch || 'main',
          language: r.language || null,
          private: !!r.private,
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          isFork: !!r.fork,
          studentId,
          tracked: true,
          lastSync: new Date(),
        },
        update: {
          // Fix: owner/name (and isFork) were never updated on repeat syncs — a real GitHub
          // rename/transfer was silently never reflected here, which meant the git-forensics
          // "repository renamed after submission" anti-cheat check could never actually fire.
          owner: r.owner?.login || 'unknown',
          name: r.name,
          defaultBranch: r.default_branch || 'main',
          language: r.language || null,
          private: !!r.private,
          stars: r.stargazers_count || 0,
          forks: r.forks_count || 0,
          isFork: !!r.fork,
          lastSync: new Date(),
        },
      });
      importedRepos.push({ dbRepo, owner: r.owner?.login, name: r.name });
    }

    // Import recent commits for each tracked repo. Bumped 20 -> 100 (GitHub's per-page max) —
    // still a single request per repo, not full history: the local sandbox clone (git-forensics
    // validator) is the actual source of truth for full commit history, this table only needs
    // enough recent SHAs to cross-reference for force-push/cherry-pick detection.
    for (const { dbRepo, owner, name } of importedRepos) {
      if (rateLimited) break;
      const commitsRes = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${name}/commits?per_page=100`,
        { headers: authHeaders },
      );
      if (isRateLimited(commitsRes)) {
        rateLimited = true;
        rateLimitedAt = rateLimitResetAt(commitsRes);
        break;
      }
      if (!commitsRes.ok) continue; // e.g. empty repo returns 409 — skip, not fatal

      const commits: any[] = await commitsRes.json();
      for (const c of commits) {
        const sha = c.sha;
        const existing = await this.prisma.githubCommit.findUnique({
          where: { sha },
        });
        if (existing) continue;

        const created = await this.prisma.githubCommit.create({
          data: {
            repositoryId: dbRepo.id,
            sha,
            author: c.commit?.author?.name || c.author?.login || 'unknown',
            message: c.commit?.message || '',
            filesChanged: 0,
            insertions: 0,
            deletions: 0,
            commitDate: c.commit?.author?.date
              ? new Date(c.commit.author.date)
              : new Date(),
          },
        });
        this.eventBus.emit(
          'CommitCreated',
          studentId,
          dbRepo.id,
          sha,
          created.id,
        );
      }
    }

    await this.prisma.githubAccount.update({
      where: { userId: studentId },
      data: { lastSync: new Date() },
    });

    this.eventBus.emit('RepositorySynced', studentId);

    if (rateLimited) {
      this.logger.warn(
        `GitHub sync for student ${studentId} stopped early: rate limit reached, resets ${rateLimitedAt}.`,
      );
      return {
        success: true,
        message: `Synced ${importedRepos.length} repositories from GitHub (stopped early: GitHub API rate limit reached, resets at ${rateLimitedAt}).`,
      };
    }

    return {
      success: true,
      message: `Synced ${importedRepos.length} repositories from GitHub.`,
    };
  }

  async verifyWebhookSignature(
    signature: string,
    rawBody: string,
  ): Promise<boolean> {
    if (!rawBody || typeof rawBody !== 'string' || rawBody.length === 0) {
      throw new BadRequestException(
        'Raw request body is required for webhook signature verification.',
      );
    }
    const config = await this.getGithubConfig();
    const webhookSecret =
      config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException(
        'GitHub webhook secret is not configured (set GITHUB_WEBHOOK_SECRET).',
      );
    }
    if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) {
      return false;
    }
    const computedSignature = `sha256=${crypto
      .createHmac('sha256', webhookSecret)
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('hex')}`;
    const sigBuf = Buffer.from(signature, 'utf8');
    const computedBuf = Buffer.from(computedSignature, 'utf8');
    if (sigBuf.length !== computedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, computedBuf);
  }

  async processWebhook(
    headers: Record<string, string>,
    body: any,
    rawBody?: string,
  ) {
    const signature = headers['x-hub-signature-256'];
    const event = headers['x-github-event'];
    const deliveryId = headers['x-github-delivery'];

    if (!rawBody) {
      throw new BadRequestException(
        'Raw request body is required for webhook signature verification.',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing GitHub Webhook signature');
    }

    const isValid = await this.verifyWebhookSignature(signature, rawBody);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Webhook signature verification');
    }

    const installationId = String(body.installation?.id || '0');
    const repositoryId = body.repository?.id
      ? String(body.repository.id)
      : null;
    const repoFullName = body.repository?.full_name
      ? String(body.repository.full_name).toLowerCase()
      : null;

    // Webhook Idempotency & Delivery State Machine with Stuck Lease Recovery
    const PROCESSING_LEASE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes lease
    let webhookRecord: any = null;
    if (deliveryId) {
      webhookRecord = await this.prisma.githubWebhook.findUnique({
        where: { deliveryId },
      });

      if (webhookRecord) {
        if (webhookRecord.status === 'PROCESSED') {
          this.logger.log(
            `Webhook delivery ${deliveryId} already processed. Skipping duplicate.`,
          );
          return { success: true, duplicate: true, status: 'PROCESSED' };
        }
        if (webhookRecord.status === 'PROCESSING') {
          const lastActiveTime =
            webhookRecord.processedAt || webhookRecord.receivedAt;
          const elapsedMs = Date.now() - new Date(lastActiveTime).getTime();
          if (elapsedMs < PROCESSING_LEASE_TIMEOUT_MS) {
            this.logger.log(
              `Webhook delivery ${deliveryId} is currently being processed. Ignoring concurrent delivery.`,
            );
            return { success: true, duplicate: true, status: 'PROCESSING' };
          }
          // Lease expired: worker crashed or stalled. Recover delivery for reprocessing atomically.
          this.logger.warn(
            `Webhook delivery ${deliveryId} was stuck in PROCESSING for ${Math.round(elapsedMs / 1000)}s (lease expired). Reclaiming lease.`,
          );
          const updateResult = await this.prisma.githubWebhook.updateMany({
            where: {
              deliveryId,
              status: 'PROCESSING',
              receivedAt: webhookRecord.receivedAt,
            },
            data: {
              status: 'PROCESSING',
              retryCount: { increment: 1 },
              errorMessage: null,
              receivedAt: new Date(),
            },
          });
          if (updateResult.count === 0) {
            this.logger.log(
              `Webhook delivery ${deliveryId} lease was already reclaimed by another worker.`,
            );
            return { success: true, duplicate: true, status: 'PROCESSING' };
          }
          webhookRecord = await this.prisma.githubWebhook.findUnique({
            where: { deliveryId },
          });
        } else if (webhookRecord.status === 'FAILED') {
          // If status === 'FAILED', allow retry atomically
          const updateResult = await this.prisma.githubWebhook.updateMany({
            where: {
              deliveryId,
              status: 'FAILED',
            },
            data: {
              status: 'PROCESSING',
              retryCount: { increment: 1 },
              errorMessage: null,
              receivedAt: new Date(),
            },
          });
          if (updateResult.count === 0) {
            return { success: true, duplicate: true, status: 'PROCESSING' };
          }
          webhookRecord = await this.prisma.githubWebhook.findUnique({
            where: { deliveryId },
          });
        }
      }
    }

    if (!webhookRecord) {
      try {
        webhookRecord = await this.prisma.githubWebhook.create({
          data: {
            deliveryId: deliveryId || null,
            installationId,
            repositoryId,
            event: event || 'unknown',
            payload: body,
            status: 'PROCESSING',
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' && deliveryId) {
          this.logger.log(
            `Concurrent delivery insertion caught for ${deliveryId}.`,
          );
          return { success: true, duplicate: true, status: 'PROCESSING' };
        }
        throw err;
      }
    }

    try {
      // Deterministic Dispatcher Routing with Strict Module Isolation:
      // 1. Check if repository is bound to a Project (Prioritizing trusted numeric repositoryId)
      let projectTarget: { id: string; key: string | null } | null = null;
      if (repositoryId) {
        projectTarget = await this.prisma.project.findFirst({
          where: { githubRepoId: repositoryId },
          select: { id: true, key: true },
        });
      }
      if (!projectTarget && repoFullName) {
        // Fallback for legacy bindings where githubRepoId is not yet backfilled,
        // but only if the repository is not claimed as a Launchpad student repo
        const isLaunchpadRepo = repositoryId
          ? await this.prisma.githubRepository.findUnique({
              where: { githubRepoId: repositoryId },
              select: { id: true },
            })
          : null;

        if (!isLaunchpadRepo) {
          projectTarget = await this.prisma.project.findFirst({
            where: {
              githubRepo: {
                equals: repoFullName,
                mode: 'insensitive' as const,
              },
              githubRepoId: null,
            },
            select: { id: true, key: true },
          });
        }
      }

      // 2. Check if repository or installation belongs to Launchpad student
      const launchpadAccount = await this.prisma.githubAccount.findFirst({
        where: { installationId },
        select: { id: true, userId: true },
      });
      const launchpadRepo = repositoryId
        ? await this.prisma.githubRepository.findUnique({
            where: { githubRepoId: repositoryId },
            select: { id: true, studentId: true },
          })
        : null;

      let dispatched = false;

      // Concurrency & Stale Worker Guard:
      // Verify that this worker's lease is still active before executing any business side effects.
      // If another worker reclaimed the lease while this worker was stalled/delayed, abort immediately.
      const verifyLeaseActive = async (): Promise<boolean> => {
        if (!deliveryId) return true;
        const activeLease = await this.prisma.githubWebhook.findFirst({
          where: {
            id: webhookRecord.id,
            status: 'PROCESSING',
            receivedAt: webhookRecord.receivedAt,
          },
          select: { id: true },
        });
        return !!activeLease;
      };

      if (!(await verifyLeaseActive())) {
        this.logger.warn(
          `Worker for delivery ${deliveryId} lost its lease (superseded by another worker). Aborting business side effects.`,
        );
        return {
          success: true,
          duplicate: true,
          status: 'PROCESSING',
          leaseLost: true,
        };
      }

      // Route A: Project Repository -> ProjectGithubSyncService (STRICT ISOLATION: Mutual Exclusion)
      if (projectTarget) {
        if (!(await verifyLeaseActive())) {
          this.logger.warn(
            `Worker for delivery ${deliveryId} lost lease before Project sync. Aborting.`,
          );
          return {
            success: true,
            duplicate: true,
            status: 'PROCESSING',
            leaseLost: true,
          };
        }
        await this.projectSyncService.handleWebhookEvent(event, body);
        dispatched = true;
      } else if (launchpadAccount || launchpadRepo) {
        // Route B: Launchpad Student Repository -> LaunchpadEventBus (Only if NOT a Project repository)
        if (
          event === 'pull_request' &&
          body.action === 'closed' &&
          body.pull_request?.merged
        ) {
          if (!(await verifyLeaseActive())) {
            this.logger.warn(
              `Worker for delivery ${deliveryId} lost lease before Launchpad event emission. Aborting.`,
            );
            return {
              success: true,
              duplicate: true,
              status: 'PROCESSING',
              leaseLost: true,
            };
          }
          const studentId =
            launchpadAccount?.userId || launchpadRepo?.studentId;
          if (studentId) {
            this.eventBus.emit(
              'PullRequestMerged',
              studentId,
              body.pull_request?.html_url,
            );
          }
        }
        dispatched = true;
      }

      if (!dispatched) {
        this.logger.log(
          `Webhook delivery ${deliveryId} received for unregistered repository ${repoFullName || repositoryId || 'unknown'}.`,
        );
      }

      // Mark delivery as successfully processed (only if our lease is still current)
      const finalizeResult = await this.prisma.githubWebhook.updateMany({
        where: {
          id: webhookRecord.id,
          status: 'PROCESSING',
          receivedAt: webhookRecord.receivedAt,
        },
        data: {
          status: 'PROCESSED',
          processed: true,
          processedAt: new Date(),
        },
      });

      if (finalizeResult.count === 0) {
        this.logger.warn(
          `Worker for delivery ${deliveryId} completed processing but lease was superseded by another worker.`,
        );
        return {
          success: true,
          duplicate: true,
          status: 'PROCESSING',
          leaseLost: true,
        };
      }

      return {
        success: true,
        deliveryId,
        status: 'PROCESSED',
        unrouted: !dispatched,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed processing webhook delivery ${deliveryId}: ${error.message}`,
        error.stack,
      );
      await this.prisma.githubWebhook.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown processing error',
        },
      });
      throw error;
    }
  }
}
