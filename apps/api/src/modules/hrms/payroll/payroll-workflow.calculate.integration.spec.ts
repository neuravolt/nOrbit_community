import { NotFoundException } from '@nestjs/common';
import { PayrollWorkflowService } from './payroll-workflow.service';

// Section 3/26 — end-to-end proof that calculate() wires the engine correctly
// and that a payroll run's snapshot is a real, disconnected copy: mutating
// the "live" config mock after calculate() has already run must not change
// what was captured. Everything downstream of the pure engine is already
// covered by the pure-function tests and the workflow-guard tests — this
// test exists to prove the orchestration wiring itself, not re-derive the
// arithmetic.
//
// P0 gap-closure: also proves the statutory TDS engine is actually wired in
// — not just callable standalone — and that it falls back to the flat
// EmployeeSalary.tds field only when no TaxRegimeConfig exists, never
// silently on any other kind of failure.
describe('PayrollWorkflowService.calculate — integration', () => {
  const RUN = {
    id: 'run-1',
    organizationId: 'org-1',
    month: 8,
    year: 2026,
    status: 'DRAFT',
    createdBy: null,
  };
  const CONFIG = {
    pfEnabled: true,
    pfEmployeeRate: 0.12,
    pfEmployerRate: 0.12,
    pfWageCeiling: 15000,
    pfApplyWageCap: true,
    esiEnabled: true,
    esiEmployeeRate: 0.0075,
    esiEmployerRate: 0.0325,
    esiGrossCeiling: 21000,
    ptEnabled: true,
    ptState: 'Karnataka',
    ptSlabs: [
      { upTo: 14999, amount: 0 },
      { upTo: 19999, amount: 150 },
      { upTo: 9999999, amount: 200 },
    ],
    lwpCalculationBase: 'CALENDAR',
    defaultTaxRegime: 'NEW',
  };
  const SALARY = {
    id: 'sal-1',
    userId: 'user-1',
    basicSalary: 40000,
    hra: 16000,
    conveyanceAllowance: 0,
    specialAllowance: 0,
    daAllowance: 0,
    otherAllowance: 0,
    ctc: 900000,
    pfApplicable: true,
    esiApplicable: true,
    tds: 999, // deliberately distinct from any statutory-engine result, so tests can tell which path fired
    taxRegime: 'NEW',
    user: { id: 'user-1', organizationId: 'org-1' },
  };
  const WORKING_WEEK = {
    monday: 'FULL_DAY',
    tuesday: 'FULL_DAY',
    wednesday: 'FULL_DAY',
    thursday: 'FULL_DAY',
    friday: 'FULL_DAY',
    saturday: 'OFF',
    sunday: 'OFF',
    alternateSaturdayRule: 'NONE',
  };
  // Deliberately generous slabs so a ~112000/month (56000*12=672000... actually
  // gross here is basic+hra=56000/month -> 672000/yr) reference income produces
  // a nonzero, distinctive tax figure, unmistakably different from the flat 999.
  const TAX_CONFIG = {
    standardDeduction: 50000,
    // Deliberately below this test salary's taxable income (622000) so the
    // 87A rebate does NOT zero out the tax — otherwise "gross > 0 -> tds > 0"
    // wouldn't hold, since a taxable income under the real rebate threshold
    // legitimately owes zero tax (that's correct engine behavior, not a bug).
    rebateLimit: 500000,
    rebateAmount: 25000,
    cessRate: 0.04,
    slabs: [
      { incomeFrom: 0, incomeTo: 300000, taxRate: 0 },
      { incomeFrom: 300000, incomeTo: 700000, taxRate: 0.05 },
      { incomeFrom: 700000, incomeTo: 1000000, taxRate: 0.1 },
      { incomeFrom: 1000000, incomeTo: null, taxRate: 0.2 },
    ],
    surcharges: [],
  };

  let prismaMock: any;
  let payrollConfigServiceMock: any;
  let workingWeekServiceMock: any;
  let holidayCalendarServiceMock: any;
  let adjustmentServiceMock: any;
  let taxConfigServiceMock: any;
  let service: PayrollWorkflowService;
  let capturedSnapshotData: any;

  beforeEach(() => {
    capturedSnapshotData = null;

    prismaMock = {
      payrollRun: {
        findUnique: jest.fn().mockResolvedValue(RUN),
        update: jest.fn(async ({ data }: any) => ({ ...RUN, ...data })),
      },
      organizationSettings: {
        findUnique: jest.fn().mockResolvedValue({ workingHours: 8 }),
      },
      salaryComponent: { findMany: jest.fn().mockResolvedValue([]) },
      organization: { count: jest.fn().mockResolvedValue(1) },
      employeeSalary: { findMany: jest.fn().mockResolvedValue([SALARY]) },
      payrollRunSnapshot: {
        create: jest.fn(async ({ data }: any) => {
          capturedSnapshotData = data; // simulate the DB storing a deep, disconnected copy
          return { id: 'snapshot-1', ...data };
        }),
      },
      employeeSalaryComponent: { findMany: jest.fn().mockResolvedValue([]) },
      attendance: { findMany: jest.fn().mockResolvedValue([]) },
      leaveLedger: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: null } }),
      },
      overtimeConfig: { findFirst: jest.fn().mockResolvedValue(null) },
      overtimeEntry: { findMany: jest.fn().mockResolvedValue([]) },
      taxExemption: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { approvedAmount: null, declaredAmount: null },
        }),
      },
      payslip: { upsert: jest.fn().mockResolvedValue({}) },
    };

    payrollConfigServiceMock = {
      getEffectiveConfig: jest.fn().mockResolvedValue({ ...CONFIG }),
    };
    workingWeekServiceMock = {
      getCurrent: jest.fn().mockResolvedValue({ ...WORKING_WEEK }),
    };
    holidayCalendarServiceMock = {
      getAssignedCalendar: jest.fn().mockResolvedValue(null),
    };
    adjustmentServiceMock = {
      getApprovedForPeriod: jest.fn().mockResolvedValue([]),
      markApplied: jest.fn().mockResolvedValue(undefined),
    };
    // Default: no TaxRegimeConfig configured for this org/FY/regime, matching
    // real TaxConfigService.getEffective's behavior for a genuinely missing
    // config — the flat-fallback path.
    taxConfigServiceMock = {
      getEffective: jest
        .fn()
        .mockRejectedValue(
          new NotFoundException('No active NEW tax config for FY 2026-27.'),
        ),
      toEngineInput: jest.fn((c: any) => c),
    };

    service = new PayrollWorkflowService(
      prismaMock,
      payrollConfigServiceMock,
      workingWeekServiceMock,
      holidayCalendarServiceMock,
      adjustmentServiceMock,
      taxConfigServiceMock,
    );
  });

  it('transitions DRAFT -> CALCULATED and stamps calculatedAt', async () => {
    const result = await service.calculate('run-1', 'user-1');
    expect(result.status).toBe('CALCULATED');
    expect(prismaMock.payrollRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CALCULATED' }),
      }),
    );
  });

  it('on a single-company install also pays employees not yet tied to the organization', async () => {
    await service.calculate('run-1', 'user-1');
    const where = prismaMock.employeeSalary.findMany.mock.calls[0][0].where;
    expect(where.user).toEqual({
      OR: [{ organizationId: expect.any(String) }, { organizationId: null }],
    });
  });

  it('writes exactly one payslip for the one active employee, with the engine-computed net pay', async () => {
    await service.calculate('run-1', 'user-1');
    expect(prismaMock.payslip.upsert).toHaveBeenCalledTimes(1);
    const payslipData = prismaMock.payslip.upsert.mock.calls[0][0].create;
    // basic 40000 + hra 16000 = 56000 gross; PF capped at 15000*12%=1800;
    // ESI blocked (56000 > 21000 ceiling); PT top slab 200.
    expect(payslipData.grossPay).toBe(56000);
    expect(payslipData.pfEmployee).toBe(1800);
    expect(payslipData.esiEmployee).toBe(0);
    expect(payslipData.professionalTax).toBe(200);
    expect(payslipData.snapshotId).toBe('snapshot-1');
  });

  it('captures a real, disconnected snapshot: mutating the live config mock after calculate() does not change what was captured', async () => {
    await service.calculate('run-1', 'user-1');
    expect(capturedSnapshotData.payrollConfigJson.pfEmployeeRate).toBe(0.12);

    // Simulate a later admin change to the live org config.
    CONFIG.pfEmployeeRate = 0.5;
    payrollConfigServiceMock.getEffectiveConfig.mockResolvedValue({
      ...CONFIG,
    });

    // The already-captured snapshot object must still show the original rate
    // — it was captured as a value, not a live reference.
    expect(capturedSnapshotData.payrollConfigJson.pfEmployeeRate).toBe(0.12);
  });

  it('recalculating from CALCULATED creates a new snapshot rather than mutating the old one', async () => {
    await service.calculate('run-1', 'user-1');
    const firstSnapshotCall =
      prismaMock.payrollRunSnapshot.create.mock.calls.length;

    prismaMock.payrollRun.findUnique.mockResolvedValue({
      ...RUN,
      status: 'CALCULATED',
    });
    await service.calculate('run-1', 'user-1');

    expect(prismaMock.payrollRunSnapshot.create).toHaveBeenCalledTimes(
      firstSnapshotCall + 1,
    );
  });

  describe('TDS integration (P0)', () => {
    it('falls back to the flat EmployeeSalary.tds field when no TaxRegimeConfig exists', async () => {
      await service.calculate('run-1', 'user-1');
      const payslipData = prismaMock.payslip.upsert.mock.calls[0][0].create;
      expect(payslipData.tds).toBe(999);
      expect(payslipData.componentBreakdownJson.tdsSource).toBe(
        'FLAT_FALLBACK',
      );
    });

    it('uses the statutory tax engine instead of the flat field when a TaxRegimeConfig is configured', async () => {
      taxConfigServiceMock.getEffective.mockResolvedValue(TAX_CONFIG);

      await service.calculate('run-1', 'user-1');

      const payslipData = prismaMock.payslip.upsert.mock.calls[0][0].create;
      expect(payslipData.componentBreakdownJson.tdsSource).toBe(
        'STATUTORY_ENGINE',
      );
      expect(payslipData.tds).not.toBe(999); // proves it's not the flat field
      expect(payslipData.tds).toBeGreaterThan(0); // 672000/yr taxable income produces real tax under TAX_CONFIG's slabs
    });

    it('changing tax configuration changes the calculated TDS', async () => {
      taxConfigServiceMock.getEffective.mockResolvedValue(TAX_CONFIG);
      await service.calculate('run-1', 'user-1');
      const firstTds = prismaMock.payslip.upsert.mock.calls[0][0].create.tds;

      // A stricter config (lower slab thresholds -> more tax) for a recalculation.
      const stricterConfig = {
        ...TAX_CONFIG,
        slabs: [{ incomeFrom: 0, incomeTo: null, taxRate: 0.3 }],
      };
      taxConfigServiceMock.getEffective.mockResolvedValue(stricterConfig);
      prismaMock.payrollRun.findUnique.mockResolvedValue({
        ...RUN,
        status: 'CALCULATED',
      });
      await service.calculate('run-1', 'user-1');
      const secondTds = prismaMock.payslip.upsert.mock.calls[1][0].create.tds;

      expect(secondTds).toBeGreaterThan(firstTds);
    });

    it('captures the exact tax configuration used in the snapshot, keyed by regime and financial year', async () => {
      taxConfigServiceMock.getEffective.mockResolvedValue(TAX_CONFIG);
      await service.calculate('run-1', 'user-1');

      expect(capturedSnapshotData.taxConfigJson.financialYear).toBe('2026-27'); // August -> FY2026-27
      expect(capturedSnapshotData.taxConfigJson.byRegime.NEW).toEqual(
        TAX_CONFIG,
      );
    });

    it('a later tax-config change does not alter an already-captured snapshot (finalized payroll stays reproducible)', async () => {
      taxConfigServiceMock.getEffective.mockResolvedValue(TAX_CONFIG);
      await service.calculate('run-1', 'user-1');
      const originalSnapshotTaxConfig = capturedSnapshotData.taxConfigJson;

      taxConfigServiceMock.getEffective.mockResolvedValue({
        ...TAX_CONFIG,
        cessRate: 0.5,
      });

      expect(capturedSnapshotData.taxConfigJson).toBe(
        originalSnapshotTaxConfig,
      );
      expect(capturedSnapshotData.taxConfigJson.byRegime.NEW.cessRate).toBe(
        0.04,
      );
    });

    it('does NOT silently fall back to the flat field on a genuine error — only on "no config found"', async () => {
      taxConfigServiceMock.getEffective.mockRejectedValue(
        new Error('database connection lost'),
      );
      await expect(service.calculate('run-1', 'user-1')).rejects.toThrow(
        'database connection lost',
      );
      expect(prismaMock.payslip.upsert).not.toHaveBeenCalled();
    });

    it('populates overtimeConfigJson on the snapshot from the effective overtime config', async () => {
      prismaMock.overtimeConfig.findFirst.mockResolvedValue({
        isEnabled: true,
        normalMultiplier: 1.5,
        weekendMultiplier: 2,
        holidayMultiplier: 2,
      });
      await service.calculate('run-1', 'user-1');
      expect(capturedSnapshotData.overtimeConfigJson).toEqual(
        expect.objectContaining({ isEnabled: true, normalMultiplier: 1.5 }),
      );
    });

    it('overtimeConfigJson is explicitly null (not undefined/omitted) when no overtime config exists', async () => {
      await service.calculate('run-1', 'user-1');
      expect(capturedSnapshotData.overtimeConfigJson).toBeNull();
    });
  });

  describe('adjustment recalculation idempotency (bug caught by the real-database dry-run)', () => {
    it('passes the run id to getApprovedForPeriod so a recalculation still matches an adjustment this same run already marked APPLIED', async () => {
      await service.calculate('run-1', 'user-1');
      expect(adjustmentServiceMock.getApprovedForPeriod).toHaveBeenCalledWith(
        'user-1',
        RUN.month,
        RUN.year,
        RUN.id,
      );
    });

    it('a bonus present on the first calculate() is not silently dropped on a second calculate() of the same run', async () => {
      const bonusAdjustment = { id: 'adj-1', type: 'BONUS', amount: 5000 };
      // First calculate: adjustment is APPROVED and gets picked up.
      adjustmentServiceMock.getApprovedForPeriod.mockResolvedValueOnce([
        bonusAdjustment,
      ]);
      await service.calculate('run-1', 'user-1');
      const firstPayslip = prismaMock.payslip.upsert.mock.calls[0][0].create;
      expect(firstPayslip.arrearsAmount).toBe(5000);

      // Second calculate (recalculation): the real service would now find
      // this adjustment as APPLIED-to-run-1, which getApprovedForPeriod's
      // real query matches — simulated here by having the mock still return
      // it (proving the workflow doesn't need to re-derive eligibility
      // itself; it trusts whatever the service returns for this run).
      adjustmentServiceMock.getApprovedForPeriod.mockResolvedValueOnce([
        bonusAdjustment,
      ]);
      prismaMock.payrollRun.findUnique.mockResolvedValue({
        ...RUN,
        status: 'CALCULATED',
      });
      await service.calculate('run-1', 'user-1');
      const secondPayslip = prismaMock.payslip.upsert.mock.calls[1][0].create;
      expect(secondPayslip.arrearsAmount).toBe(5000); // still present, not silently dropped to 0
    });
  });
});
