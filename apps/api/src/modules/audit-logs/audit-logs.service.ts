import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const {
      userId,
      resourceType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      // Launchpad Phase 5B, Slice 5B-16: the plan's §6 named filter set for
      // "GET /api/admin/audit-logs" — entityType/entityId/actorId/action. Aliases onto the
      // pre-existing resourceType/userId params (kept working — apps/web/src/hooks/queries.ts's
      // useAuditLogs already calls this endpoint with arbitrary passthrough params) rather than
      // replacing them; entityId/action are genuinely new filters this endpoint didn't have.
      entityType,
      entityId,
      actorId,
      action,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    const resolvedUserId = actorId ?? userId;
    const resolvedResourceType = entityType ?? resourceType;
    if (resolvedUserId) where.userId = resolvedUserId;
    if (resolvedResourceType) where.resourceType = resolvedResourceType;
    if (entityId) where.resourceId = entityId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findByEntity(type: string, id: string) {
    return this.prisma.auditLog.findMany({
      where: {
        resourceType: type,
        resourceId: id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
