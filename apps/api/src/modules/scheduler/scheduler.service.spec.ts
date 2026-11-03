import { SchedulerService } from './scheduler.service';

// No prior spec file existed for SchedulerService — this establishes the pattern, scoped
// deliberately to just the new runNightlyGuardianScans method (Guardian WordPress-security plan,
// Phase 1), not a full spec for every pre-existing cron in this file.
describe('SchedulerService.runNightlyGuardianScans', () => {
  let prismaMock: any;
  let guardianServiceMock: any;
  let wordpressScanServiceMock: any;
  let service: SchedulerService;

  beforeEach(() => {
    jest.useFakeTimers();
    prismaMock = {
      guardianAgent: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'agent-1' }, { id: 'agent-2' }]),
      },
    };
    guardianServiceMock = {
      triggerMalwareScan: jest.fn().mockResolvedValue({ queued: true }),
      triggerSecurityScan: jest.fn().mockResolvedValue({ queued: true }),
    };
    wordpressScanServiceMock = {
      scanAgent: jest.fn().mockResolvedValue(undefined),
    };

    service = new SchedulerService(
      prismaMock,
      {} as any, // NotificationsService — unused by this method
      {} as any, // BillingService — unused by this method
      {} as any, // LaunchpadFraudService — unused by this method
      guardianServiceMock,
      wordpressScanServiceMock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs all three scan types for every active agent', async () => {
    const runPromise = service.runNightlyGuardianScans();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(prismaMock.guardianAgent.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', deletedAt: null },
      include: {
        server: { select: { guardianOwnership: true, guardianMode: true } },
      },
    });
    expect(guardianServiceMock.triggerMalwareScan).toHaveBeenCalledWith(
      'agent-1',
    );
    expect(guardianServiceMock.triggerMalwareScan).toHaveBeenCalledWith(
      'agent-2',
    );
    expect(guardianServiceMock.triggerSecurityScan).toHaveBeenCalledWith(
      'agent-1',
    );
    expect(guardianServiceMock.triggerSecurityScan).toHaveBeenCalledWith(
      'agent-2',
    );
    expect(wordpressScanServiceMock.scanAgent).toHaveBeenCalledWith('agent-1');
    expect(wordpressScanServiceMock.scanAgent).toHaveBeenCalledWith('agent-2');
  });

  it('skips client-owned (BYOVPS) agents — their scans would otherwise run over SSH on our own host', async () => {
    prismaMock.guardianAgent.findMany.mockResolvedValue([
      {
        id: 'managed-1',
        server: { guardianOwnership: 'NEURAVOLT', guardianMode: 'MANAGED' },
      },
      {
        id: 'byovps-1',
        server: { guardianOwnership: 'CLIENT', guardianMode: 'BYOVPS' },
      },
    ]);
    const runPromise = service.runNightlyGuardianScans();
    await jest.runAllTimersAsync();
    await runPromise;
    expect(guardianServiceMock.triggerMalwareScan.mock.calls).toEqual([
      ['managed-1'],
    ]);
    expect(guardianServiceMock.triggerSecurityScan.mock.calls).toEqual([
      ['managed-1'],
    ]);
    expect(wordpressScanServiceMock.scanAgent.mock.calls).toEqual([
      ['managed-1'],
    ]);
  });

  it("one agent's malware-scan failure does not prevent its own security/WordPress scans, or the next agent's scans, from running", async () => {
    guardianServiceMock.triggerMalwareScan.mockImplementation(
      async (agentId: string) => {
        if (agentId === 'agent-1') throw new Error('queue unavailable');
        return { queued: true };
      },
    );

    const runPromise = service.runNightlyGuardianScans();
    await jest.runAllTimersAsync();
    await runPromise;

    // agent-1's malware scan failed, but its security scan and WordPress scan still ran...
    expect(guardianServiceMock.triggerSecurityScan).toHaveBeenCalledWith(
      'agent-1',
    );
    expect(wordpressScanServiceMock.scanAgent).toHaveBeenCalledWith('agent-1');
    // ...and agent-2 was entirely unaffected by agent-1's failure.
    expect(guardianServiceMock.triggerMalwareScan).toHaveBeenCalledWith(
      'agent-2',
    );
    expect(guardianServiceMock.triggerSecurityScan).toHaveBeenCalledWith(
      'agent-2',
    );
    expect(wordpressScanServiceMock.scanAgent).toHaveBeenCalledWith('agent-2');
  });

  it('a WordPress-scan failure for one agent does not prevent the next agent from being scanned at all', async () => {
    wordpressScanServiceMock.scanAgent.mockImplementation(
      async (agentId: string) => {
        if (agentId === 'agent-1') throw new Error('SSH timeout');
      },
    );

    const runPromise = service.runNightlyGuardianScans();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(wordpressScanServiceMock.scanAgent).toHaveBeenCalledWith('agent-2');
    expect(guardianServiceMock.triggerMalwareScan).toHaveBeenCalledWith(
      'agent-2',
    );
  });

  it('scans zero agents cleanly when none are ACTIVE', async () => {
    prismaMock.guardianAgent.findMany.mockResolvedValue([]);

    await service.runNightlyGuardianScans();

    expect(guardianServiceMock.triggerMalwareScan).not.toHaveBeenCalled();
    expect(wordpressScanServiceMock.scanAgent).not.toHaveBeenCalled();
  });
});

// GuardianMonitor had 14.5M rows / ~6.9GB in production with nothing ever deleting old rows.
// pruneOldGuardianMonitors deletes in small batches (never one giant DELETE on a live table) —
// these tests cover the batching loop itself, not real SQL semantics.
describe('SchedulerService.pruneOldGuardianMonitors', () => {
  let prismaMock: any;
  let service: SchedulerService;

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn(),
      guardianMonitor: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new SchedulerService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('deletes in batches until a batch comes back smaller than the batch size, then stops', async () => {
    const batch = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }));
    prismaMock.$queryRaw
      .mockResolvedValueOnce(batch(5000))
      .mockResolvedValueOnce(batch(5000))
      .mockResolvedValueOnce(batch(1200)); // smaller than BATCH_SIZE -> loop stops here

    await service.pruneOldGuardianMonitors();

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prismaMock.guardianMonitor.deleteMany).toHaveBeenCalledTimes(3);
  });

  it('stops immediately and deletes nothing when no rows are past the retention cutoff', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await service.pruneOldGuardianMonitors();

    expect(prismaMock.guardianMonitor.deleteMany).not.toHaveBeenCalled();
  });

  it("one failed batch doesn't throw out of the method — it logs and stops, doesn't crash the caller", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection reset'));

    await expect(service.pruneOldGuardianMonitors()).resolves.toBeUndefined();
  });
});
