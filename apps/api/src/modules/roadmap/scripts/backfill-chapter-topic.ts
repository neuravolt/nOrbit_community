// Launchpad Phase 5B, Slice 5B-2: one-off backfill. Every pre-existing LaunchpadRoadmapNode gets
// exactly one dedicated LaunchpadChapter and one dedicated LaunchpadTopic — a mechanical 1:1 shim,
// not a real curriculum reorganization (grouping nodes into meaningful multi-topic chapters is a
// content/product decision, explicitly out of scope for this backfill). This is what makes the
// new hierarchy backward-compatible: nothing about an existing node's content, status, or
// technologyLevelId changes — it only gains a topicId it didn't have before.
//
// Idempotent by construction: only nodes with topicId IS NULL are processed, so a second run is
// a no-op — proven behaviorally in backfill-chapter-topic.spec.ts, not just asserted here.
//
// Lives under apps/api/src (not prisma/launchpad-seed/, where run-seed.ts lives) so it's covered
// by this app's actual Jest config (rootDir: "src") — a spec file under prisma/launchpad-seed/
// would never be discovered or run by `npx jest` here.
//
// Run with: npx ts-node -r tsconfig-paths/register apps/api/src/modules/roadmap/scripts/backfill-chapter-topic.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function backfillChapterTopic(client: PrismaClient = prisma) {
  const nodes = await client.launchpadRoadmapNode.findMany({
    where: { topicId: null },
    orderBy: [{ technologyLevelId: 'asc' }, { nodeNumber: 'asc' }],
  });

  let processed = 0;
  for (const node of nodes) {
    await client.$transaction(async (tx) => {
      const chapter = await tx.launchpadChapter.create({
        data: {
          technologyLevelId: node.technologyLevelId,
          sortOrder: node.nodeNumber,
          title: node.title,
          description: `Auto-created by Slice 5B-2 backfill for legacy node ${node.id} — one node, one chapter, one topic; not a real curriculum grouping.`,
          status: node.status,
        },
      });
      const topic = await tx.launchpadTopic.create({
        data: {
          chapterId: chapter.id,
          sortOrder: 1,
          title: node.title,
          learningObjectives: node.learningObjectives as any,
          status: node.status,
        },
      });
      await tx.launchpadRoadmapNode.update({
        where: { id: node.id },
        data: { topicId: topic.id },
      });
    });
    processed += 1;
  }

  return { processed, skipped: 0 };
}

if (require.main === module) {
  backfillChapterTopic()
    .then(({ processed }) => {
      console.log(
        `Backfill complete: ${processed} node(s) given a dedicated Chapter+Topic.`,
      );
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
