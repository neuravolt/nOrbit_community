import { PayrollAdjustmentService } from './payroll-adjustment.service';

// Gap-closure item 2/5 — create/approve/reject of a payroll adjustment
// (arrears, bonus, manual correction) must all be audited.
describe('PayrollAdjustmentService — audit trail', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: PayrollAdjustmentService;

  const ORG_ID = 'org-1';

  beforeEach(() => {
    prismaMock = {
      payrollAdjustment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = { recordAction: jest.fn() };
    service = new PayrollAdjustmentService(prismaMock, auditMock);
  });

  it('create() records a CREATE action carrying the reason as both the adjustment reason and the audit reason', async () => {
    prismaMock.payrollAdjustment.create.mockResolvedValue({ id: 'adj-1' });

    await service.create(
      ORG_ID,
      'emp-1',
      {
        type: 'ARREAR_SALARY',
        amount: 5000,
        reason: 'Salary revision arrear for March',
        targetMonth: 8,
        targetYear: 2026,
      },
      'creator-1',
    );

    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'PAYROLL_ADJUSTMENT',
      'adj-1',
      'CREATE',
      'creator-1',
      'Salary revision arrear for March',
      expect.objectContaining({
        userId: 'emp-1',
        type: 'ARREAR_SALARY',
        amount: 5000,
      }),
    );
  });

  it('approve() records an APPROVE action with the approver as actor', async () => {
    prismaMock.payrollAdjustment.findUnique.mockResolvedValue({
      id: 'adj-1',
      organizationId: ORG_ID,
      status: 'PENDING',
    });
    prismaMock.payrollAdjustment.update.mockResolvedValue({
      id: 'adj-1',
      status: 'APPROVED',
    });

    await service.approve(
      'adj-1',
      'approver-1',
      'Verified against increment letter',
    );

    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'PAYROLL_ADJUSTMENT',
      'adj-1',
      'APPROVE',
      'approver-1',
      'Verified against increment letter',
    );
  });

  it('reject() records a REJECT action with the approver as actor', async () => {
    prismaMock.payrollAdjustment.findUnique.mockResolvedValue({
      id: 'adj-1',
      organizationId: ORG_ID,
      status: 'PENDING',
    });
    prismaMock.payrollAdjustment.update.mockResolvedValue({
      id: 'adj-1',
      status: 'REJECTED',
    });

    await service.reject('adj-1', 'approver-1', 'Duplicate of adj-0');

    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'PAYROLL_ADJUSTMENT',
      'adj-1',
      'REJECT',
      'approver-1',
      'Duplicate of adj-0',
    );
  });

  // Real bug caught by the single-employee dry-run against a live database
  // (mocked single-calculate() tests never exercised a *second* calculate()
  // call on the same run, so this never surfaced): calculate() marks an
  // adjustment APPLIED at the end of every call, including recalculations.
  // Without matching already-APPLIED-to-this-run adjustments too, a
  // recalculation's APPROVED-only query would silently drop a bonus/arrear
  // that the run's own first calculate() had already applied.
  describe('getApprovedForPeriod — recalculation idempotency', () => {
    it('includes an adjustment already APPLIED to the SAME run (so recalculation does not silently drop it)', async () => {
      prismaMock.payrollAdjustment.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'adj-1' }]);

      await service.getApprovedForPeriod('emp-1', 8, 2026, 'run-1');

      expect(prismaMock.payrollAdjustment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'emp-1',
          targetMonth: 8,
          targetYear: 2026,
          OR: [
            { status: 'APPROVED' },
            { status: 'APPLIED', appliedInRunId: 'run-1' },
          ],
        },
      });
    });

    it('without a runId, only matches still-APPROVED adjustments (first calculate() of a run has no run to match against yet)', async () => {
      prismaMock.payrollAdjustment.findMany = jest.fn().mockResolvedValue([]);

      await service.getApprovedForPeriod('emp-1', 8, 2026);

      expect(prismaMock.payrollAdjustment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'emp-1',
          targetMonth: 8,
          targetYear: 2026,
          OR: [{ status: 'APPROVED' }],
        },
      });
    });
  });
});
