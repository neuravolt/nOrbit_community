import { RoadmapNodeService } from './roadmap-node.service';
import { ContentVersionService } from './content-version.service';
import { StaleMarkerService } from './stale-marker.service';
import { ContentAuditLogService } from '../../../common/audit/content-audit-log.service';
import { ConflictException } from '@nestjs/common';

/**
 * Launchpad Phase 5B, Slice 5B-11 — the plan's own named acceptance test: "two professors
 * regenerating the same topic concurrently — the second's request, built against a now-stale
 * version, is refused with a conflict, never silently overwrites the first's result; same test
 * shape for a restore racing a live edit." Real RoadmapNodeService + ContentVersionService
 * instances against one stateful in-memory fake (same technique as this session's other
 * integration specs) — genuinely proves the second write is refused, not just that a mock method
 * was called with certain arguments.
 */
describe('RoadmapNodeService — Slice 5B-11 concurrency protection', () => {
  let service: RoadmapNodeService;
  let contentVersionService: ContentVersionService;
  let nodeStore: Record<string, any>;
  let versionStore: any[];

  const initialNode = {
    id: 'node-1',
    status: 'published',
    version: 3, // both "professors" load the node when it's at version 3
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
        // The atomic conditional write this whole slice depends on — genuinely filters by
        // version, unlike a naive mock that always succeeds regardless of the WHERE clause.
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (
            nodeStore.id !== where.id ||
            nodeStore.version !== where.version
          ) {
            return { count: 0 };
          }
          nodeStore = { ...nodeStore, ...data };
          return { count: 1 };
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      // GAP-1 fix: no verification contract fixture is relevant to this file's concurrency
      // scenarios — "nothing to invalidate" is the correct default.
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

  it("two professors regenerating the same node concurrently — the second's save (built against the now-stale version 3) is refused, the first's result is untouched", async () => {
    // Professor A's regeneration completes and merges first — the node moves to version 4 via publishDraft.
    await service.saveDraft(
      'node-1',
      { notes: "Professor A's regenerated notes" },
      { source: 'AI' },
      3,
    );
    await service.publishDraft('node-1', 'admin-a');
    expect(nodeStore.version).toBe(4);
    expect(nodeStore.notes).toBe("Professor A's regenerated notes");

    // Professor B's regeneration was ALSO built against version 3 (they loaded the page before
    // A's change landed) — their merge must be refused now that the real current version is 4.
    await expect(
      service.saveDraft(
        'node-1',
        { notes: "Professor B's regenerated notes" } as any,
        { source: 'AI' },
        3,
      ),
    ).rejects.toThrow(ConflictException);

    // Professor A's result is completely untouched by B's failed attempt.
    expect(nodeStore.notes).toBe("Professor A's regenerated notes");
    expect(nodeStore.version).toBe(4);
  });

  it('omitting expectedVersion reproduces the old unprotected behavior — a save with no version supplied always succeeds', async () => {
    await service.saveDraft('node-1', { notes: 'first save' });
    await service.saveDraft('node-1', {
      notes: 'second save, no version check',
    });
    // Both succeeded — no conflict, matching the plan's own rollback note.
    expect(nodeStore.draftContent.notes).toBe('second save, no version check');
  });

  it('a restore racing a live edit is refused — the plan\'s own "same test shape for a restore" case', async () => {
    // Seed a real version to restore later.
    await service.saveDraft(
      'node-1',
      { notes: 'v1 content' },
      { source: 'AI' },
      3,
    );
    await service.publishDraft('node-1', 'admin-1');
    const v1 = (await contentVersionService.listVersions('node-1')).find(
      (v) => v.status === 'published',
    )!;
    expect(nodeStore.version).toBe(4);

    // A professor loads the version-history panel at version 4, intending to restore v1 — but
    // before they click restore, someone else edits and publishes, moving the node to version 5.
    await service.saveDraft(
      'node-1',
      { notes: "someone else's live edit" },
      undefined,
      4,
    );
    await service.publishDraft('node-1', 'admin-2');
    expect(nodeStore.version).toBe(5);

    // The restore, still built against the stale version 4 the professor originally loaded, is refused.
    await expect(
      service.restoreVersion('node-1', v1.id, 'admin-3', 4),
    ).rejects.toThrow(ConflictException);

    // The live edit's content is untouched by the failed restore attempt.
    expect(nodeStore.notes).toBe("someone else's live edit");
    expect(nodeStore.version).toBe(5);
  });

  it('a restore with a correctly up-to-date expectedVersion succeeds normally', async () => {
    await service.saveDraft(
      'node-1',
      { notes: 'v1 content' },
      { source: 'AI' },
      3,
    );
    await service.publishDraft('node-1', 'admin-1');
    const v1 = (await contentVersionService.listVersions('node-1')).find(
      (v) => v.status === 'published',
    )!;
    expect(nodeStore.version).toBe(4);

    const restored = await service.restoreVersion(
      'node-1',
      v1.id,
      'admin-2',
      4,
    );
    expect(restored.notes).toBe('v1 content');
    expect(nodeStore.version).toBe(5);
  });

  it('omitting expectedVersion on restore reproduces the old unprotected behavior', async () => {
    await service.saveDraft(
      'node-1',
      { notes: 'v1 content' },
      { source: 'AI' },
      3,
    );
    await service.publishDraft('node-1', 'admin-1');
    const v1 = (await contentVersionService.listVersions('node-1')).find(
      (v) => v.status === 'published',
    )!;

    // A concurrent edit happens, but no expectedVersion was supplied — the restore still succeeds.
    await service.saveDraft(
      'node-1',
      { notes: 'concurrent edit' },
      undefined,
      4,
    );
    await service.publishDraft('node-1', 'admin-x');

    const restored = await service.restoreVersion('node-1', v1.id, 'admin-2');
    expect(restored.notes).toBe('v1 content');
  });
});
