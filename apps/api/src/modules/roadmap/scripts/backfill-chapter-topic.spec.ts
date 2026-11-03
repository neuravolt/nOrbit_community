import { backfillChapterTopic } from './backfill-chapter-topic';

/**
 * Launchpad Phase 5B, Slice 5B-2 — the two acceptance criteria from the plan: "backfill
 * idempotency (run twice, no duplicates)" and "regression diff of every published node's
 * content, before vs. after." Uses a stateful in-memory fake standing in for PrismaClient
 * (same technique as roadmap-node-content-version.integration.spec.ts) so both guarantees are
 * proven behaviorally — actually running the backfill twice and diffing real before/after state
 * — not asserted from a single mock-call check.
 */
describe('backfillChapterTopic', () => {
  let nodeStore: Record<string, any>[];
  let chapterStore: any[];
  let topicStore: any[];

  function makeFakeClient() {
    const client: any = {
      launchpadRoadmapNode: {
        findMany: jest.fn(async ({ where }: any) =>
          nodeStore.filter((n) =>
            where?.topicId === null ? n.topicId === null : true,
          ),
        ),
        update: jest.fn(async ({ where, data }: any) => {
          const idx = nodeStore.findIndex((n) => n.id === where.id);
          nodeStore[idx] = { ...nodeStore[idx], ...data };
          return nodeStore[idx];
        }),
      },
      launchpadChapter: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `chapter-${chapterStore.length + 1}`, ...data };
          chapterStore.push(row);
          return row;
        }),
      },
      launchpadTopic: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `topic-${topicStore.length + 1}`, ...data };
          topicStore.push(row);
          return row;
        }),
      },
      $transaction: jest.fn(async (cb: any) => cb(client)),
    };
    return client;
  }

  beforeEach(() => {
    nodeStore = [
      {
        id: 'node-1',
        technologyLevelId: 'level-1',
        nodeNumber: 1,
        title: 'Event Loop',
        status: 'published',
        topicId: null,
        learningObjectives: ['understand the event loop'],
        notes: 'existing published notes, must not change',
        codingChallenge: { requirements: ['route:GET /health'] },
      },
      {
        id: 'node-2',
        technologyLevelId: 'level-1',
        nodeNumber: 2,
        title: 'Streams',
        status: 'draft',
        topicId: null,
        learningObjectives: ['understand streams'],
        notes: 'draft notes',
        codingChallenge: {},
      },
    ];
    chapterStore = [];
    topicStore = [];
  });

  it('gives every node its own dedicated Chapter and Topic, and sets topicId', async () => {
    const client = makeFakeClient();
    const { processed } = await backfillChapterTopic(client);

    expect(processed).toBe(2);
    expect(chapterStore).toHaveLength(2);
    expect(topicStore).toHaveLength(2);
    expect(nodeStore.every((n) => n.topicId !== null)).toBe(true);

    // Each topic belongs to its own chapter, not a shared one.
    const chapterIds = new Set(topicStore.map((t) => t.chapterId));
    expect(chapterIds.size).toBe(2);
  });

  it('backfill idempotency: running it twice processes zero nodes the second time and creates no duplicates', async () => {
    const client = makeFakeClient();
    await backfillChapterTopic(client);

    const chapterCountAfterFirstRun = chapterStore.length;
    const topicCountAfterFirstRun = topicStore.length;

    const secondRun = await backfillChapterTopic(client);

    expect(secondRun.processed).toBe(0);
    expect(chapterStore.length).toBe(chapterCountAfterFirstRun);
    expect(topicStore.length).toBe(topicCountAfterFirstRun);
  });

  it("regression: a published node's content fields are byte-identical before and after the backfill — only topicId changes", async () => {
    const client = makeFakeClient();
    const before = JSON.parse(
      JSON.stringify(nodeStore.find((n) => n.id === 'node-1')),
    );

    await backfillChapterTopic(client);

    const after = nodeStore.find((n) => n.id === 'node-1')!;
    expect(after.notes).toBe(before.notes);
    expect(after.status).toBe(before.status);
    expect(after.codingChallenge).toEqual(before.codingChallenge);
    expect(after.learningObjectives).toEqual(before.learningObjectives);
    expect(after.technologyLevelId).toBe(before.technologyLevelId);
    // The only actual change: topicId went from null to a real id.
    expect(before.topicId).toBeNull();
    expect(after.topicId).not.toBeNull();
  });

  it("the backfill-generated chapter/topic status mirrors the node's own status, not a hardcoded default", async () => {
    const client = makeFakeClient();
    await backfillChapterTopic(client);

    const chapterForPublishedNode = chapterStore.find(
      (c) => c.title === 'Event Loop',
    );
    const chapterForDraftNode = chapterStore.find((c) => c.title === 'Streams');
    expect(chapterForPublishedNode.status).toBe('published');
    expect(chapterForDraftNode.status).toBe('draft');
  });

  it('a node that already has a topicId is left untouched — no chapter/topic created for it', async () => {
    nodeStore.push({
      id: 'node-3',
      technologyLevelId: 'level-1',
      nodeNumber: 3,
      title: 'Already migrated',
      status: 'published',
      topicId: 'topic-already-exists',
      learningObjectives: [],
      notes: '',
      codingChallenge: {},
    });
    const client = makeFakeClient();
    const { processed } = await backfillChapterTopic(client);

    expect(processed).toBe(2); // only node-1 and node-2, not node-3
    expect(nodeStore.find((n) => n.id === 'node-3')!.topicId).toBe(
      'topic-already-exists',
    );
  });
});
