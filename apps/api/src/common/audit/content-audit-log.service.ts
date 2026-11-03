import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Launchpad Phase 5B, Slice 5B-16. The six content-lifecycle actions named in the plan's §6
// action→AuditLog table — kept as a closed union so a typo in an action string is a compile
// error, not a silently-unqueryable row.
export type ContentAuditAction =
  | 'CONTENT_EDITED'
  | 'CONTENT_REGENERATED'
  | 'ROADMAP_NODE_DRAFT_PUBLISHED'
  | 'ROADMAP_NODE_VERSION_RESTORED';

export type ContentAuditSource = 'AI' | 'HUMAN' | 'POLICY';

export interface WriteContentAuditLogParams {
  action: ContentAuditAction;
  resourceType: string;
  resourceId: string;
  userId?: string | null;
  oldVersion?: number | null;
  newVersion?: number | null;
  source: ContentAuditSource;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Launchpad Phase 5B, Slice 5B-16: the "shared writeAuditLog() helper" the plan's §6/§16
 * describes — one call, used by every edit/regenerate/publish/restore path on
 * RoadmapNodeService, so those four actions always produce the same row shape (oldVersion,
 * newVersion, source, reason) instead of each call site hand-rolling its own `auditLog.create`.
 *
 * Deliberately NOT extended to ai-orchestration.service.ts's APPROVED/REJECTED writes or
 * mentor-approval.service.ts's mentor-review writes — both already write directly via
 * `prisma.auditLog.create` with the same new columns populated inline. Routing those through an
 * injected service too would mean touching 15+ existing multi-line `new AiOrchestrationService(...)`
 * test call sites for a purely mechanical DI change (a scripted append across that many call
 * sites has already caused two real syntax bugs earlier in this project — see 6-4/5B-15's
 * post-mortems); the row SHAPE these actions produce is what the plan actually requires, and
 * that's identical either way.
 */
@Injectable()
export class ContentAuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(params: WriteContentAuditLogParams, tx: any = this.prisma) {
    return tx.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        oldVersion: params.oldVersion ?? null,
        newVersion: params.newVersion ?? null,
        source: params.source,
        reason: params.reason ?? null,
        severity: 'INFO',
        metadata: (params.metadata as any) ?? undefined,
      },
    });
  }
}
