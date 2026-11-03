import { ContentAuditLogService } from './content-audit-log.service';

describe('ContentAuditLogService', () => {
  let prismaMock: any;
  let service: ContentAuditLogService;

  beforeEach(() => {
    prismaMock = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new ContentAuditLogService(prismaMock);
  });

  it('write() defaults missing optional fields to null rather than omitting them', async () => {
    await service.write({
      action: 'CONTENT_EDITED',
      resourceType: 'LaunchpadRoadmapNode',
      resourceId: 'node-1',
      source: 'HUMAN',
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: 'CONTENT_EDITED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
        oldVersion: null,
        newVersion: null,
        source: 'HUMAN',
        reason: null,
        severity: 'INFO',
        metadata: undefined,
      },
    });
  });

  it('write() passes an explicit transaction client through instead of the injected PrismaService, when one is supplied', async () => {
    const txMock = { auditLog: { create: jest.fn().mockResolvedValue({}) } };

    await service.write(
      {
        action: 'CONTENT_REGENERATED',
        resourceType: 'LaunchpadRoadmapNode',
        resourceId: 'node-1',
        source: 'AI',
      },
      txMock,
    );

    expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('write() forwards oldVersion/newVersion/reason/metadata verbatim when supplied', async () => {
    await service.write({
      action: 'ROADMAP_NODE_VERSION_RESTORED',
      resourceType: 'LaunchpadRoadmapNode',
      resourceId: 'node-1',
      userId: 'admin-1',
      oldVersion: 3,
      newVersion: 4,
      source: 'HUMAN',
      reason: 'Restored from version 2',
      metadata: { restoredFromVersionId: 'v2' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        oldVersion: 3,
        newVersion: 4,
        reason: 'Restored from version 2',
        metadata: { restoredFromVersionId: 'v2' },
      }),
    });
  });
});
