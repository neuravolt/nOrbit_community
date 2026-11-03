import { RoadmapNodeService } from './roadmap-node.service';
import { ContentVersionService } from './content-version.service';
import { StaleMarkerService } from './stale-marker.service';
import { ContentAuditLogService } from '../../../common/audit/content-audit-log.service';

/**
 * Launchpad Phase 5B, Slice 5B-1 — the exact acceptance criteria from the plan: "v1 content is
 * byte-for-byte recoverable after v2/v3 have published, via a real API call." Unlike the other
 * roadmap-node.service.spec.ts describes, this uses STATEFUL in-memory fakes for both the node
 * row and the content-version table (mirroring challenge-pipeline.e2e.spec.ts's own FakeNodeRow
 * approach) — a plain jest.fn() mock asserting "recordVersion was called with X" would only prove
 * the call happened, not that the history is genuinely recoverable across multiple publishes.
 * This proves the real guarantee behaviorally: fetch v1 back out after v2 and v3 exist.
 */
describe('RoadmapNodeService + ContentVersionService — Slice 5B-1 content version history', () => {
  let service: RoadmapNodeService;
  let contentVersionService: ContentVersionService;
  let nodeStore: Record<string, any>;
  let versionStore: any[];

  const initialNode = {
    id: 'node-1',
    status: 'draft',
    version: 1,
    challengeVersion: 1,
    draftContent: null,
    title: 'Event Loop',
    notes: 'seed notes',
    codingChallenge: {},
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
        findMany: jest.fn(async ({ where }: any) => {
          return [...versionStore]
            .filter(
              (r) => r.nodeId === where.nodeId && r.section === where.section,
            )
            .sort((a, b) => b.versionNumber - a.versionNumber);
        }),
      },
      launchpadStaleMarker: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      // GAP-1 fix: applyStaleMarkers now also checks for an approved verification contract on
      // every core-content/challenge change — none exists in this fixture's node, so "no contract
      // to invalidate" is the correct default here.
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
    return prismaMock;
  }

  beforeEach(() => {
    nodeStore = { ...initialNode };
    versionStore = [];
    const prismaMock = makePrismaMock();
    contentVersionService = new ContentVersionService(prismaMock);
    const staleMarkerService = new StaleMarkerService(prismaMock);
    service = new RoadmapNodeService(
      prismaMock,
      contentVersionService,
      staleMarkerService,
      new ContentAuditLogService(prismaMock),
    );
  });

  it('publish-twice-then-fetch-v1: the first published version is still byte-for-byte fetchable after two more publishes', async () => {
    // v1: draft + publish "Event loop is single-threaded."
    await service.saveDraft('node-1', {
      notes: 'Event loop is single-threaded.',
    });
    await service.publishDraft('node-1', 'admin-1');
    const publishedRows = await contentVersionService.listVersions('node-1');
    const v1 = publishedRows.find((r) => r.status === 'published')!;
    expect((v1.content as any).notes).toBe('Event loop is single-threaded.');

    // v2: draft + publish "Event loop handles microtasks first."
    await service.saveDraft('node-1', {
      notes: 'Event loop handles microtasks first.',
    });
    await service.publishDraft('node-1', 'admin-1');

    // v3: draft + publish "Event loop: microtasks drain before the next macrotask."
    await service.saveDraft('node-1', {
      notes: 'Event loop: microtasks drain before the next macrotask.',
    });
    await service.publishDraft('node-1', 'admin-1');

    // The live node now reflects v3 — confirms we didn't just fail to overwrite anything.
    const live = await service.findOne('node-1');
    expect(live.notes).toBe(
      'Event loop: microtasks drain before the next macrotask.',
    );

    // v1 must still be recoverable, unchanged, via the exact API surface a controller would call.
    const fetchedV1 = await contentVersionService.getVersion('node-1', v1.id);
    expect((fetchedV1.content as any).notes).toBe(
      'Event loop is single-threaded.',
    );
    expect(fetchedV1.status).toBe('published');

    // And the full history — draft + published rows for all three cycles — is enumerable, not lost.
    const allRows = await contentVersionService.listVersions('node-1');
    expect(allRows.filter((r) => r.status === 'published')).toHaveLength(3);
    expect(allRows.filter((r) => r.status === 'draft')).toHaveLength(3);
  });

  it('restore-inserts-not-overwrites: restoring v1 after v2/v3 exist adds a new version, never deletes or rewrites the ones in between', async () => {
    await service.saveDraft('node-1', { notes: 'v1 content' });
    await service.publishDraft('node-1', 'admin-1');
    const v1 = (await contentVersionService.listVersions('node-1')).find(
      (r) => r.status === 'published',
    )!;

    await service.saveDraft('node-1', { notes: 'v2 content' });
    await service.publishDraft('node-1', 'admin-1');
    const v2 = (await contentVersionService.listVersions('node-1'))
      .filter((r) => r.status === 'published')
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];

    const countBeforeRestore = (
      await contentVersionService.listVersions('node-1')
    ).length;

    const restored = await service.restoreVersion('node-1', v1.id, 'admin-2');

    // The live node now reflects v1's content again.
    expect(restored.notes).toBe('v1 content');

    // v1 and v2's own rows are untouched — same id, same content, still there.
    const v1After = await contentVersionService.getVersion('node-1', v1.id);
    const v2After = await contentVersionService.getVersion('node-1', v2.id);
    expect((v1After.content as any).notes).toBe('v1 content');
    expect((v2After.content as any).notes).toBe('v2 content');

    // A new row was inserted, not a mutation of an existing one.
    const allRowsAfter = await contentVersionService.listVersions('node-1');
    expect(allRowsAfter.length).toBe(countBeforeRestore + 1);
    const newest = allRowsAfter.sort(
      (a, b) => b.versionNumber - a.versionNumber,
    )[0];
    expect((newest.content as any).notes).toBe('v1 content');
    expect(newest.instruction).toContain('Restored from version');
    expect(newest.id).not.toBe(v1.id); // genuinely a new row, not the same id reused
  });

  it('restoreVersion on a version belonging to a different node is refused', async () => {
    await service.saveDraft('node-1', { notes: 'node-1 content' });
    await service.publishDraft('node-1', 'admin-1');
    const v1 = (await contentVersionService.listVersions('node-1'))[0];

    await expect(
      service.restoreVersion('some-other-node', v1.id, 'admin-2'),
    ).rejects.toThrow();
  });
});
