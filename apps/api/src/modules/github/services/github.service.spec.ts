import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { GithubService } from './github.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    getdel: jest.fn(),
    disconnect: jest.fn(),
  }));
});
import { ProjectGithubSyncService } from './project-github-sync.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LaunchpadEventBus } from '../../launchpad/services/launchpad-event-bus';

describe('GithubService Webhook Dispatcher & Idempotency (Hardened)', () => {
  let service: GithubService;
  let mockPrisma: any;
  let mockEventBus: any;
  let mockJwtService: any;
  let mockProjectSyncService: any;

  const WEBHOOK_SECRET = 'test-secret-key-12345';

  beforeEach(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;

    mockPrisma = {
      launchpadConfig: {
        findUnique: jest.fn().mockResolvedValue({
          key: 'GITHUB_CONFIG',
          value: { webhookSecret: WEBHOOK_SECRET },
        }),
      },
      githubWebhook: {
        findUnique: jest.fn(),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'wh-default', status: 'PROCESSING' }),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      project: {
        findFirst: jest.fn(),
      },
      githubAccount: {
        findFirst: jest.fn(),
      },
      githubRepository: {
        findUnique: jest.fn(),
      },
    };

    mockEventBus = {
      emit: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn(),
    };

    mockProjectSyncService = {
      handleWebhookEvent: jest
        .fn()
        .mockResolvedValue({ handled: true, matchedTasks: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GithubService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LaunchpadEventBus, useValue: mockEventBus },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ProjectGithubSyncService, useValue: mockProjectSyncService },
      ],
    }).compile();

    service = module.get<GithubService>(GithubService);
  });

  afterAll(async () => {
    (service as any).redis?.disconnect();
  });

  const createHmacSignature = (payload: string, secret = WEBHOOK_SECRET) => {
    return `sha256=${crypto.createHmac('sha256', secret).update(Buffer.from(payload, 'utf8')).digest('hex')}`;
  };

  it('verifies HMAC signature against exact raw request body', async () => {
    const rawBody = JSON.stringify({
      action: 'opened',
      repository: { id: 12345 },
    });
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-1',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-1',
      status: 'PROCESSED',
      processed: true,
    });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'proj-1',
      key: 'TEST',
    });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-001',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('PROCESSED');
    expect(mockProjectSyncService.handleWebhookEvent).toHaveBeenCalled();
  });

  it('rejects webhooks when rawBody is missing or not provided', async () => {
    const signature = createHmacSignature('test');
    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
    };

    await expect(
      service.processWebhook(headers, { action: 'opened' }, undefined),
    ).rejects.toThrow(
      'Raw request body is required for webhook signature verification.',
    );
  });

  it('rejects webhooks with malformed signature format (not 64 hex chars)', async () => {
    const rawBody = '{"action":"opened"}';
    const headers = {
      'x-hub-signature-256': 'sha256=invalid-short-hash',
      'x-github-event': 'pull_request',
    };

    await expect(
      service.processWebhook(headers, { action: 'opened' }, rawBody),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects webhooks with invalid HMAC signatures', async () => {
    const rawBody = '{"action":"opened"}';
    const invalidSignature = createHmacSignature(rawBody, 'wrong-secret');

    const headers = {
      'x-hub-signature-256': invalidSignature,
      'x-github-event': 'pull_request',
    };

    await expect(
      service.processWebhook(headers, { action: 'opened' }, rawBody),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects webhooks missing the signature header', async () => {
    const headers = {
      'x-github-event': 'pull_request',
    };

    await expect(
      service.processWebhook(
        headers as any,
        { action: 'opened' },
        '{"action":"opened"}',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('safely handles duplicate deliveries: returns immediately when delivery is already PROCESSED', async () => {
    const rawBody = JSON.stringify({ action: 'opened' });
    const signature = createHmacSignature(rawBody);

    // Delivery already PROCESSED in DB
    mockPrisma.githubWebhook.findUnique.mockResolvedValue({
      deliveryId: 'deliv-dup-1',
      status: 'PROCESSED',
      processed: true,
    });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-dup-1',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.duplicate).toBe(true);
    expect(result.status).toBe('PROCESSED');
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
    expect(mockPrisma.githubWebhook.create).not.toHaveBeenCalled();
  });

  it('safely ignores concurrent duplicate deliveries when delivery status is active PROCESSING (< 2 min)', async () => {
    const rawBody = JSON.stringify({ action: 'opened' });
    const signature = createHmacSignature(rawBody);

    // Another worker is actively PROCESSING this delivery (started 30s ago)
    mockPrisma.githubWebhook.findUnique.mockResolvedValue({
      deliveryId: 'deliv-racing-1',
      status: 'PROCESSING',
      receivedAt: new Date(Date.now() - 30 * 1000),
    });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-racing-1',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.duplicate).toBe(true);
    expect(result.status).toBe('PROCESSING');
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('reclaims expired lease for deliveries stuck in PROCESSING (> 2 min) atomically', async () => {
    const rawBody = JSON.stringify({
      action: 'opened',
      repository: { id: 12345 },
    });
    const signature = createHmacSignature(rawBody);

    const oldDate = new Date(Date.now() - 5 * 60 * 1000);
    // Delivery stuck in PROCESSING for 5 minutes (crashed worker)
    mockPrisma.githubWebhook.findUnique
      .mockResolvedValueOnce({
        id: 'wh-stuck-1',
        deliveryId: 'deliv-stuck-1',
        status: 'PROCESSING',
        receivedAt: oldDate,
        retryCount: 0,
      })
      .mockResolvedValueOnce({
        id: 'wh-stuck-1',
        deliveryId: 'deliv-stuck-1',
        status: 'PROCESSING',
        receivedAt: new Date(),
        retryCount: 1,
      });

    mockPrisma.githubWebhook.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-stuck-1',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('PROCESSED');
    expect(mockPrisma.githubWebhook.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryId: 'deliv-stuck-1',
          status: 'PROCESSING',
        }),
        data: expect.objectContaining({
          status: 'PROCESSING',
          retryCount: { increment: 1 },
          errorMessage: null,
        }),
      }),
    );
    expect(mockProjectSyncService.handleWebhookEvent).toHaveBeenCalled();
  });

  it('concurrent worker lease safety: second worker attempting to reclaim expired lease is rejected', async () => {
    const rawBody = JSON.stringify({
      action: 'opened',
      repository: { id: 12345 },
    });
    const signature = createHmacSignature(rawBody);

    const oldDate = new Date(Date.now() - 5 * 60 * 1000);
    mockPrisma.githubWebhook.findUnique.mockResolvedValue({
      id: 'wh-stuck-1',
      deliveryId: 'deliv-stuck-1',
      status: 'PROCESSING',
      receivedAt: oldDate,
      retryCount: 0,
    });

    // Simulate atomic check-and-set failing because another worker already reclaimed it (count: 0)
    mockPrisma.githubWebhook.updateMany.mockResolvedValue({ count: 0 });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-stuck-1',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.status).toBe('PROCESSING');
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('proves stale worker cannot execute duplicate business side effects after lease was reclaimed by another worker', async () => {
    const rawBody = JSON.stringify({
      action: 'opened',
      repository: { id: 12345 },
    });
    const signature = createHmacSignature(rawBody);

    const t0 = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
    // Worker A originally claimed delivery at t0
    mockPrisma.githubWebhook.findUnique.mockResolvedValue({
      id: 'wh-stale-worker',
      deliveryId: 'deliv-concurrent-race',
      status: 'PROCESSING',
      receivedAt: t0,
    });

    // While Worker A was stalled, Worker B reclaimed the lease (updating receivedAt to t1).
    // Now Worker A attempts to proceed to execute side effects, but its lease verification fails:
    mockPrisma.githubWebhook.findFirst.mockResolvedValue(null);

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-concurrent-race',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.leaseLost).toBe(true);
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  it('deterministic Launchpad & Project concurrency race: Worker A pauses immediately after initial lease check, Worker B reclaims and processes, Worker A resumes — strictly prevents duplicate Launchpad emissions, points, and task transitions', async () => {
    const rawBody = JSON.stringify({
      action: 'closed',
      repository: { id: 88888, full_name: 'neuravolt/launchpad-repo' },
      pull_request: {
        number: 42,
        merged: true,
        html_url: 'https://github.com/neuravolt/launchpad-repo/pull/42',
      },
      installation: { id: 'inst-student-1' },
    });
    const signature = createHmacSignature(rawBody);

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-concurrent-race-window',
    };

    const t0 = new Date(Date.now() - 3 * 60 * 1000); // Worker A claims at t0
    const t1 = new Date(); // Worker B reclaims at t1

    // Setup Launchpad student routing
    mockPrisma.project.findFirst.mockResolvedValue(null);
    mockPrisma.githubAccount.findFirst.mockResolvedValue({
      id: 'acc-1',
      userId: 'student-42',
    });
    mockPrisma.githubRepository.findUnique.mockResolvedValue({
      id: 'repo-1',
      studentId: 'student-42',
    });

    let currentDeliveryState: any = {
      id: 'wh-race-delivery',
      deliveryId: 'deliv-concurrent-race-window',
      status: 'PROCESSING',
      receivedAt: t0,
    };

    mockPrisma.githubWebhook.findUnique.mockImplementation(
      async () => currentDeliveryState,
    );
    mockPrisma.githubWebhook.updateMany.mockImplementation(
      async ({ data }: any) => {
        if (data?.receivedAt) {
          currentDeliveryState = { ...currentDeliveryState, ...data };
        }
        return { count: 1 };
      },
    );

    mockPrisma.githubWebhook.findFirst.mockImplementation(
      async ({ where }: any) => {
        // Lease is only valid if receivedAt matches the active state
        if (
          where.receivedAt &&
          where.receivedAt.getTime() ===
            currentDeliveryState.receivedAt.getTime()
        ) {
          return currentDeliveryState;
        }
        return null;
      },
    );

    // 1. Worker B executes because Worker A was stalled: Worker B reclaims expired lease
    const workerBResult = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(workerBResult.success).toBe(true);
    expect(workerBResult.status).toBe('PROCESSED');
    // Worker B dispatched the Launchpad event
    expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'PullRequestMerged',
      'student-42',
      'https://github.com/neuravolt/launchpad-repo/pull/42',
    );

    // 2. Now Worker A resumes!
    // Worker A's in-memory record has receivedAt: t0, while database is now at t1 and status is PROCESSED.
    // When Worker A calls verifyLeaseActive with t0, the DB returns null.
    mockPrisma.githubWebhook.findFirst.mockResolvedValue(null);

    const workerAResult = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    // CRITICAL VERIFICATION:
    // Stale Worker A aborts without executing business side effects
    expect(workerAResult.success).toBe(true);
    expect(workerAResult.duplicate).toBe(true);

    // Event was NOT emitted a second time!
    expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('supports retry on FAILED deliveries: increments retryCount and resets status to PROCESSING', async () => {
    const rawBody = JSON.stringify({
      action: 'opened',
      repository: { id: 12345 },
    });
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.findUnique
      .mockResolvedValueOnce({
        id: 'wh-fail-1',
        deliveryId: 'deliv-retry-1',
        status: 'FAILED',
        retryCount: 1,
      })
      .mockResolvedValueOnce({
        id: 'wh-fail-1',
        deliveryId: 'deliv-retry-1',
        status: 'PROCESSING',
        retryCount: 2,
      });

    mockPrisma.githubWebhook.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-retry-1',
    };

    const result = await service.processWebhook(
      headers,
      JSON.parse(rawBody),
      rawBody,
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('PROCESSED');
    expect(mockPrisma.githubWebhook.updateMany).toHaveBeenCalledWith({
      where: {
        deliveryId: 'deliv-retry-1',
        status: 'FAILED',
      },
      data: expect.objectContaining({
        status: 'PROCESSING',
        retryCount: { increment: 1 },
        errorMessage: null,
      }),
    });
  });

  it('deterministic routing: routes Project repo to ProjectGithubSyncService without Launchpad event', async () => {
    const payload = {
      action: 'opened',
      repository: { id: 998877, full_name: 'neuravolt/core' },
      installation: { id: 1234 },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-p1',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-p1',
      status: 'PROCESSED',
    });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'proj-core',
      key: 'CORE',
    });
    mockPrisma.githubAccount.findFirst.mockResolvedValue(null);
    mockPrisma.githubRepository.findUnique.mockResolvedValue(null);

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-proj-1',
    };

    const result = await service.processWebhook(headers, payload, rawBody);

    expect(result.success).toBe(true);
    expect(mockProjectSyncService.handleWebhookEvent).toHaveBeenCalledWith(
      'pull_request',
      payload,
    );
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  it('deterministic routing: routes Launchpad student repo to LaunchpadEventBus without Project sync', async () => {
    const payload = {
      action: 'closed',
      repository: { id: 554433, full_name: 'student/repo' },
      installation: { id: 777888 },
      pull_request: {
        merged: true,
        html_url: 'https://github.com/student/repo/pull/5',
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-launch-1',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-launch-1',
      status: 'PROCESSED',
    });
    mockPrisma.project.findFirst.mockResolvedValue(null); // Not a project repo
    mockPrisma.githubAccount.findFirst.mockResolvedValue({
      id: 'acc-1',
      userId: 'student-uuid-99',
    });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-launch-1',
    };

    const result = await service.processWebhook(headers, payload, rawBody);

    expect(result.success).toBe(true);
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'PullRequestMerged',
      'student-uuid-99',
      'https://github.com/student/repo/pull/5',
    );
  });

  it('deterministic routing: marks unknown repository as unrouted without side effects', async () => {
    const payload = {
      action: 'opened',
      repository: { id: 111222, full_name: 'unknown/repo' },
      installation: { id: 9999 },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-unk-1',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-unk-1',
      status: 'PROCESSED',
    });
    mockPrisma.project.findFirst.mockResolvedValue(null);
    mockPrisma.githubAccount.findFirst.mockResolvedValue(null);
    mockPrisma.githubRepository.findUnique.mockResolvedValue(null);

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-unk-1',
    };

    const result = await service.processWebhook(headers, payload, rawBody);

    expect(result.success).toBe(true);
    expect(result.unrouted).toBe(true);
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  it('strict cross-module isolation: Project repo PR merge NEVER triggers LaunchpadEventBus even if installation matches student account', async () => {
    const payload = {
      action: 'closed',
      repository: { id: 778899, full_name: 'neuravolt/internal-enterprise' },
      installation: { id: 5555 },
      pull_request: {
        merged: true,
        html_url: 'https://github.com/neuravolt/internal-enterprise/pull/12',
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-sec-1',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-sec-1',
      status: 'PROCESSED',
    });
    // Both Project and Student match in DB (potential collision)
    mockPrisma.project.findFirst.mockResolvedValue({
      id: 'proj-ent',
      key: 'ENT',
    });
    mockPrisma.githubAccount.findFirst.mockResolvedValue({
      id: 'acc-student',
      userId: 'student-victim',
    });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-sec-collision-1',
    };

    const result = await service.processWebhook(headers, payload, rawBody);

    expect(result.success).toBe(true);
    // MUST dispatch to Project workflow
    expect(mockProjectSyncService.handleWebhookEvent).toHaveBeenCalledWith(
      'pull_request',
      payload,
    );
    // MUST NOT emit Launchpad event or touch student assessment
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });

  it('strict cross-module isolation: Launchpad student event NEVER updates Project tasks or triggers Project sync', async () => {
    const payload = {
      action: 'closed',
      repository: { id: 334455, full_name: 'student-alice/assignment-1' },
      installation: { id: 8888 },
      pull_request: {
        merged: true,
        html_url: 'https://github.com/student-alice/assignment-1/pull/1',
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-sec-2',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-sec-2',
      status: 'PROCESSED',
    });
    mockPrisma.project.findFirst.mockResolvedValue(null);
    mockPrisma.githubAccount.findFirst.mockResolvedValue({
      id: 'acc-alice',
      userId: 'student-alice',
    });

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-sec-student-1',
    };

    const result = await service.processWebhook(headers, payload, rawBody);

    expect(result.success).toBe(true);
    // MUST NOT call Project sync
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
    // MUST call Launchpad event bus
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'PullRequestMerged',
      'student-alice',
      'https://github.com/student-alice/assignment-1/pull/1',
    );
  });

  it('trusted identifier enforcement: spoofed project full_name does not hijack a student repo', async () => {
    const payload = {
      action: 'closed',
      repository: { id: 999111, full_name: 'neuravolt/company-secret' },
      installation: { id: 7777 },
      pull_request: {
        merged: true,
        html_url: 'https://github.com/neuravolt/company-secret/pull/3',
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = createHmacSignature(rawBody);

    mockPrisma.githubWebhook.create.mockResolvedValue({
      id: 'wh-sec-3',
      status: 'PROCESSING',
    });
    mockPrisma.githubWebhook.update.mockResolvedValue({
      id: 'wh-sec-3',
      status: 'PROCESSED',
    });
    // Numeric ID 999111 is NOT a Project repo
    mockPrisma.project.findFirst.mockResolvedValue(null);
    // But numeric ID 999111 IS registered as a Launchpad student repository
    mockPrisma.githubRepository.findUnique.mockResolvedValue({
      id: 'repo-st-1',
      studentId: 'student-spoofed',
    });
    mockPrisma.githubAccount.findFirst.mockResolvedValue(null);

    const headers = {
      'x-hub-signature-256': signature,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'deliv-sec-spoof-1',
    };

    const result = await service.processWebhook(headers, payload, rawBody);

    expect(result.success).toBe(true);
    // Project sync must NOT be called even though full_name matched a project-like string
    expect(mockProjectSyncService.handleWebhookEvent).not.toHaveBeenCalled();
    // Routed to Launchpad via trusted repository ID
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'PullRequestMerged',
      'student-spoofed',
      'https://github.com/neuravolt/company-secret/pull/3',
    );
  });

  describe('Merge Policy & Branch Protection Enforcement', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      jest
        .spyOn(service, 'getInstallationAccessToken')
        .mockResolvedValue('test-access-token');
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('allows merge for repositories without configured branch protection / CI (clean state)', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: { sha: 'sha-clean-123' },
        base: { ref: 'main' },
        title: 'feat: unblocked feature',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({ ok: false, status: 404 } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        10,
      );

      expect(result.canMerge).toBe(true);
      expect(result.mergeable).toBe(true);
      expect(result.mergeableState).toBe('clean');
    });

    it('allows merge for unprotected repository even when behind base branch (no strict requirement)', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'behind',
        head: { sha: 'sha-behind-unprotected' },
        base: { ref: 'main' },
        title: 'feat: behind but unprotected',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({ ok: false, status: 404 } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        11,
      );

      expect(result.canMerge).toBe(true);
      expect(result.mergeableState).toBe('behind');
    });

    it('rejects merge when branch protection specifies strict=true and PR is behind base branch', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'behind',
        head: { sha: 'sha-behind-protected' },
        base: { ref: 'main' },
        title: 'feat: strict behind branch',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                required_status_checks: { strict: true, contexts: ['ci/test'] },
              }),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        12,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain(
        'required status checks policy specifies it must be up to date',
      );
    });

    it('allows merge when an OPTIONAL check fails, as long as all REQUIRED checks succeed', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'unstable',
        head: { sha: 'sha-opt-fail' },
        base: { ref: 'main' },
        title: 'feat: optional check failing',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                required_status_checks: {
                  strict: false,
                  contexts: ['build-and-test'],
                },
              }),
          } as any);
        }
        if (url.includes('/check-runs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                check_runs: [
                  { name: 'build-and-test', conclusion: 'success' }, // Required check passed
                  { name: 'optional-spellcheck', conclusion: 'failure' }, // Optional check failed
                ],
              }),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        13,
      );

      expect(result.canMerge).toBe(true);
      expect(result.mergeableState).toBe('unstable');
    });

    it('blocks merge when a REQUIRED CI check fails', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'blocked',
        head: { sha: 'sha-req-fail' },
        base: { ref: 'main' },
        title: 'feat: required check failing',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                required_status_checks: {
                  strict: false,
                  contexts: ['build-and-test'],
                },
              }),
          } as any);
        }
        if (url.includes('/check-runs')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                check_runs: [{ name: 'build-and-test', conclusion: 'failure' }],
              }),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        14,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain(
        'Required CI check(s) failed: build-and-test',
      );
    });

    it('enforces required approving review count when branch protection requires 2 approvals', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'blocked',
        head: { sha: 'sha-reviews' },
        base: { ref: 'main' },
        title: 'feat: two approvals needed',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                required_pull_request_reviews: {
                  required_approving_review_count: 2,
                },
              }),
          } as any);
        }
        if (url.includes('/reviews')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { user: { login: 'reviewer-alice' }, state: 'APPROVED' }, // Only 1 approval so far
              ]),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        15,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain(
        'Requires at least 2 approving review(s) before merging (currently 1)',
      );
    });

    it('allows merge when all 2 required review approvals are satisfied', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: { sha: 'sha-reviews-met' },
        base: { ref: 'main' },
        title: 'feat: two approvals met',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                required_pull_request_reviews: {
                  required_approving_review_count: 2,
                },
              }),
          } as any);
        }
        if (url.includes('/reviews')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { user: { login: 'reviewer-alice' }, state: 'APPROVED' },
                { user: { login: 'reviewer-bob' }, state: 'APPROVED' },
              ]),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        16,
      );

      expect(result.canMerge).toBe(true);
      expect(result.mergeableState).toBe('clean');
    });

    it('rejects merge when active CHANGES_REQUESTED is present', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'blocked',
        head: { sha: 'sha-cr-present' },
        base: { ref: 'main' },
        title: 'feat: changes requested',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                required_pull_request_reviews: {
                  required_approving_review_count: 1,
                },
              }),
          } as any);
        }
        if (url.includes('/reviews')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  user: { login: 'reviewer-alice' },
                  state: 'CHANGES_REQUESTED',
                },
              ]),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        17,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toBe('Changes have been requested by a reviewer.');
    });

    it('rejects merge when PR is a draft', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: true,
        mergeable: true,
        mergeable_state: 'draft',
        head: { sha: 'sha-draft-123' },
        base: { ref: 'main' },
        title: 'draft: work in progress',
      } as any);

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        18,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain('draft');
    });

    it('rejects merge when PR has conflicts with the target branch', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: false,
        mergeable_state: 'dirty',
        head: { sha: 'sha-dirty-123' },
        base: { ref: 'main' },
        title: 'feat: conflicting changes',
      } as any);

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        19,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain('merge conflicts');
    });

    it('safely rejects merge when GitHub is asynchronously calculating mergeability', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: null,
        mergeable_state: 'unknown',
        head: { sha: 'sha-calc-123' },
        base: { ref: 'main' },
        title: 'feat: new pr calculating',
      } as any);

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        20,
      );

      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain('calculating mergeability');
    });

    it('distinguishes 403 (insufficient permissions) on branch protection and falls back to authoritative GitHub mergeable_state', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'blocked',
        head: { sha: 'sha-403-test' },
        base: { ref: 'main' },
        title: 'feat: policy 403 test',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () =>
              Promise.resolve({
                message: 'Must have admin rights to Repository',
              }),
          } as any);
        }
        if (url.includes('/reviews')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        21,
      );

      // Branch protection 403 does NOT assume branch is unprotected;
      // it falls back to GitHub's authoritative mergeable_state: 'blocked'
      expect(result.canMerge).toBe(false);
      expect(result.reason).toContain(
        'Blocked by repository branch protection rules or rulesets',
      );
    });

    it('distinguishes 404 "Branch not protected" from generic 404 errors', async () => {
      jest.spyOn(service, 'getPullRequestDetails').mockResolvedValue({
        state: 'open',
        merged: false,
        draft: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: { sha: 'sha-unprotected' },
        base: { ref: 'feature-branch' },
        title: 'feat: clean merge into unprotected feature branch',
      } as any);

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/protection')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ message: 'Branch not protected' }),
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);
      });

      const result = await service.checkPullRequestMergeability(
        'inst-1',
        'org',
        'repo',
        22,
      );

      // Explicit "Branch not protected" allows clean merge
      expect(result.canMerge).toBe(true);
      expect(result.mergeableState).toBe('clean');
    });
  });

  describe('Collaborator Access Management API Methods', () => {
    beforeEach(() => {
      jest
        .spyOn(service as any, 'getInstallationAccessToken')
        .mockResolvedValue('mock-app-token');
    });

    it('searches users via GitHub search API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 99,
                login: 'dev-alice',
                avatar_url: 'https://avatar/alice',
                html_url: 'https://github.com/dev-alice',
              },
            ],
          }),
      } as any);

      const users = await service.searchUsers('inst-1', 'alice');

      expect(users).toHaveLength(1);
      expect(users[0].login).toBe('dev-alice');
      expect(users[0].avatar_url).toBe('https://avatar/alice');
    });

    it('lists collaborators with roles and permissions', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 101,
              login: 'dev-bob',
              role_name: 'write',
              permissions: { admin: false, push: true, pull: true },
              avatar_url: 'https://avatar/bob',
            },
          ]),
      } as any);

      const collabs = await service.listCollaborators(
        'inst-1',
        'neuravolt',
        'core',
      );

      expect(collabs).toHaveLength(1);
      expect(collabs[0].login).toBe('dev-bob');
      expect(collabs[0].role_name).toBe('write');
      expect(collabs[0].permissions.push).toBe(true);
    });

    it('invites a collaborator defaulting to push and returns invitation details', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 501,
            invitee: { login: 'dev-charlie' },
            permissions: 'push',
          }),
      } as any);

      const result = await service.inviteCollaborator(
        'inst-1',
        'neuravolt',
        'core',
        'dev-charlie',
        'push',
      );

      expect(result.invitee.login).toBe('dev-charlie');
      expect(result.permissions).toBe('push');
      expect(result.status).toBe('INVITATION_SENT');
    });

    it('surfaces actionable error when GitHub App lacks administration:write permissions (HTTP 403)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            message: 'Resource not accessible by integration',
          }),
      } as any);

      await expect(
        service.inviteCollaborator(
          'inst-1',
          'neuravolt',
          'core',
          'dev-dan',
          'push',
        ),
      ).rejects.toThrow('Administration: Read & write');
    });

    it('cancels pending invitation via GitHub API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as any);

      const result = await service.cancelInvitation(
        'inst-1',
        'neuravolt',
        'core',
        501,
      );
      expect(result.success).toBe(true);
    });

    it('removes collaborator via GitHub API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve({}),
      } as any);

      const result = await service.removeCollaborator(
        'inst-1',
        'neuravolt',
        'core',
        'dev-bob',
      );
      expect(result.success).toBe(true);
    });
  });
});
