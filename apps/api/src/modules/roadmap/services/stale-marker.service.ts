import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export const STALE_MARKER_DECISIONS = [
  'REGENERATE',
  'KEEP',
  'EDIT_MANUALLY',
] as const;
export type StaleMarkerDecision = (typeof STALE_MARKER_DECISIONS)[number];

/**
 * Launchpad Phase 5B, Slice 5B-12. Warning-only, insert-only append log — mirrors the
 * discipline ContentVersionService/ChallengeScoreVersion already established (no update/delete
 * beyond the one explicit resolve action a professor takes). §3's explicit lock: nothing in
 * this codebase reads an unresolved marker and acts on it automatically — the marker is inert
 * until resolve() is called with a real decision.
 */
@Injectable()
export class StaleMarkerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Inserts a stale marker unless an unresolved one already exists for this exact entity —
   * prevents unbounded marker pile-up when the same content is republished repeatedly before a
   * professor gets to review it (the badge's observable state is identical either way: "this
   * entity has an unresolved marker"). Can run inside an existing transaction via `tx`, same
   * pattern as ContentVersionService.recordVersion.
   */
  async markStale(
    entityType: string,
    entityId: string,
    triggeredByVersionId: string,
    tx: any = this.prisma,
  ) {
    const existing = await tx.launchpadStaleMarker.findFirst({
      where: { entityType, entityId, resolvedAt: null },
    });
    if (existing) return existing;

    return tx.launchpadStaleMarker.create({
      data: { entityType, entityId, triggeredByVersionId },
    });
  }

  async listUnresolved(entityType: string, entityId: string) {
    return this.prisma.launchpadStaleMarker.findMany({
      where: { entityType, entityId, resolvedAt: null },
      orderBy: { staleSince: 'desc' },
    });
  }

  async resolve(markerId: string, decision: string) {
    if (!STALE_MARKER_DECISIONS.includes(decision as StaleMarkerDecision)) {
      throw new BadRequestException(
        `decision must be one of ${STALE_MARKER_DECISIONS.join(', ')}`,
      );
    }
    const marker = await this.prisma.launchpadStaleMarker.findUnique({
      where: { id: markerId },
    });
    if (!marker) {
      throw new NotFoundException('Stale marker not found');
    }
    return this.prisma.launchpadStaleMarker.update({
      where: { id: markerId },
      data: { resolvedAt: new Date(), professorDecision: decision },
    });
  }
}
