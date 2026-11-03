import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TasksService } from '../../tasks/tasks.service';

@Injectable()
export class ProjectGithubSyncService {
  private readonly logger = new Logger(ProjectGithubSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Extracts project task codes from a string (branch ref, PR title, commit message).
   * Matches e.g. "task/nv-13-payment-webhook" -> "NV-13", "Fixes [CORE-42]" -> "CORE-42".
   */
  public extractTaskCodes(text: string): string[] {
    if (!text) return [];
    const codes = new Set<string>();

    // 1. Match task/<code-prefix>-<digits> in branch names
    const branchMatch = text.match(/task\/([a-zA-Z0-9]+-\d+)/i);
    if (branchMatch && branchMatch[1]) {
      codes.add(branchMatch[1].toUpperCase());
    }

    // 2. Match standalone KEY-123 in title, body, or branch
    const generalMatches = text.matchAll(/\b([a-zA-Z0-9]{2,10}-\d+)\b/g);
    for (const match of generalMatches) {
      if (match[1]) {
        codes.add(match[1].toUpperCase());
      }
    }

    return Array.from(codes);
  }

  /**
   * Processes GitHub webhook event payloads for project-level task synchronization.
   * Completely decoupled and air-gapped from AMC, Billing, and Launchpad logic.
   */
  async handleWebhookEvent(
    event: string,
    body: any,
  ): Promise<{ handled: boolean; matchedTasks: number }> {
    if (event === 'pull_request') {
      return this.handlePullRequestEvent(body);
    } else if (event === 'pull_request_review') {
      return this.handlePullRequestReviewEvent(body);
    } else if (event === 'check_run') {
      return this.handleCheckRunEvent(body);
    } else if (event === 'push') {
      return this.handlePushEvent(body);
    }

    return { handled: false, matchedTasks: 0 };
  }

  private async handlePullRequestEvent(
    body: any,
  ): Promise<{ handled: boolean; matchedTasks: number }> {
    const pr = body.pull_request;
    const repo = body.repository;
    const action = body.action;

    if (!pr || !repo) {
      return { handled: false, matchedTasks: 0 };
    }

    const repoFullName = repo.full_name;
    const repoId = String(repo.id);

    // Collect search texts: head ref, PR title, PR body
    const searchTexts = [
      pr.head?.ref || '',
      pr.title || '',
      pr.body || '',
    ].join(' ');

    const detectedCodes = this.extractTaskCodes(searchTexts);

    if (detectedCodes.length === 0) {
      this.logger.debug(
        `No task codes found in PR #${pr.number} (${repoFullName})`,
      );
      return { handled: false, matchedTasks: 0 };
    }

    let matchedCount = 0;

    for (const taskCode of detectedCodes) {
      // Find task matching taskCode
      const task = await this.prisma.task.findFirst({
        where: {
          taskCode: { equals: taskCode, mode: 'insensitive' },
          deletedAt: null,
        },
        include: { project: true },
      });

      if (!task) {
        continue;
      }

      matchedCount++;

      // 1. Multi-PR Upsert (TaskPullRequest 1:N) with Out-of-Order Event Protection
      const existingPR = await this.prisma.taskPullRequest.findUnique({
        where: {
          taskId_repoFullName_prNumber: {
            taskId: task.id,
            repoFullName,
            prNumber: pr.number,
          },
        },
      });

      // Out-of-order protection: If PR is already merged in DB, a delayed/stale event must NOT unmerge it
      const isMerged = !!pr.merged || !!existingPR?.isMerged;
      const status = isMerged
        ? 'MERGED'
        : pr.state === 'closed'
          ? 'CLOSED'
          : pr.draft
            ? 'DRAFT'
            : existingPR?.isMerged
              ? 'MERGED'
              : 'OPEN';

      await this.prisma.taskPullRequest.upsert({
        where: {
          taskId_repoFullName_prNumber: {
            taskId: task.id,
            repoFullName,
            prNumber: pr.number,
          },
        },
        create: {
          taskId: task.id,
          prNumber: pr.number,
          prTitle: pr.title || 'Untitled PR',
          prUrl: pr.html_url || '',
          repoFullName,
          repoId,
          headBranch: pr.head?.ref || '',
          baseBranch: pr.base?.ref || '',
          status,
          isMerged,
          mergedAt: pr.merged_at
            ? new Date(pr.merged_at)
            : existingPR?.mergedAt || null,
          authorLogin: pr.user?.login || null,
          authorAvatarUrl: pr.user?.avatar_url || null,
        },
        update: {
          prTitle: pr.title || undefined,
          headBranch: pr.head?.ref || undefined,
          baseBranch: pr.base?.ref || undefined,
          status,
          isMerged,
          mergedAt: pr.merged_at
            ? new Date(pr.merged_at)
            : existingPR?.mergedAt || undefined,
          authorLogin: pr.user?.login || undefined,
          authorAvatarUrl: pr.user?.avatar_url || undefined,
        },
      });

      // 2. Task Status Synchronization (Preserving QA Workflow & Stale Event Protection)
      // When PR is opened or updated, move from TODO / IN_PROGRESS to REVIEW. Never regress from DONE or REVIEW.
      if (
        action === 'opened' ||
        action === 'synchronize' ||
        action === 'reopened'
      ) {
        const currentStatus = task.status;
        if (currentStatus === 'TODO' || currentStatus === 'IN_PROGRESS') {
          await this.tasksService.updateTaskStatus(task.id, {
            status: 'review',
          });
          this.logger.log(
            `Task ${task.taskCode} transitioned from ${currentStatus} to REVIEW (PR #${pr.number} ${action}).`,
          );
        }
      }

      // When PR is merged:
      // PRESERVE QA WORKFLOW: Do NOT mark task DONE!
      // Merged code enters develop/main for QA testing and verification.
      // If task is already DONE (verified by QA), do NOT regress it back to REVIEW.
      if (action === 'closed' && isMerged) {
        if (task.status !== 'REVIEW' && task.status !== 'DONE') {
          await this.tasksService.updateTaskStatus(task.id, {
            status: 'review',
          });
        }
        this.logger.log(
          `Task ${task.taskCode} retained in ${task.status} status for QA verification (PR #${pr.number} merged).`,
        );
      }
    }

    return { handled: matchedCount > 0, matchedTasks: matchedCount };
  }

  private async handlePullRequestReviewEvent(
    body: any,
  ): Promise<{ handled: boolean; matchedTasks: number }> {
    const pr = body.pull_request;
    const repo = body.repository;
    const review = body.review;

    if (!pr || !repo || !review) {
      return { handled: false, matchedTasks: 0 };
    }

    const state = (review.state || '').toUpperCase();
    let reviewStatus = 'PENDING';
    if (state === 'APPROVED') {
      reviewStatus = 'APPROVED';
    } else if (state === 'CHANGES_REQUESTED') {
      reviewStatus = 'CHANGES_REQUESTED';
    } else if (state === 'COMMENTED') {
      reviewStatus = 'COMMENTED';
    }

    // Out-of-order guard: If already APPROVED, a generic COMMENTED review event must not downgrade approval
    const existingRecords = await this.prisma.taskPullRequest.findMany({
      where: {
        repoFullName: repo.full_name,
        prNumber: pr.number,
      },
    });

    let updatedCount = 0;
    for (const record of existingRecords) {
      if (record.reviewStatus === 'APPROVED' && reviewStatus === 'COMMENTED') {
        continue; // Keep APPROVED
      }
      await this.prisma.taskPullRequest.update({
        where: { id: record.id },
        data: { reviewStatus },
      });
      updatedCount++;
    }

    return { handled: updatedCount > 0, matchedTasks: updatedCount };
  }

  private async handleCheckRunEvent(
    body: any,
  ): Promise<{ handled: boolean; matchedTasks: number }> {
    const checkRun = body.check_run;
    const repo = body.repository;

    if (!checkRun || !repo) {
      return { handled: false, matchedTasks: 0 };
    }

    // Determine CI status
    let ciStatus = 'PENDING';
    if (checkRun.status === 'completed') {
      if (checkRun.conclusion === 'success') {
        ciStatus = 'SUCCESS';
      } else if (
        ['failure', 'timed_out', 'action_required', 'cancelled'].includes(
          checkRun.conclusion,
        )
      ) {
        ciStatus = 'FAILURE';
      }
    }

    // Update by pull requests attached to check run with out-of-order guard
    let totalUpdated = 0;
    if (Array.isArray(checkRun.pull_requests)) {
      for (const pr of checkRun.pull_requests) {
        const records = await this.prisma.taskPullRequest.findMany({
          where: {
            repoFullName: repo.full_name,
            prNumber: pr.number,
          },
        });
        for (const record of records) {
          // Do not downgrade SUCCESS to PENDING on delayed check runs
          if (record.ciStatus === 'SUCCESS' && ciStatus === 'PENDING') {
            continue;
          }
          await this.prisma.taskPullRequest.update({
            where: { id: record.id },
            data: { ciStatus },
          });
          totalUpdated++;
        }
      }
    }

    return { handled: totalUpdated > 0, matchedTasks: totalUpdated };
  }

  private async handlePushEvent(
    body: any,
  ): Promise<{ handled: boolean; matchedTasks: number }> {
    const ref = body.ref || '';
    const branchName = ref.replace('refs/heads/', '');
    const repo = body.repository;
    const commits = Array.isArray(body.commits) ? body.commits : [];

    if (!repo) {
      return { handled: false, matchedTasks: 0 };
    }

    const repoFullName = repo.full_name;
    const isDefaultBranch =
      branchName === (repo.default_branch || 'main') ||
      branchName === 'main' ||
      branchName === 'master';

    // Collect search texts: ref branch and all commit messages
    const commitMessages = commits.map((c: any) => c.message || '').join(' ');
    const searchTexts = `${branchName} ${commitMessages}`;
    const detectedCodes = this.extractTaskCodes(searchTexts);

    if (detectedCodes.length === 0) {
      this.logger.debug(
        `No task codes found in push event to ${repoFullName}:${branchName}`,
      );
      return { handled: false, matchedTasks: 0 };
    }

    let matchedCount = 0;

    for (const taskCode of detectedCodes) {
      const task = await this.prisma.task.findFirst({
        where: {
          taskCode: { equals: taskCode, mode: 'insensitive' },
          deletedAt: null,
        },
        include: { project: true },
      });

      if (!task) {
        continue;
      }

      matchedCount++;

      // 1. Update task's githubBranch if on task branch or not yet set
      const updateData: any = {};
      if (branchName.startsWith('task/') || !task.githubBranch) {
        updateData.githubBranch = branchName;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: updateData,
        });
      }

      // 2. Synchronize Status:
      // If code pushed to main/default branch, move to 'review' for QA verification
      if (isDefaultBranch) {
        if (task.status === 'TODO' || task.status === 'IN_PROGRESS') {
          await this.tasksService.updateTaskStatus(task.id, {
            status: 'review',
          });
          this.logger.log(
            `Task ${task.taskCode} transitioned to REVIEW from ${task.status} (commits pushed to default branch ${branchName}).`,
          );
        }
      } else {
        // If code pushed to a feature or task branch, move TODO -> IN_PROGRESS
        if (task.status === 'TODO') {
          await this.tasksService.updateTaskStatus(task.id, {
            status: 'in_progress',
          });
          this.logger.log(
            `Task ${task.taskCode} transitioned to IN_PROGRESS from TODO (branch ${branchName} pushed).`,
          );
        }
      }

      // 3. Post commit tracking comment on the task activity
      const relevantCommits = commits.filter(
        (c: any) =>
          (c.message || '').toLowerCase().includes(taskCode.toLowerCase()) ||
          branchName.toLowerCase().includes(taskCode.toLowerCase()),
      );

      const commitLines = (
        relevantCommits.length > 0 ? relevantCommits : commits.slice(0, 5)
      )
        .map((c: any) => {
          const shortSha = (c.id || '').slice(0, 7);
          const firstLine = (c.message || '').split('\n')[0];
          return `• [\`${shortSha}\`](${c.url || '#'}) ${firstLine}`;
        })
        .join('\n');

      if (commitLines) {
        await this.prisma.comment.create({
          data: {
            taskId: task.id,
            content: `📦 **Code pushed to branch \`${branchName}\`**\n\n${commitLines}`,
          },
        });
      }
    }

    return { handled: matchedCount > 0, matchedTasks: matchedCount };
  }
}
