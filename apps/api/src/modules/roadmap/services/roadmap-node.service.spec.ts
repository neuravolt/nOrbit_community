import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RoadmapNodeService } from './roadmap-node.service';
import { ContentVersionService } from './content-version.service';
import { StaleMarkerService } from './stale-marker.service';
import { ContentAuditLogService } from '../../../common/audit/content-audit-log.service';

// Phase 1B (Node Versioning & Content Freezing) — scenarios A-J from the approved roadmap.
describe('RoadmapNodeService — Phase 1B draft/publish', () => {
  let service: RoadmapNodeService;

  const baseLiveNode = {
    id: 'node-1',
    title: 'Live Title',
    slug: 'live-title',
    description: 'Live description',
    learningObjectives: ['obj-1'],
    videos: [],
    officialDocs: [],
    notes: 'live notes',
    cheatsheet: 'live cheatsheet',
    codeExamples: [],
    quizQuestions: [],
    aiInterviewQuestions: [],
    codingChallenge: { objective: 'live objective', requirements: ['req-1'] },
    miniProject: {},
    validationRules: {},
    xpReward: 100,
    coinsReward: 50,
    skillMapping: {},
    careerDnaImpact: {},
    estimatedDurationMinutes: 60,
    difficulty: 'beginner',
    prerequisites: [],
    nodeNumber: 1,
    status: 'published',
    version: 1,
    challengeVersion: 1,
    draftContent: null as any,
    publishedAt: new Date('2026-01-01'),
  };

  let prismaMock: {
    launchpadRoadmapNode: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    challengeEvaluationReport: {
      update: jest.Mock;
      findMany: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
    };
    launchpadContentVersion: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    launchpadStaleMarker: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    launchpadChallengeVerificationContract: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      challengeEvaluationReport: {
        update: jest.fn(),
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      launchpadContentVersion: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      launchpadStaleMarker: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      launchpadChallengeVerificationContract: {
        // Default: no approved contract exists for the node — most tests aren't about the
        // contract-staleness path, so this must default to "nothing to invalidate" rather than
        // silently making every existing publish/restore test assert a marker was created.
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          launchpadRoadmapNode: prismaMock.launchpadRoadmapNode,
          challengeEvaluationReport: prismaMock.challengeEvaluationReport,
          auditLog: prismaMock.auditLog,
          launchpadContentVersion: prismaMock.launchpadContentVersion,
          launchpadStaleMarker: prismaMock.launchpadStaleMarker,
          launchpadChallengeVerificationContract:
            prismaMock.launchpadChallengeVerificationContract,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapNodeService,
        ContentVersionService,
        StaleMarkerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoadmapNodeService>(RoadmapNodeService);
  });

  // A. Saving a draft must not change the live node's own fields.
  it('A: saveDraft only writes draftContent — no other column is included in the update payload', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...baseLiveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...baseLiveNode,
      draftContent: {},
    });

    await service.saveDraft('node-1', { notes: 'edited notes' });

    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledTimes(1);
    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(Object.keys(call.data)).toEqual(['draftContent']);
    expect(call.data.draftContent.notes).toBe('edited notes');
    // live-only fields must never appear inside the draft payload itself being asserted here as untouched columns
    expect(call.data.status).toBeUndefined();
    expect(call.data.version).toBeUndefined();
  });

  // B. A second saveDraft call must merge onto the previously saved draft (i.e. it "survives" — the
  // next read/edit sees prior draft edits plus the new one), not just carry the newest field alone.
  it('B: draft content merges across successive saveDraft calls (survives being re-opened)', async () => {
    const nodeWithExistingDraft = {
      ...baseLiveNode,
      draftContent: { notes: 'first edit', title: 'Draft Title' },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(
      nodeWithExistingDraft,
    );
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(
      nodeWithExistingDraft,
    );

    await service.saveDraft('node-1', { cheatsheet: 'second edit' });

    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(call.data.draftContent.notes).toBe('first edit');
    expect(call.data.draftContent.title).toBe('Draft Title');
    expect(call.data.draftContent.cheatsheet).toBe('second edit');
  });

  // C. Draft content must never be reachable from the student-facing side. RoadmapNodeService
  // itself has no student-facing read path (that lives in RoadmapService), so this asserts the
  // negative at this layer: saveDraft's own return projection never includes live content mixed
  // with draft in a way a student endpoint could accidentally expose, and the service exposes no
  // method that returns draftContent to anything other than the admin select below.
  it('C: saveDraft response select only projects admin-relevant fields, never a merged/public view', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...baseLiveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({});

    await service.saveDraft('node-1', { notes: 'x' });

    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(call.select).toEqual({
      id: true,
      draftContent: true,
      version: true,
      challengeVersion: true,
      status: true,
      updatedAt: true,
    });
  });

  // D. Publishing must copy draft fields onto the live row atomically (single transactional update).
  it('D: publishDraft applies the draft to live content inside a single transaction', async () => {
    const nodeWithDraft = {
      ...baseLiveNode,
      draftContent: { notes: 'published-from-draft notes' },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...nodeWithDraft,
      notes: 'published-from-draft notes',
    });

    await service.publishDraft('node-1');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledTimes(1);
    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(call.data.notes).toBe('published-from-draft notes');
    expect(call.data.draftContent).toEqual(Prisma.JsonNull);
    expect(call.data.status).toBe('published');
  });

  // E. Publishing always increments version, regardless of what changed.
  it('E: publishDraft always increments version by 1', async () => {
    const nodeWithDraft = {
      ...baseLiveNode,
      version: 4,
      draftContent: { notes: 'v bump only' },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(call.data.version).toBe(5);
  });

  // F. A challenge-relevant field change (codingChallenge) must bump challengeVersion.
  it('F: publishDraft increments challengeVersion when codingChallenge changed', async () => {
    const nodeWithDraft = {
      ...baseLiveNode,
      challengeVersion: 2,
      draftContent: {
        codingChallenge: {
          objective: 'NEW objective',
          requirements: ['req-2'],
        },
      },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(call.data.challengeVersion).toBe(3);
  });

  // G. A non-challenge content change (notes only) must NOT bump challengeVersion.
  it('G: publishDraft leaves challengeVersion unchanged when only non-challenge content changed', async () => {
    const nodeWithDraft = {
      ...baseLiveNode,
      challengeVersion: 2,
      draftContent: { notes: 'just notes, no challenge change' },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    const call = prismaMock.launchpadRoadmapNode.update.mock.calls[0][0];
    expect(call.data.challengeVersion).toBe(2);
  });

  // H. A failed publish (no pending draft) must leave live content and draft both untouched —
  // i.e. no write of any kind is attempted.
  it('H: publishDraft with no pending draft throws and performs no write', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...baseLiveNode,
      draftContent: null,
    });

    await expect(service.publishDraft('node-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.launchpadRoadmapNode.update).not.toHaveBeenCalled();
  });

  it('H (not found): publishDraft on a missing node throws and performs no write', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(null);

    await expect(service.publishDraft('missing-node')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.launchpadRoadmapNode.update).not.toHaveBeenCalled();
  });

  // I. Blueprint freezing / in-flight challenge reports are never touched by publishDraft — it
  // only ever writes to launchpadRoadmapNode, never to challengeEvaluationReport, so an
  // already-frozen ChallengeEvaluationReport.challengeBlueprint stays pinned to whatever
  // challengeVersion it captured at Start time.
  it('I: publishDraft never reads or writes ChallengeEvaluationReport (existing frozen blueprints stay pinned)', async () => {
    const nodeWithDraft = {
      ...baseLiveNode,
      draftContent: {
        codingChallenge: { objective: 'changed', requirements: [] },
      },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    expect(prismaMock.challengeEvaluationReport.update).not.toHaveBeenCalled();
    expect(
      prismaMock.challengeEvaluationReport.findMany,
    ).not.toHaveBeenCalled();
  });

  // J. With no draft ever saved, the plain update() path (pre-existing, pre-Phase-1B behavior)
  // must continue to work exactly as before — draft/publish additions are additive only.
  it('J: the pre-existing update() method is unaffected by the draft/publish additions', async () => {
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...baseLiveNode,
      title: 'Direct edit',
    });

    await service.update('node-1', { title: 'Direct edit' });

    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { title: 'Direct edit' },
    });
  });
});

// GAP-1 fix (post-5B-15 audit): §3's second stale-dependency trigger row — a challenge spec
// change, or the core content it's grounded in changing, must mark an already-approved
// verification contract stale. Left unwired when 5B-12 first shipped because
// LaunchpadChallengeVerificationContract didn't exist yet; now it does (5B-15), so this closes
// the gap flagged in the post-implementation audit.
describe('RoadmapNodeService — GAP-1: verification contract stale marking', () => {
  let service: RoadmapNodeService;

  const baseLiveNode = {
    id: 'node-1',
    notes: 'live notes',
    cheatsheet: 'live cheatsheet',
    learningObjectives: ['obj-1'],
    codeExamples: [],
    officialDocs: [],
    videos: [],
    quizQuestions: [{ question: 'q1' }],
    codingChallenge: { objective: 'live objective', requirements: ['req-1'] },
    evaluationConfig: {},
    version: 1,
    challengeVersion: 1,
    draftContent: null as any,
  };

  let prismaMock: {
    launchpadRoadmapNode: { findUnique: jest.Mock; update: jest.Mock };
    launchpadContentVersion: { create: jest.Mock; findFirst: jest.Mock };
    launchpadStaleMarker: { findFirst: jest.Mock; create: jest.Mock };
    launchpadChallengeVerificationContract: { findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: { findUnique: jest.fn(), update: jest.fn() },
      launchpadContentVersion: {
        create: jest.fn().mockResolvedValue({ id: 'cv-1', versionNumber: 2 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      launchpadStaleMarker: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      launchpadChallengeVerificationContract: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          launchpadRoadmapNode: prismaMock.launchpadRoadmapNode,
          launchpadContentVersion: prismaMock.launchpadContentVersion,
          launchpadStaleMarker: prismaMock.launchpadStaleMarker,
          launchpadChallengeVerificationContract:
            prismaMock.launchpadChallengeVerificationContract,
          auditLog: prismaMock.auditLog,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapNodeService,
        ContentVersionService,
        StaleMarkerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoadmapNodeService>(RoadmapNodeService);
  });

  afterEach(() => {
    // The last test in this block spies on ContentVersionService.prototype.getVersion — restore
    // it here so that spy doesn't leak into later describe blocks in this file (which rely on
    // the real implementation reading from their own prismaMock).
    jest.restoreAllMocks();
  });

  it('publishDraft marks the verification contract stale when codingChallenge changes and an approved contract exists', async () => {
    prismaMock.launchpadChallengeVerificationContract.findFirst.mockResolvedValue(
      { id: 'contract-1', approvalStatus: 'approved' },
    );
    const nodeWithDraft = {
      ...baseLiveNode,
      draftContent: {
        codingChallenge: {
          objective: 'NEW objective',
          requirements: ['req-2'],
        },
      },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    expect(
      prismaMock.launchpadChallengeVerificationContract.findFirst,
    ).toHaveBeenCalledWith({
      where: { nodeId: 'node-1', approvalStatus: 'approved' },
    });
    expect(prismaMock.launchpadStaleMarker.create).toHaveBeenCalledWith({
      data: {
        entityType: 'verification_contract',
        entityId: 'node-1',
        triggeredByVersionId: 'cv-1',
      },
    });
  });

  it('publishDraft does NOT mark the contract stale when no approved contract exists', async () => {
    prismaMock.launchpadChallengeVerificationContract.findFirst.mockResolvedValue(
      null,
    );
    const nodeWithDraft = {
      ...baseLiveNode,
      draftContent: {
        codingChallenge: {
          objective: 'NEW objective',
          requirements: ['req-2'],
        },
      },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    const contractMarkerCalls =
      prismaMock.launchpadStaleMarker.create.mock.calls.filter(
        (c: any) => c[0].data.entityType === 'verification_contract',
      );
    expect(contractMarkerCalls).toHaveLength(0);
  });

  it('publishDraft marks the contract stale on a core-content-only change too (notes), not just a challenge change', async () => {
    prismaMock.launchpadChallengeVerificationContract.findFirst.mockResolvedValue(
      { id: 'contract-1', approvalStatus: 'approved' },
    );
    const nodeWithDraft = {
      ...baseLiveNode,
      draftContent: { notes: 'updated notes, no challenge change' },
    };
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(nodeWithDraft);
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(nodeWithDraft);

    await service.publishDraft('node-1');

    expect(prismaMock.launchpadStaleMarker.create).toHaveBeenCalledWith({
      data: {
        entityType: 'verification_contract',
        entityId: 'node-1',
        triggeredByVersionId: 'cv-1',
      },
    });
    // the pre-existing quiz/challenge markers still fire too — this is additive, not a replacement
    const entityTypesMarked =
      prismaMock.launchpadStaleMarker.create.mock.calls.map(
        (c: any) => c[0].data.entityType,
      );
    expect(entityTypesMarked.sort()).toEqual([
      'challenge',
      'quiz',
      'verification_contract',
    ]);
  });

  it('restoreVersion marks the contract stale when the restored content changes the challenge, and an approved contract exists', async () => {
    prismaMock.launchpadChallengeVerificationContract.findFirst.mockResolvedValue(
      { id: 'contract-1', approvalStatus: 'approved' },
    );
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...baseLiveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue(baseLiveNode);
    jest
      .spyOn(ContentVersionService.prototype, 'getVersion')
      .mockResolvedValue({
        id: 'v-old',
        versionNumber: 1,
        content: {
          codingChallenge: {
            objective: 'restored objective',
            requirements: ['restored-req'],
          },
        },
      } as any);

    await service.restoreVersion('node-1', 'v-old', 'admin-1');

    expect(prismaMock.launchpadStaleMarker.create).toHaveBeenCalledWith({
      data: {
        entityType: 'verification_contract',
        entityId: 'node-1',
        triggeredByVersionId: 'cv-1',
      },
    });
  });
});

// Launchpad Final Master Plan, Slice 6 — publish/unpublish/publishDraft must write a durable
// AuditLog row when called with an actorId (the real, only caller: RoadmapNodeController), and
// must NOT write one when actorId is omitted (every other pre-existing caller/test above calls
// these methods with no second argument — this proves that path is unchanged, not just untested).
describe('RoadmapNodeService — Slice 6 audit trail', () => {
  let service: RoadmapNodeService;
  let prismaMock: {
    launchpadRoadmapNode: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    launchpadContentVersion: { create: jest.Mock; findFirst: jest.Mock };
    launchpadStaleMarker: { findFirst: jest.Mock; create: jest.Mock };
    launchpadChallengeVerificationContract: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const liveNode = {
    id: 'node-1',
    status: 'draft',
    version: 3,
    challengeVersion: 1,
    draftContent: {
      codingChallenge: { objective: 'new objective', requirements: ['x'] },
    },
    codingChallenge: { objective: 'old objective', requirements: [] },
  };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      launchpadContentVersion: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      launchpadStaleMarker: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      launchpadChallengeVerificationContract: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          launchpadRoadmapNode: prismaMock.launchpadRoadmapNode,
          auditLog: prismaMock.auditLog,
          launchpadContentVersion: prismaMock.launchpadContentVersion,
          launchpadStaleMarker: prismaMock.launchpadStaleMarker,
          launchpadChallengeVerificationContract:
            prismaMock.launchpadChallengeVerificationContract,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapNodeService,
        ContentVersionService,
        StaleMarkerService,
        ContentAuditLogService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoadmapNodeService>(RoadmapNodeService);
  });

  it('publish(id, actorId) writes a ROADMAP_NODE_PUBLISHED audit row with the correct actor and resource', async () => {
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      status: 'published',
    });

    await service.publish('node-1', 'admin-1');

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'ROADMAP_NODE_PUBLISHED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
      }),
    });
  });

  it('publish(id) with no actorId writes no audit row', async () => {
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      status: 'published',
    });

    await service.publish('node-1');

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('unpublish(id, actorId) writes a ROADMAP_NODE_UNPUBLISHED audit row with the correct actor and resource', async () => {
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      status: 'draft',
    });

    await service.unpublish('node-1', 'admin-2');

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-2',
        action: 'ROADMAP_NODE_UNPUBLISHED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
      }),
    });
  });

  it('unpublish(id) with no actorId writes no audit row', async () => {
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      status: 'draft',
    });

    await service.unpublish('node-1');

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('publishDraft(id, actorId) writes a ROADMAP_NODE_DRAFT_PUBLISHED audit row with node-version before/after and challengeVersion metadata', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...liveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      codingChallenge: liveNode.draftContent.codingChallenge,
      draftContent: null,
      version: 4,
      challengeVersion: 2,
      status: 'published',
    });

    await service.publishDraft('node-1', 'admin-3');

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-3',
        action: 'ROADMAP_NODE_DRAFT_PUBLISHED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
        // Slice 5B-16: version before/after moved out of free-form metadata onto their own
        // structured columns; source is HUMAN because a real actorId triggered this.
        oldVersion: 3,
        newVersion: 4,
        source: 'HUMAN',
        metadata: expect.objectContaining({
          challengeVersionBefore: 1,
          challengeVersionAfter: 2,
          challengeRelevantChange: true,
        }),
      }),
    });
  });

  // Slice 5B-16: previously a policy-driven publish (no actorId) left NO audit row at all — a
  // real gap against §14's "every publish action produces exactly one queryable AuditLog row."
  // publishDraft now always writes one, distinguishing HUMAN (real actorId) from POLICY (none)
  // via the `source` column rather than by silently skipping the write.
  it('publishDraft(id) with no actorId writes a POLICY-sourced audit row, not a HUMAN one', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...liveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      codingChallenge: liveNode.draftContent.codingChallenge,
      draftContent: null,
      version: 4,
      challengeVersion: 2,
      status: 'published',
    });

    await service.publishDraft('node-1');

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: 'ROADMAP_NODE_DRAFT_PUBLISHED',
        source: 'POLICY',
        oldVersion: 3,
        newVersion: 4,
      }),
    });
  });

  it('publishDraft(id, actorId) throwing (no pending draft) writes no audit row — the transaction never reaches the audit write', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...liveNode,
      draftContent: null,
    });

    await expect(service.publishDraft('node-1', 'admin-4')).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});

// Launchpad Final Master Plan, Slice 7 — optimistic concurrency on update(). Two admins editing
// the same node concurrently must not silently overwrite each other: the second save (whichever
// arrives second) must be told its expectedVersion is stale instead of clobbering the first.
describe('RoadmapNodeService — Slice 7 optimistic concurrency', () => {
  let service: RoadmapNodeService;
  let prismaMock: {
    launchpadRoadmapNode: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapNodeService,
        ContentVersionService,
        StaleMarkerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoadmapNodeService>(RoadmapNodeService);
  });

  it('update() with no expectedVersion keeps the old unconditional-overwrite behavior (backward compatible)', async () => {
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      id: 'node-1',
      title: 'Direct edit',
    });

    await service.update('node-1', { title: 'Direct edit' });

    expect(prismaMock.launchpadRoadmapNode.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.launchpadRoadmapNode.update).toHaveBeenCalledWith({
      where: { id: 'node-1' },
      data: { title: 'Direct edit' },
    });
  });

  it('update() with a matching expectedVersion applies the edit atomically and bumps version', async () => {
    prismaMock.launchpadRoadmapNode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      id: 'node-1',
      title: 'Edited',
      version: 4,
    });

    const result = await service.update('node-1', {
      title: 'Edited',
      expectedVersion: 3,
    });

    expect(prismaMock.launchpadRoadmapNode.updateMany).toHaveBeenCalledWith({
      where: { id: 'node-1', version: 3 },
      data: { title: 'Edited', version: { increment: 1 } },
    });
    // expectedVersion itself must never leak into the write payload
    expect(
      prismaMock.launchpadRoadmapNode.updateMany.mock.calls[0][0].data
        .expectedVersion,
    ).toBeUndefined();
    expect(result).toEqual({ id: 'node-1', title: 'Edited', version: 4 });
  });

  it('update() with a stale expectedVersion throws ConflictException (409) and performs no write', async () => {
    prismaMock.launchpadRoadmapNode.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      id: 'node-1',
      version: 5,
    });

    await expect(
      service.update('node-1', {
        title: 'Stale edit',
        expectedVersion: 3,
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('update() on a node that no longer exists throws NotFoundException, not ConflictException', async () => {
    prismaMock.launchpadRoadmapNode.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing-node', { title: 'x', expectedVersion: 1 } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('two concurrent saves at the same expectedVersion: the second conflicts after the first succeeds', async () => {
    // First save succeeds (its expectedVersion matches the row's actual current version).
    prismaMock.launchpadRoadmapNode.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValueOnce({
      id: 'node-1',
      version: 4,
    });
    await service.update('node-1', {
      title: 'First save',
      expectedVersion: 3,
    });

    // Second save still thinks the version is 3 (it read the row before the first save landed) —
    // the atomic updateMany's WHERE (id, version: 3) now matches zero rows, since it's really 4.
    prismaMock.launchpadRoadmapNode.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValueOnce({
      id: 'node-1',
      version: 4,
    });

    await expect(
      service.update('node-1', {
        title: 'Second save (stale)',
        expectedVersion: 3,
      } as any),
    ).rejects.toThrow(ConflictException);
  });
});

// Launchpad Phase 5B, Slice 5B-16: saveDraft and restoreVersion — the two content-lifecycle
// actions that previously wrote NO audit row at all (saveDraft) or wrote one through a raw,
// unstructured tx.auditLog.create (restoreVersion) — now go through the shared
// ContentAuditLogService and populate oldVersion/newVersion/source/reason.
describe('RoadmapNodeService — Slice 5B-16 structured audit trail (saveDraft / restoreVersion)', () => {
  let service: RoadmapNodeService;
  let prismaMock: {
    launchpadRoadmapNode: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    launchpadContentVersion: { create: jest.Mock; findFirst: jest.Mock };
    launchpadStaleMarker: { findFirst: jest.Mock; create: jest.Mock };
    launchpadChallengeVerificationContract: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const liveNode = {
    id: 'node-1',
    status: 'published',
    version: 1,
    challengeVersion: 1,
    draftContent: null as any,
    notes: 'live notes',
    codingChallenge: {},
  };

  beforeEach(async () => {
    prismaMock = {
      launchpadRoadmapNode: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
      launchpadContentVersion: { create: jest.fn(), findFirst: jest.fn() },
      launchpadStaleMarker: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      launchpadChallengeVerificationContract: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          launchpadRoadmapNode: prismaMock.launchpadRoadmapNode,
          auditLog: prismaMock.auditLog,
          launchpadContentVersion: prismaMock.launchpadContentVersion,
          launchpadStaleMarker: prismaMock.launchpadStaleMarker,
          launchpadChallengeVerificationContract:
            prismaMock.launchpadChallengeVerificationContract,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapNodeService,
        ContentVersionService,
        StaleMarkerService,
        ContentAuditLogService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoadmapNodeService>(RoadmapNodeService);
  });

  it('saveDraft with no versionMeta (a plain manual edit) writes CONTENT_EDITED, source HUMAN, oldVersion null -> newVersion 1', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...liveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      draftContent: { notes: 'edited' },
    });
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue(null); // no prior version for this node+section
    prismaMock.launchpadContentVersion.create.mockResolvedValue({
      id: 'v1',
      versionNumber: 1,
    });

    await service.saveDraft('node-1', { notes: 'edited' });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: 'CONTENT_EDITED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
        oldVersion: null,
        newVersion: 1,
        source: 'HUMAN',
      }),
    });
  });

  it('saveDraft with versionMeta.source "AI" (an approved AI regeneration merge) writes CONTENT_REGENERATED, source AI, reason set to the instruction', async () => {
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...liveNode,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      draftContent: { notes: 'regenerated' },
    });
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue({
      id: 'v1',
      versionNumber: 1,
    });
    prismaMock.launchpadContentVersion.create.mockResolvedValue({
      id: 'v2',
      versionNumber: 2,
    });

    await service.saveDraft(
      'node-1',
      { notes: 'regenerated' },
      {
        source: 'AI',
        generationJobId: 'job-1',
        instruction: 'add a practical example',
        reviewerId: 'admin-1',
      },
    );

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'CONTENT_REGENERATED',
        oldVersion: 1,
        newVersion: 2,
        source: 'AI',
        reason: 'add a practical example',
      }),
    });
  });

  it('restoreVersion writes ROADMAP_NODE_VERSION_RESTORED with node-version before/after and a reason naming the restored version', async () => {
    const target = {
      id: 'v-old',
      nodeId: 'node-1',
      versionNumber: 2,
      content: { notes: 'old content' },
    };
    prismaMock.launchpadContentVersion.findFirst.mockResolvedValue(target);
    prismaMock.launchpadRoadmapNode.findUnique.mockResolvedValue({
      ...liveNode,
      version: 5,
    });
    prismaMock.launchpadRoadmapNode.update.mockResolvedValue({
      ...liveNode,
      version: 6,
      notes: 'old content',
    });
    prismaMock.launchpadContentVersion.create.mockResolvedValue({
      id: 'v6',
      versionNumber: 6,
    });

    await service.restoreVersion('node-1', 'v-old', 'admin-9');

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-9',
        action: 'ROADMAP_NODE_VERSION_RESTORED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
        oldVersion: 5,
        newVersion: 6,
        source: 'HUMAN',
        reason: expect.stringContaining('Restored from version 2'),
      }),
    });
  });
});
