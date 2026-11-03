import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type ContentVersionSource = 'AI' | 'MANUAL';
export type ContentVersionStatus = 'draft' | 'published';

export interface RecordVersionInput {
  nodeId: string;
  section?: string; // defaults to "full" — the only value until Slice 5B-4 (sub-field regeneration)
  content: Record<string, unknown>;
  source: ContentVersionSource;
  status: ContentVersionStatus;
  generationJobId?: string;
  instruction?: string;
  reviewerId?: string;
}

/**
 * Launchpad Phase 5B, Slice 5B-1. Append-only reader/writer for LaunchpadContentVersion —
 * mirrors ChallengeScoreVersion's existing "every recalculation appends a version instead of
 * overwriting" convention, applied to content. Only .create() is ever called against this
 * table from this service; there is no update/delete method here by design (same discipline
 * ChallengeScoreVersion already relies on, not a new enforcement mechanism).
 */
@Injectable()
export class ContentVersionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Inserts a new version row. Computes the next versionNumber (per node+section) and links
   * previousVersionId to whatever was previously latest — callers never supply either.
   * Can run inside an existing transaction by passing a transactional Prisma client as `tx`
   * (same untyped-`tx` pattern roadmap-node.service.ts's own $transaction callbacks already use).
   */
  async recordVersion(input: RecordVersionInput, tx: any = this.prisma) {
    const section = input.section ?? 'full';
    const previous = await tx.launchpadContentVersion.findFirst({
      where: { nodeId: input.nodeId, section },
      orderBy: { versionNumber: 'desc' },
    });

    const created = await tx.launchpadContentVersion.create({
      data: {
        nodeId: input.nodeId,
        section,
        versionNumber: (previous?.versionNumber ?? 0) + 1,
        content: input.content as any,
        source: input.source,
        status: input.status,
        generationJobId: input.generationJobId ?? null,
        instruction: input.instruction ?? null,
        previousVersionId: previous?.id ?? null,
        reviewerId: input.reviewerId ?? null,
        reviewedAt: input.reviewerId ? new Date() : null,
      },
    });

    // Slice 5B-16: exposes the version this row supersedes so callers (RoadmapNodeService's
    // audit-log writes) can populate AuditLog.oldVersion/newVersion without a second query.
    return {
      ...created,
      previousVersionNumber: previous?.versionNumber ?? null,
    };
  }

  async listVersions(nodeId: string, section = 'full') {
    return this.prisma.launchpadContentVersion.findMany({
      where: { nodeId, section },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async getVersion(nodeId: string, versionId: string) {
    const version = await this.prisma.launchpadContentVersion.findFirst({
      where: { id: versionId, nodeId },
    });
    if (!version) {
      throw new NotFoundException('Content version not found for this node.');
    }
    return version;
  }
}
