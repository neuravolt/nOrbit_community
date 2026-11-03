import { PrismaService } from './prisma.service';

// Enterprise Payroll Engine plan, Slice 1: PayrollConfigAuditLog must be
// append-only. The $use middleware registered in the constructor should reject
// update/delete before the query ever reaches the database — this test never
// connects to a real DB, since a rejecting middleware short-circuits before the
// query engine is invoked.
describe('PrismaService — PayrollConfigAuditLog immutability guard', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService();
  });

  it('rejects update on PayrollConfigAuditLog', async () => {
    await expect(
      prisma.payrollConfigAuditLog.update({
        where: { id: 'x' },
        data: { reason: 'tampered' },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('rejects delete on PayrollConfigAuditLog', async () => {
    await expect(
      prisma.payrollConfigAuditLog.delete({ where: { id: 'x' } }),
    ).rejects.toThrow(/append-only/i);
  });

  it('rejects deleteMany and updateMany on PayrollConfigAuditLog', async () => {
    await expect(
      prisma.payrollConfigAuditLog.deleteMany({ where: {} }),
    ).rejects.toThrow(/append-only/i);
    await expect(
      prisma.payrollConfigAuditLog.updateMany({
        where: {},
        data: { reason: 'x' },
      }),
    ).rejects.toThrow(/append-only/i);
  });
});

describe('PrismaService — PayrollRunSnapshot immutability guard', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService();
  });

  it('rejects update on PayrollRunSnapshot', async () => {
    await expect(
      prisma.payrollRunSnapshot.update({
        where: { id: 'x' },
        data: { isLocked: true },
      }),
    ).rejects.toThrow(/immutable/i);
  });

  it('rejects delete on PayrollRunSnapshot', async () => {
    await expect(
      prisma.payrollRunSnapshot.delete({ where: { id: 'x' } }),
    ).rejects.toThrow(/immutable/i);
  });
});

describe('PrismaService — PayrollAuditLog immutability guard', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService();
  });

  it('rejects update on PayrollAuditLog', async () => {
    await expect(
      prisma.payrollAuditLog.update({
        where: { id: 'x' },
        data: { reason: 'tampered' },
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it('rejects delete on PayrollAuditLog', async () => {
    await expect(
      prisma.payrollAuditLog.delete({ where: { id: 'x' } }),
    ).rejects.toThrow(/append-only/i);
  });

  it('rejects deleteMany and updateMany on PayrollAuditLog', async () => {
    await expect(
      prisma.payrollAuditLog.deleteMany({ where: {} }),
    ).rejects.toThrow(/append-only/i);
    await expect(
      prisma.payrollAuditLog.updateMany({ where: {}, data: { reason: 'x' } }),
    ).rejects.toThrow(/append-only/i);
  });
});

// Guardian Load-Safe Architecture plan, Phase 1: PrismaService wraps PrismaClient with explicit
// per-model getters (not a generic passthrough) — adding a model to schema.prisma is NOT enough
// on its own to make it reachable through `this.prisma.<model>` in any Guardian service; it also
// needs its own getter added here. This regression test exists because that exact gap shipped
// silently in Phase 1 (caught only in Phase 4, when DomainSentinelService's first real usage hit
// a TS "property does not exist" error) — these assertions just confirm each getter exists and
// forwards to a real Prisma model delegate (has the standard CRUD methods), without ever making a
// live DB call.
describe('PrismaService — Guardian Load-Safe Architecture Phase 1 models are reachable', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService();
  });

  it.each([
    'domainObservation',
    'tLSObservation',
    'securityFinding',
    'fleetOperation',
    'fleetOperationTarget',
    'guardianFileScanCursor',
  ] as const)('exposes a working %s getter', (modelGetter) => {
    const delegate = prisma[modelGetter];
    expect(delegate).toBeDefined();
    expect(typeof delegate.create).toBe('function');
    expect(typeof delegate.findMany).toBe('function');
  });
});
