import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ChallengeTestSuiteService } from './challenge-test-suite.service';

// Phase 2 (Hidden Tests). Direct evidence for:
//   - "hidden tests are actually stored separately from public tests" (A)
//   - "hidden tests remain compatible with the frozen challenge blueprint/version" (E — every
//     mutation here bumps challengeVersion, which is what makes the Start-time snapshot in
//     verification-engine.service.ts pick up the change for the *next* attempt only)
describe('ChallengeTestSuiteService — Phase 2 hidden tests', () => {
  let service: ChallengeTestSuiteService;
  let prismaMock: {
    launchpadRoadmapNode: { findUnique: jest.Mock; update: jest.Mock };
    challengeTestSuite: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const liveNode = {
    id: 'node-1',
    challengeVersion: 3,
    codingChallenge: { objective: 'x', requirements: ['req-1'] },
  };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: { findUnique: jest.fn(), update: jest.fn() },
      challengeTestSuite: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          launchpadRoadmapNode: prismaMock.launchpadRoadmapNode,
          challengeTestSuite: prismaMock.challengeTestSuite,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeTestSuiteService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ChallengeTestSuiteService>(ChallengeTestSuiteService);
  });

  // A: hidden tests are read from challengeTestSuite (stage='test'), a table entirely separate
  // from LaunchpadRoadmapNode.codingChallenge (which holds the *public* challenge spec — the
  // requirements/hints/resources the student actually sees on the challenge page).
  it('A: findByNode reads only from challengeTestSuite, scoped to stage="test", never touches codingChallenge', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(liveNode);
    prismaMock.challengeTestSuite.findMany.mockResolvedValue([
      { id: 's1', nodeId: 'node-1', stage: 'test', name: 'hidden 1' },
    ]);

    const result = await service.findByNode('node-1');

    expect(prismaMock.challengeTestSuite.findMany).toHaveBeenCalledWith({
      where: { nodeId: 'node-1', stage: 'test' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([
      { id: 's1', nodeId: 'node-1', stage: 'test', name: 'hidden 1' },
    ]);
  });

  it('create writes a challengeTestSuite row pinned to stage="test" and never writes codingChallenge', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(liveNode);
    prismaMock.challengeTestSuite.create.mockResolvedValue({ id: 'new-suite' });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      challengeVersion: 4,
    });

    await service.create('node-1', {
      name: 'GET /books works',
      testCode: 'expect(...)',
    });

    const createCall = prismaMock.challengeTestSuite.create.mock.calls[0][0];
    expect(createCall.data.stage).toBe('test');
    expect(createCall.data.nodeId).toBe('node-1');
    expect(createCall.data.testCode).toBe('expect(...)');
  });

  // E: every create/update/delete bumps challengeVersion by exactly 1, unconditionally — hidden
  // test rows have no "unrelated field" to filter out, unlike Phase 1B's draftContent.
  it('E: create increments the node challengeVersion by exactly 1', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(liveNode);
    prismaMock.challengeTestSuite.create.mockResolvedValue({ id: 'new-suite' });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({});

    await service.create('node-1', { name: 'x', testCode: 'y' });

    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { challengeVersion: { increment: 1 } },
    });
  });

  it('E: update increments challengeVersion', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 's1',
      nodeId: 'node-1',
    });
    prismaMock.challengeTestSuite.update.mockResolvedValue({ id: 's1' });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({});

    await service.update('s1', { testCode: 'updated' });

    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { challengeVersion: { increment: 1 } },
    });
  });

  it('E: delete increments challengeVersion', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 's1',
      nodeId: 'node-1',
    });
    prismaMock.challengeTestSuite.delete.mockResolvedValue({});
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({});

    await service.delete('s1');

    expect(prismaMock.challengeTestSuite.delete).toHaveBeenCalledWith({
      where: { id: 's1' },
    });
    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { challengeVersion: { increment: 1 } },
    });
  });

  it('update on a missing suite throws and performs no write', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue(null);
    await expect(
      service.update('missing', { testCode: 'x' } as any),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.challengeTestSuite.update).not.toHaveBeenCalled();
    expect(prismaMock.launchpadRoadmapNode.update).not.toHaveBeenCalled();
  });

  it('create on a missing node throws and performs no write', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(null);
    await expect(
      service.create('missing-node', { name: 'x', testCode: 'y' } as any),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.challengeTestSuite.create).not.toHaveBeenCalled();
  });
});

// Launchpad Phase 5B, Slice 5B-7 — AI-generated hidden tests.
describe('ChallengeTestSuiteService — Slice 5B-7 AI-generated tests', () => {
  let service: ChallengeTestSuiteService;
  let prismaMock: any;

  const liveNode = { id: 'node-1', challengeVersion: 3 };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: {
        findUnique: jest.fn().mockResolvedValue(liveNode),
        update: jest.fn().mockResolvedValue({}),
      },
      challengeTestSuite: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          launchpadRoadmapNode: prismaMock.launchpadRoadmapNode,
          challengeTestSuite: prismaMock.challengeTestSuite,
        }),
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeTestSuiteService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<ChallengeTestSuiteService>(ChallengeTestSuiteService);
  });

  it('createFromGeneration creates a reviewStatus "pending-review" row and does NOT bump challengeVersion', async () => {
    prismaMock.challengeTestSuite.create.mockResolvedValue({
      id: 'suite-1',
      reviewStatus: 'pending-review',
    });

    await service.createFromGeneration(
      'node-1',
      { name: 'Test 1', testCode: 'expect(true).toBe(true);' },
      'job-1',
    );

    expect(prismaMock.challengeTestSuite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewStatus: 'pending-review',
        generationJobId: 'job-1',
        challengeVersion: 3,
      }),
    });
    // No node update at all — the whole point is this must not be challenge-relevant yet.
    expect(prismaMock.launchpadRoadmapNode.update).not.toHaveBeenCalled();
  });

  it('approveGenerated flips reviewStatus to "approved" AND bumps challengeVersion — the moment it becomes real', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 'suite-1',
      nodeId: 'node-1',
      reviewStatus: 'pending-review',
    });
    prismaMock.challengeTestSuite.update.mockResolvedValue({
      id: 'suite-1',
      reviewStatus: 'approved',
    });

    await service.approveGenerated('suite-1');

    expect(prismaMock.challengeTestSuite.update).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
      data: { reviewStatus: 'approved' },
    });
    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { challengeVersion: { increment: 1 } },
    });
  });

  it('approveGenerated refuses a suite that is not pending-review (e.g. already approved, or manually authored)', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 'suite-1',
      nodeId: 'node-1',
      reviewStatus: 'approved',
    });
    await expect(service.approveGenerated('suite-1')).rejects.toThrow();
    expect(prismaMock.challengeTestSuite.update).not.toHaveBeenCalled();
  });

  // Slice 5B-14 (Broken Solutions validation pipeline).
  it('approveGenerated ALSO accepts a "validated" suite (Broken Solutions validation passed) — same convergence, per the plan\'s own rollback note', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 'suite-1',
      nodeId: 'node-1',
      reviewStatus: 'validated',
    });
    prismaMock.challengeTestSuite.update.mockResolvedValue({
      id: 'suite-1',
      reviewStatus: 'approved',
    });

    await service.approveGenerated('suite-1');

    expect(prismaMock.challengeTestSuite.update).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
      data: { reviewStatus: 'approved' },
    });
  });

  it('approveGenerated still refuses a suite Stage 6b rejected', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 'suite-1',
      nodeId: 'node-1',
      reviewStatus: 'rejected',
    });
    await expect(service.approveGenerated('suite-1')).rejects.toThrow();
    expect(prismaMock.challengeTestSuite.update).not.toHaveBeenCalled();
  });

  it('rejectGenerated flips reviewStatus to "rejected" and does NOT bump challengeVersion — a rejected test is never challenge-relevant', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 'suite-1',
      nodeId: 'node-1',
      reviewStatus: 'pending-review',
    });
    prismaMock.challengeTestSuite.update.mockResolvedValue({
      id: 'suite-1',
      reviewStatus: 'rejected',
    });

    await service.rejectGenerated('suite-1');

    expect(prismaMock.challengeTestSuite.update).toHaveBeenCalledWith({
      where: { id: 'suite-1' },
      data: { reviewStatus: 'rejected' },
    });
    expect(prismaMock.launchpadRoadmapNode.update).not.toHaveBeenCalled();
  });

  it('rejectGenerated refuses a suite that is not pending-review — never silently re-rejects or rejects a live approved test', async () => {
    prismaMock.challengeTestSuite.findUnique.mockResolvedValue({
      id: 'suite-1',
      nodeId: 'node-1',
      reviewStatus: 'approved',
    });
    await expect(service.rejectGenerated('suite-1')).rejects.toThrow();
    expect(prismaMock.challengeTestSuite.update).not.toHaveBeenCalled();
  });

  it('findPendingReview scopes to reviewStatus "pending-review" only, never approved or rejected rows', async () => {
    prismaMock.challengeTestSuite.findMany.mockResolvedValue([]);
    await service.findPendingReview('node-1');
    expect(prismaMock.challengeTestSuite.findMany).toHaveBeenCalledWith({
      where: {
        nodeId: 'node-1',
        stage: 'test',
        reviewStatus: 'pending-review',
      },
      orderBy: { createdAt: 'asc' },
    });
  });
});
