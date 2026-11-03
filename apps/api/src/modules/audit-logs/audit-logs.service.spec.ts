import { AuditLogsService } from './audit-logs.service';

// Launchpad Phase 5B, Slice 5B-16: "GET /api/admin/audit-logs with
// entityType/entityId/actorId/action/date-range filters" — this proves the filter set
// actually reaches Prisma's `where` clause. entityType/actorId are aliases onto the
// pre-existing resourceType/userId query params (apps/web/src/hooks/queries.ts's useAuditLogs
// already calls this endpoint and must keep working); entityId/action are new.
describe('AuditLogsService.findAll — Slice 5B-16 filters', () => {
  let service: AuditLogsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new AuditLogsService(prismaMock);
  });

  it('entityType filters on resourceType', async () => {
    await service.findAll({ entityType: 'LaunchpadRoadmapNode' });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resourceType: 'LaunchpadRoadmapNode',
        }),
      }),
    );
  });

  it('entityId filters on resourceId (previously unavailable on this endpoint at all)', async () => {
    await service.findAll({ entityId: 'node-1' });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resourceId: 'node-1' }),
      }),
    );
  });

  it('actorId filters on userId', async () => {
    await service.findAll({ actorId: 'admin-1' });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'admin-1' }),
      }),
    );
  });

  it('action filters on the action column (previously unavailable on this endpoint at all)', async () => {
    await service.findAll({ action: 'ROADMAP_NODE_DRAFT_PUBLISHED' });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: 'ROADMAP_NODE_DRAFT_PUBLISHED',
        }),
      }),
    );
  });

  it('startDate/endDate still build a createdAt range (pre-existing behavior, unchanged)', async () => {
    await service.findAll({ startDate: '2026-01-01', endDate: '2026-01-31' });
    const call = prismaMock.auditLog.findMany.mock.calls[0][0];
    expect(call.where.createdAt.gte).toEqual(new Date('2026-01-01'));
    expect(call.where.createdAt.lte).toEqual(new Date('2026-01-31'));
  });

  it('legacy resourceType/userId params still work when entityType/actorId are absent (backward compatible)', async () => {
    await service.findAll({
      resourceType: 'ChallengeEvaluationReport',
      userId: 'mentor-1',
    });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resourceType: 'ChallengeEvaluationReport',
          userId: 'mentor-1',
        }),
      }),
    );
  });

  it('entityType/actorId take precedence over resourceType/userId when both are somehow supplied', async () => {
    await service.findAll({
      entityType: 'A',
      resourceType: 'B',
      actorId: 'x',
      userId: 'y',
    });
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resourceType: 'A', userId: 'x' }),
      }),
    );
  });
});
