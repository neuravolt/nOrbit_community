import { RoadmapNodeService } from './roadmap-node.service';
import { ContentVersionService } from './content-version.service';
import { StaleMarkerService } from './stale-marker.service';
import { ContentAuditLogService } from '../../../common/audit/content-audit-log.service';

/**
 * Launchpad Phase 5B, Slice 5B-12 — the plan's own named acceptance test: "regenerating a
 * topic's content with an existing approved quiz/challenge inserts exactly the expected marker
 * rows and touches nothing else — no field on the quiz/challenge changes, no job is auto-queued."
 * Real RoadmapNodeService + ContentVersionService + StaleMarkerService instances against one
 * stateful in-memory fake (same technique as this session's other integration specs) — proves
 * the real trigger behavior, not just that a mock method was called.
 */
describe('RoadmapNodeService — Slice 5B-12 stale dependency markers', () => {
  let service: RoadmapNodeService;
  let staleMarkerService: StaleMarkerService;
  let nodeStore: Record<string, any>;
  let versionStore: any[];
  let markerStore: any[];
  let contractStore: any[];

  const initialNodeWithAssessment = {
    id: 'node-1',
    status: 'published',
    version: 1,
    challengeVersion: 1,
    draftContent: null,
    title: 'Event Loop',
    notes: 'seed notes',
    quizQuestions: [{ question: 'What is the event loop?', correctAnswer: 0 }],
    codingChallenge: {
      objective: 'Build a queue',
      requirements: ['req-1'],
      evaluationCriteria: ['crit-1'],
    },
  };

  function makePrismaMock() {
    const prismaMock: any = {
      launchpadRoadmapNode: {
        findUnique: jest.fn(async () => ({ ...nodeStore })),
        update: jest.fn(async ({ data }: any) => {
          nodeStore = { ...nodeStore, ...data };
          return { ...nodeStore };
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      launchpadContentVersion: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `v${versionStore.length + 1}`,
            ...data,
            createdAt: new Date(),
          };
          versionStore.push(row);
          return row;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const matches = versionStore.filter(
            (r) =>
              r.nodeId === where.nodeId &&
              (!where.section || r.section === where.section) &&
              (!where.id || r.id === where.id),
          );
          if (matches.length === 0) return null;
          return [...matches].sort(
            (a, b) => b.versionNumber - a.versionNumber,
          )[0];
        }),
        findMany: jest.fn(async ({ where }: any) =>
          [...versionStore]
            .filter(
              (r) => r.nodeId === where.nodeId && r.section === where.section,
            )
            .sort((a, b) => b.versionNumber - a.versionNumber),
        ),
      },
      launchpadStaleMarker: {
        findFirst: jest.fn(
          async ({ where }: any) =>
            markerStore.find(
              (m) =>
                m.entityType === where.entityType &&
                m.entityId === where.entityId &&
                m.resolvedAt === null,
            ) ?? null,
        ),
        findUnique: jest.fn(
          async ({ where }: any) =>
            markerStore.find((m) => m.id === where.id) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `marker-${markerStore.length + 1}`,
            resolvedAt: null,
            professorDecision: null,
            ...data,
          };
          markerStore.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const row = markerStore.find((m) => m.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      // GAP-1 fix: the second half of §3's stale-dependency table ("challenge spec changes ->
      // its verification contract") is now wired — this fake stands in for
      // LaunchpadChallengeVerificationContract, matching the same "approved contract for this
      // node, or nothing to invalidate" query applyStaleMarkers issues.
      launchpadChallengeVerificationContract: {
        findFirst: jest.fn(
          async ({ where }: any) =>
            contractStore.find(
              (c) =>
                c.nodeId === where.nodeId &&
                c.approvalStatus === where.approvalStatus,
            ) ?? null,
        ),
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
    return prismaMock;
  }

  function setUp(
    initialNode: Record<string, any>,
    initialContracts: any[] = [],
  ) {
    nodeStore = { ...initialNode };
    versionStore = [];
    markerStore = [];
    contractStore = [...initialContracts];
    const prismaMock = makePrismaMock();
    const contentVersionService = new ContentVersionService(prismaMock);
    staleMarkerService = new StaleMarkerService(prismaMock);
    service = new RoadmapNodeService(
      prismaMock,
      contentVersionService,
      staleMarkerService,
      new ContentAuditLogService(prismaMock),
    );
  }

  const approvedContractFixture = {
    id: 'contract-1',
    nodeId: 'node-1',
    approvalStatus: 'approved',
  };

  it('publishing a core-content change marks both the existing quiz and challenge stale, touching neither field', async () => {
    setUp(initialNodeWithAssessment);

    await service.saveDraft('node-1', {
      notes: 'Updated: the event loop is single-threaded.',
    });
    await service.publishDraft('node-1', 'admin-1');

    expect(markerStore).toHaveLength(2);
    const types = markerStore.map((m) => m.entityType).sort();
    expect(types).toEqual(['challenge', 'quiz']);
    expect(markerStore.every((m) => m.entityId === 'node-1')).toBe(true);
    expect(markerStore.every((m) => m.resolvedAt === null)).toBe(true);

    // Neither quiz nor challenge field was touched by the content-only publish.
    expect(nodeStore.quizQuestions).toEqual(
      initialNodeWithAssessment.quizQuestions,
    );
    expect(nodeStore.codingChallenge).toEqual(
      initialNodeWithAssessment.codingChallenge,
    );
  });

  it('publishing a challenge-only change (no core content change) inserts zero markers when no verification contract exists', async () => {
    setUp(initialNodeWithAssessment);

    await service.saveDraft('node-1', {
      codingChallenge: {
        objective: 'Build a stack instead',
        requirements: ['req-2'],
        evaluationCriteria: ['crit-2'],
      },
    });
    await service.publishDraft('node-1', 'admin-1');

    // Nothing to invalidate — quiz/challenge are only marked stale by a core-content change, and
    // there's no approved verification contract for this node either.
    expect(markerStore).toHaveLength(0);
  });

  // GAP-1 fix (post-5B-15 audit): §3's second named trigger — "challenge spec changes -> its
  // verification contract" — was left unwired when this file was first written because
  // LaunchpadChallengeVerificationContract didn't exist yet. It exists now (5B-15), so a
  // challenge-only change (no core content touched) must mark an already-approved contract stale
  // on its own, without also touching quiz/challenge (which are gated on core-content change).
  it('publishing a challenge-only change marks an existing APPROVED verification contract stale, without touching quiz/challenge markers', async () => {
    setUp(initialNodeWithAssessment, [approvedContractFixture]);

    await service.saveDraft('node-1', {
      codingChallenge: {
        objective: 'Build a stack instead',
        requirements: ['req-2'],
        evaluationCriteria: ['crit-2'],
      },
    });
    await service.publishDraft('node-1', 'admin-1');

    expect(markerStore).toHaveLength(1);
    expect(markerStore[0]).toMatchObject({
      entityType: 'verification_contract',
      entityId: 'node-1',
    });
  });

  it('publishing a core-content change marks the verification contract stale too, alongside quiz/challenge, when one exists', async () => {
    setUp(initialNodeWithAssessment, [approvedContractFixture]);

    await service.saveDraft('node-1', {
      notes: 'Updated: the event loop is single-threaded.',
    });
    await service.publishDraft('node-1', 'admin-1');

    expect(markerStore).toHaveLength(3);
    expect(markerStore.map((m) => m.entityType).sort()).toEqual([
      'challenge',
      'quiz',
      'verification_contract',
    ]);
  });

  it('a DRAFT (not yet approved) verification contract is not marked stale — nothing live to invalidate', async () => {
    setUp(initialNodeWithAssessment, [
      { id: 'contract-1', nodeId: 'node-1', approvalStatus: 'draft' },
    ]);

    await service.saveDraft('node-1', {
      codingChallenge: {
        objective: 'Build a stack instead',
        requirements: ['req-2'],
        evaluationCriteria: ['crit-2'],
      },
    });
    await service.publishDraft('node-1', 'admin-1');

    expect(markerStore).toHaveLength(0);
  });

  it('publishing a core-content change on a node with no real quiz/challenge yet inserts zero markers', async () => {
    setUp({
      ...initialNodeWithAssessment,
      quizQuestions: [],
      codingChallenge: {},
    });

    await service.saveDraft('node-1', { notes: 'first real content' });
    await service.publishDraft('node-1', 'admin-1');

    expect(markerStore).toHaveLength(0);
  });

  it('republishing another core-content change while the first marker is still unresolved does not pile up duplicate markers', async () => {
    setUp(initialNodeWithAssessment);

    await service.saveDraft('node-1', { notes: 'first update' });
    await service.publishDraft('node-1', 'admin-1');
    expect(markerStore).toHaveLength(2);

    await service.saveDraft('node-1', { notes: 'second update' });
    await service.publishDraft('node-1', 'admin-1');
    expect(markerStore).toHaveLength(2); // still 2, not 4 — same unresolved markers, not duplicated
  });

  it('resolving a marker, then republishing content again, inserts a fresh marker for that entity', async () => {
    setUp(initialNodeWithAssessment);

    await service.saveDraft('node-1', { notes: 'first update' });
    await service.publishDraft('node-1', 'admin-1');
    const quizMarker = markerStore.find((m) => m.entityType === 'quiz')!;
    await staleMarkerService.resolve(quizMarker.id, 'KEEP');

    await service.saveDraft('node-1', { notes: 'second update' });
    await service.publishDraft('node-1', 'admin-1');

    const quizMarkers = markerStore.filter((m) => m.entityType === 'quiz');
    expect(quizMarkers).toHaveLength(2); // the resolved one, plus a fresh one
    expect(quizMarkers.filter((m) => m.resolvedAt === null)).toHaveLength(1);
  });

  it('restoreVersion with a core-content-changing restore marks quiz/challenge/contract stale the same way publishDraft does', async () => {
    setUp(initialNodeWithAssessment, [approvedContractFixture]);

    // v1: a real published version, content-identical to the seed notes.
    await service.saveDraft('node-1', {
      notes: initialNodeWithAssessment.notes,
    });
    await service.publishDraft('node-1', 'admin-1');
    const v1 = versionStore.find((v) => v.status === 'published')!;

    // v2: a content-only change.
    await service.saveDraft('node-1', { notes: 'v2 content' });
    await service.publishDraft('node-1', 'admin-1');
    markerStore.length = 0; // clear markers from the v1/v2 publishes to isolate the restore's own effect

    await service.restoreVersion('node-1', v1.id, 'admin-2');

    expect(markerStore).toHaveLength(3);
    expect(markerStore.map((m) => m.entityType).sort()).toEqual([
      'challenge',
      'quiz',
      'verification_contract',
    ]);
  });
});
