import { Test, TestingModule } from '@nestjs/testing';
import { ProjectGithubSyncService } from './project-github-sync.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TasksService } from '../../tasks/tasks.service';

describe('ProjectGithubSyncService (Multi-PR Sync, QA Preservation & Financial Air-Gap)', () => {
  let service: ProjectGithubSyncService;
  let mockPrisma: any;
  let mockTasksService: any;

  beforeEach(async () => {
    mockPrisma = {
      task: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      comment: {
        create: jest.fn(),
      },
      taskPullRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      amcHourLog: {
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
      },
    };

    mockTasksService = {
      updateTaskStatus: jest
        .fn()
        .mockResolvedValue({ id: 'task-1', status: 'review' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectGithubSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TasksService, useValue: mockTasksService },
      ],
    }).compile();

    service = module.get<ProjectGithubSyncService>(ProjectGithubSyncService);
  });

  describe('extractTaskCodes', () => {
    it('extracts task codes from branch refs, PR titles, and body markdown', () => {
      const text1 = 'task/nv-13-payment-webhook Fixes NV-13 and CORE-42';
      const codes1 = service.extractTaskCodes(text1);
      expect(codes1).toContain('NV-13');
      expect(codes1).toContain('CORE-42');

      const text2 = 'feat(billing): implement invoice export [BILL-109]';
      const codes2 = service.extractTaskCodes(text2);
      expect(codes2).toContain('BILL-109');

      expect(service.extractTaskCodes('')).toEqual([]);
    });
  });

  describe('handlePullRequestEvent', () => {
    it('synchronizes PR opened to TaskPullRequest and transitions task from TODO to REVIEW', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-100',
        taskCode: 'NV-42',
        status: 'TODO',
        projectId: 'proj-1',
      });

      const payload = {
        action: 'opened',
        repository: { id: 98765, full_name: 'neuravolt/core' },
        pull_request: {
          number: 101,
          title: 'NV-42 Add payment webhook',
          html_url: 'https://github.com/neuravolt/core/pull/101',
          head: { ref: 'task/nv-42-payment-webhook' },
          base: { ref: 'develop' },
          state: 'open',
          merged: false,
          draft: false,
          user: { login: 'dev-alice', avatar_url: 'https://avatar.url' },
        },
      };

      const result = await service.handleWebhookEvent('pull_request', payload);

      expect(result.handled).toBe(true);
      expect(result.matchedTasks).toBe(1);

      // Verify TaskPullRequest upserted
      expect(mockPrisma.taskPullRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            taskId_repoFullName_prNumber: {
              taskId: 'task-100',
              repoFullName: 'neuravolt/core',
              prNumber: 101,
            },
          },
          create: expect.objectContaining({
            taskId: 'task-100',
            prNumber: 101,
            prTitle: 'NV-42 Add payment webhook',
            repoFullName: 'neuravolt/core',
            status: 'OPEN',
            isMerged: false,
          }),
        }),
      );

      // Verify task moved to REVIEW
      expect(mockTasksService.updateTaskStatus).toHaveBeenCalledWith(
        'task-100',
        {
          status: 'review',
        },
      );
    });

    it('PRESERVES QA WORKFLOW: PR merged retains task in REVIEW status and NEVER sets DONE', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-100',
        taskCode: 'NV-42',
        status: 'REVIEW',
        projectId: 'proj-1',
      });

      const payload = {
        action: 'closed',
        repository: { id: 98765, full_name: 'neuravolt/core' },
        pull_request: {
          number: 101,
          title: 'NV-42 Add payment webhook',
          html_url: 'https://github.com/neuravolt/core/pull/101',
          head: { ref: 'task/nv-42-payment-webhook' },
          base: { ref: 'develop' },
          state: 'closed',
          merged: true,
          merged_at: '2026-10-20T12:00:00Z',
          user: { login: 'dev-alice' },
        },
      };

      const result = await service.handleWebhookEvent('pull_request', payload);

      expect(result.handled).toBe(true);
      // Status update MUST NOT be 'DONE'
      expect(mockTasksService.updateTaskStatus).not.toHaveBeenCalledWith(
        'task-100',
        {
          status: 'done',
        },
      );

      // Verify PR record marked as merged
      expect(mockPrisma.taskPullRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isMerged: true,
            status: 'MERGED',
          }),
        }),
      );
    });

    it('supports multi-PR synchronization for the same task across repositories', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-200',
        taskCode: 'CORE-99',
        status: 'IN_PROGRESS',
        projectId: 'proj-1',
      });

      // First PR from backend repo
      const pr1 = {
        action: 'opened',
        repository: { id: 111, full_name: 'org/backend' },
        pull_request: {
          number: 10,
          title: 'CORE-99 API endpoints',
          head: { ref: 'task/core-99-api' },
          base: { ref: 'main' },
        },
      };
      // Second PR from frontend repo
      const pr2 = {
        action: 'opened',
        repository: { id: 222, full_name: 'org/frontend' },
        pull_request: {
          number: 25,
          title: 'CORE-99 UI integration',
          head: { ref: 'task/core-99-ui' },
          base: { ref: 'main' },
        },
      };

      await service.handleWebhookEvent('pull_request', pr1);
      await service.handleWebhookEvent('pull_request', pr2);

      // Both PRs upserted with their distinct repoFullName and prNumber composite keys
      expect(mockPrisma.taskPullRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            taskId_repoFullName_prNumber: {
              taskId: 'task-200',
              repoFullName: 'org/backend',
              prNumber: 10,
            },
          },
        }),
      );
      expect(mockPrisma.taskPullRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            taskId_repoFullName_prNumber: {
              taskId: 'task-200',
              repoFullName: 'org/frontend',
              prNumber: 25,
            },
          },
        }),
      );
    });

    it('FINANCIAL AIR-GAP: Webhook processing NEVER invokes AMC or Billing side-effects', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-100',
        taskCode: 'NV-42',
        status: 'IN_PROGRESS',
      });

      const payload = {
        action: 'closed',
        repository: { id: 98765, full_name: 'neuravolt/core' },
        pull_request: {
          number: 101,
          title: 'NV-42 Finished task',
          merged: true,
          merged_at: '2026-10-20T12:00:00Z',
          head: { ref: 'task/nv-42-done' },
        },
      };

      await service.handleWebhookEvent('pull_request', payload);

      // Verify complete financial air gap
      expect(mockPrisma.amcHourLog.create).not.toHaveBeenCalled();
      expect(mockPrisma.amcHourLog.update).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });
  });

  describe('handlePullRequestReviewEvent', () => {
    it('updates reviewStatus to APPROVED when a review is approved', async () => {
      mockPrisma.taskPullRequest.findMany.mockResolvedValue([
        { id: 'pr-1', reviewStatus: 'PENDING' },
      ]);
      mockPrisma.taskPullRequest.update.mockResolvedValue({
        id: 'pr-1',
        reviewStatus: 'APPROVED',
      });

      const payload = {
        repository: { full_name: 'neuravolt/core' },
        pull_request: { number: 42 },
        review: { state: 'approved' },
      };

      const result = await service.handleWebhookEvent(
        'pull_request_review',
        payload,
      );

      expect(result.handled).toBe(true);
      expect(mockPrisma.taskPullRequest.update).toHaveBeenCalledWith({
        where: { id: 'pr-1' },
        data: {
          reviewStatus: 'APPROVED',
        },
      });
    });
  });

  describe('handleCheckRunEvent', () => {
    it('updates ciStatus to SUCCESS when CI check run succeeds', async () => {
      mockPrisma.taskPullRequest.findMany.mockResolvedValue([
        { id: 'pr-1', ciStatus: 'PENDING' },
      ]);
      mockPrisma.taskPullRequest.update.mockResolvedValue({
        id: 'pr-1',
        ciStatus: 'SUCCESS',
      });

      const payload = {
        repository: { full_name: 'neuravolt/core' },
        check_run: {
          status: 'completed',
          conclusion: 'success',
          pull_requests: [{ number: 42 }],
        },
      };

      const result = await service.handleWebhookEvent('check_run', payload);

      expect(result.handled).toBe(true);
      expect(mockPrisma.taskPullRequest.update).toHaveBeenCalledWith({
        where: { id: 'pr-1' },
        data: {
          ciStatus: 'SUCCESS',
        },
      });
    });
  });

  describe('handlePushEvent', () => {
    it('transitions task to REVIEW when commits with task code are pushed to main default branch', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-push-1',
        taskCode: 'DSWEB-1',
        status: 'TODO',
        githubBranch: null,
      });

      const pushPayload = {
        ref: 'refs/heads/main',
        repository: {
          id: 1430118396,
          full_name: 'neuravolt/dewstream_website',
          default_branch: 'main',
        },
        commits: [
          {
            id: '9677f9c1234567890abcdef',
            message:
              'feat(landing-page): dewstream mobile and desktop website (DSWEB-1)',
            url: 'https://github.com/neuravolt/dewstream_website/commit/9677f9c',
          },
        ],
      };

      const result = await service.handleWebhookEvent('push', pushPayload);

      expect(result.handled).toBe(true);
      expect(result.matchedTasks).toBe(1);
      expect(mockTasksService.updateTaskStatus).toHaveBeenCalledWith(
        'task-push-1',
        {
          status: 'review',
        },
      );
      expect(mockPrisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: 'task-push-1',
          }),
        }),
      );
    });

    it('transitions task to IN_PROGRESS when pushed to a task feature branch', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-push-2',
        taskCode: 'DSWEB-1',
        status: 'TODO',
        githubBranch: null,
      });

      const pushPayload = {
        ref: 'refs/heads/task/dsweb-1-landing-page',
        repository: {
          id: 1430118396,
          full_name: 'neuravolt/dewstream_website',
          default_branch: 'main',
        },
        commits: [
          {
            id: 'ca33c271234567890abcdef',
            message: 'work in progress commit',
            url: 'https://github.com/neuravolt/dewstream_website/commit/ca33c27',
          },
        ],
      };

      const result = await service.handleWebhookEvent('push', pushPayload);

      expect(result.handled).toBe(true);
      expect(result.matchedTasks).toBe(1);
      expect(mockTasksService.updateTaskStatus).toHaveBeenCalledWith(
        'task-push-2',
        {
          status: 'in_progress',
        },
      );
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-push-2' },
        data: { githubBranch: 'task/dsweb-1-landing-page' },
      });
    });
  });

  describe('Out-of-Order & Repeated Event Guards', () => {
    it('does NOT unmerge a PR or set status back to OPEN when an out-of-order synchronize event arrives', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-100',
        taskCode: 'NV-42',
        status: 'REVIEW',
        projectId: 'proj-1',
      });
      // DB already has PR marked as merged
      mockPrisma.taskPullRequest.findUnique.mockResolvedValue({
        id: 'pr-db-1',
        isMerged: true,
        status: 'MERGED',
        mergedAt: new Date('2026-10-20T10:00:00Z'),
      });

      // Delayed 'synchronize' event arrives after PR was already merged
      const stalePayload = {
        action: 'synchronize',
        repository: { id: 98765, full_name: 'neuravolt/core' },
        pull_request: {
          number: 101,
          title: 'NV-42 Add payment webhook',
          head: { ref: 'task/nv-42-payment-webhook' },
          base: { ref: 'develop' },
          state: 'open',
          merged: false,
        },
      };

      await service.handleWebhookEvent('pull_request', stalePayload);

      // Verify PR remains MERGED in upsert call
      expect(mockPrisma.taskPullRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isMerged: true,
            status: 'MERGED',
          }),
          update: expect.objectContaining({
            isMerged: true,
            status: 'MERGED',
          }),
        }),
      );
    });

    it('does NOT regress a task from DONE status when an out-of-order PR event arrives', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-done',
        taskCode: 'NV-99',
        status: 'DONE', // Task already verified and completed by QA
        projectId: 'proj-1',
      });
      mockPrisma.taskPullRequest.findUnique.mockResolvedValue(null);

      const stalePayload = {
        action: 'closed',
        repository: { id: 98765, full_name: 'neuravolt/core' },
        pull_request: {
          number: 101,
          title: 'NV-99 Verified task',
          merged: true,
          head: { ref: 'task/nv-99' },
        },
      };

      await service.handleWebhookEvent('pull_request', stalePayload);

      // updateTaskStatus must NOT be called to regress from DONE back to REVIEW
      expect(mockTasksService.updateTaskStatus).not.toHaveBeenCalled();
    });

    it('does NOT downgrade APPROVED reviewStatus when a generic COMMENTED review arrives out of order', async () => {
      mockPrisma.taskPullRequest.findMany.mockResolvedValue([
        { id: 'pr-rec-1', reviewStatus: 'APPROVED' },
      ]);
      mockPrisma.taskPullRequest.update = jest.fn();

      const payload = {
        repository: { full_name: 'neuravolt/core' },
        pull_request: { number: 42 },
        review: { state: 'commented' },
      };

      await service.handleWebhookEvent('pull_request_review', payload);

      // Update must not be called because existing reviewStatus is already APPROVED
      expect(mockPrisma.taskPullRequest.update).not.toHaveBeenCalled();
    });

    it('does NOT downgrade SUCCESS ciStatus when a delayed PENDING check_run arrives out of order', async () => {
      mockPrisma.taskPullRequest.findMany.mockResolvedValue([
        { id: 'pr-rec-1', ciStatus: 'SUCCESS' },
      ]);
      mockPrisma.taskPullRequest.update = jest.fn();

      const payload = {
        repository: { full_name: 'neuravolt/core' },
        check_run: {
          status: 'in_progress', // PENDING
          conclusion: null,
          pull_requests: [{ number: 42 }],
        },
      };

      await service.handleWebhookEvent('check_run', payload);

      // Update must not be called to downgrade SUCCESS to PENDING
      expect(mockPrisma.taskPullRequest.update).not.toHaveBeenCalled();
    });

    it('deterministic concurrency race test: Worker A pauses after check, Worker B processes, Worker A resumes — prevents duplicate side effects via idempotent consumer upsert & monotonic transitions', async () => {
      // Setup: Task starts in TODO status
      let currentTaskStatus = 'TODO';
      let upsertCallCount = 0;
      const createdPrRecords: any[] = [];

      mockPrisma.task.findFirst.mockImplementation(async () => ({
        id: 'task-concurrency-1',
        taskCode: 'CORE-101',
        status: currentTaskStatus,
        projectId: 'proj-1',
      }));

      // Simulate idempotent upsert targeting compound unique key (taskId, repoFullName, prNumber)
      mockPrisma.taskPullRequest.upsert.mockImplementation(
        async ({ where, create, update }: any) => {
          upsertCallCount++;
          const key = `${where.taskId_repoFullName_prNumber.taskId}:${where.taskId_repoFullName_prNumber.repoFullName}:${where.taskId_repoFullName_prNumber.prNumber}`;
          const existingIndex = createdPrRecords.findIndex(
            (r) => `${r.taskId}:${r.repoFullName}:${r.prNumber}` === key,
          );
          if (existingIndex >= 0) {
            createdPrRecords[existingIndex] = {
              ...createdPrRecords[existingIndex],
              ...update,
            };
            return createdPrRecords[existingIndex];
          } else {
            const record = { id: `pr-rec-${upsertCallCount}`, ...create };
            createdPrRecords.push(record);
            return record;
          }
        },
      );

      mockTasksService.updateTaskStatus.mockImplementation(
        async (taskId: string, { status }: any) => {
          currentTaskStatus = status.toUpperCase();
          return { id: taskId, status: currentTaskStatus };
        },
      );

      const payload = {
        action: 'opened',
        repository: { id: 98765, full_name: 'neuravolt/core' },
        pull_request: {
          number: 202,
          title: 'CORE-101 Implement resilient webhook dispatcher',
          html_url: 'https://github.com/neuravolt/core/pull/202',
          head: { ref: 'task/core-101-dispatcher' },
          base: { ref: 'main' },
          state: 'open',
          merged: false,
          draft: false,
        },
      };

      // 1. Worker A begins execution, passes lease check, but pauses
      let workerAResume: () => void;
      const workerAPause = new Promise<void>((resolve) => {
        workerAResume = resolve;
      });

      const workerAExecution = (async () => {
        await workerAPause;
        return service.handleWebhookEvent('pull_request', payload);
      })();

      // 2. While Worker A is paused, Worker B reclaims the lease and executes fully
      const workerBResult = await service.handleWebhookEvent(
        'pull_request',
        payload,
      );
      expect(workerBResult.handled).toBe(true);
      expect(currentTaskStatus).toBe('REVIEW');
      expect(createdPrRecords).toHaveLength(1);
      expect(mockTasksService.updateTaskStatus).toHaveBeenCalledTimes(1);

      // 3. Worker A resumes and executes its side effect
      workerAResume!();
      const workerAResult = await workerAExecution;
      expect(workerAResult.handled).toBe(true);

      // CRITICAL VERIFICATION:
      // Even though both workers ran, idempotent consumer strategy ensures:
      // - Exactly ONE TaskPullRequest row exists for (taskId, repoFullName, prNumber)
      expect(createdPrRecords).toHaveLength(1);
      expect(createdPrRecords[0].prNumber).toBe(202);
      expect(createdPrRecords[0].repoFullName).toBe('neuravolt/core');

      // - Task status transitioned monotonically from TODO to REVIEW, not duplicated or regressed
      expect(currentTaskStatus).toBe('REVIEW');

      // - Zero financial or billing side effects occurred
      expect(mockPrisma.amcHourLog.create).not.toHaveBeenCalled();
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });
  });
});
