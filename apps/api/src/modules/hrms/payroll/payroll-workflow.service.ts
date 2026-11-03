import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollConfigService } from '../services/payroll-config.service';
import { WorkingWeekService } from './working-week.service';
import { HolidayCalendarService } from './holiday-calendar.service';
import { PayrollAdjustmentService } from './payroll-adjustment.service';
import { TaxConfigService } from './tax-config.service';
import { buildDayRecords } from './day-record-builder';
import { calculateLwp, DayCategory } from './lwp-calculator';
import {
  calculateAnnualTax,
  calculateMonthlyTds,
  getFinancialYear,
} from './tds-calculator';
import {
  calculateEmployeePayroll,
  CALCULATION_ENGINE_VERSION,
  ComponentInput,
} from './payroll-calculation.engine';
import { DEFAULT_ROUNDING, DEFAULT_NET_PAY_ROUNDING } from './rounding';

// Section 18/20 — the workflow orchestrator: DRAFT -> CALCULATED -> REVIEW ->
// APPROVED -> FINALIZED -> LOCKED. This is the one place that reads live
// config/employee data, builds a PayrollRunSnapshot, and calls the pure
// calculateEmployeePayroll() engine once per employee — it does not implement
// any payroll arithmetic itself.
//
// A schema-driven limitation worth being explicit about: true per-day
// PAID_LEAVE/UNPAID_LEAVE categorization would need a per-day leave calendar
// table, which doesn't exist here — LeaveLedger is an aggregate ledger (a
// lump quantity per debit, not one row per calendar day), the same
// constraint the pre-existing legacy processPayrollRun already lives with.
// This engine gets precise day-level HOLIDAY/WEEKLY_OFF/PRESENT/ABSENT data
// (a real improvement over the legacy path, which had none), then merges in
// the existing aggregate unpaid-leave-ledger signal by taking whichever of
// the two produces more LWP days — the same "take the higher of two signals"
// heuristic the legacy code already uses, not a new invented precision.

function assertTransition(
  currentStatus: string,
  targetAction: string,
  allowedFrom: string[],
) {
  if (!allowedFrom.includes(currentStatus)) {
    throw new BadRequestException(
      `Cannot ${targetAction} a payroll run in status ${currentStatus}. Allowed from: ${allowedFrom.join(', ')}.`,
    );
  }
}

// See the call site in calculate() for why this fallback exists.
function synthesizeLegacyComponents(sal: {
  basicSalary: number;
  hra: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  daAllowance: number;
  otherAllowance: number;
}): ComponentInput[] {
  const fixed = (
    code: string,
    amount: number,
    pfApplicable: boolean,
  ): ComponentInput => ({
    component: {
      code,
      calcType: 'FIXED',
      fixedAmount: amount,
      percentage: null,
      formula: null,
      proratable: true,
      type: 'EARNING',
      pfApplicable,
      esiApplicable: true,
      ptApplicable: true,
      tdsApplicable: true,
    },
    override: null,
  });
  return [
    fixed('BASIC', sal.basicSalary, true),
    fixed('HRA', sal.hra, false),
    fixed('CONVEYANCE', sal.conveyanceAllowance, false),
    fixed('SPECIAL_ALLOWANCE', sal.specialAllowance, false),
    fixed('DA', sal.daAllowance, false),
    fixed('OTHER_ALLOWANCE', sal.otherAllowance, false),
  ].filter((c) => (c.component.fixedAmount ?? 0) > 0);
}

@Injectable()
export class PayrollWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollConfigService: PayrollConfigService,
    private readonly workingWeekService: WorkingWeekService,
    private readonly holidayCalendarService: HolidayCalendarService,
    private readonly adjustmentService: PayrollAdjustmentService,
    private readonly taxConfigService: TaxConfigService,
  ) {}

  async calculate(payrollRunId: string, userId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) throw new NotFoundException('Payroll run not found.');
    // DRAFT can be calculated for the first time; CALCULATED can be
    // recalculated (Section 20: "Draft can be recalculated"). Anything past
    // CALCULATED (REVIEW/APPROVED/FINALIZED/LOCKED/PAID/CANCELLED) is refused.
    assertTransition(run.status, 'calculate', ['DRAFT', 'CALCULATED']);

    const periodStart = new Date(run.year, run.month - 1, 1);
    const config = await this.payrollConfigService.getEffectiveConfig(
      run.organizationId,
      periodStart,
    );
    const workingWeek = await this.workingWeekService.getCurrent(
      run.organizationId,
    );
    // Gap-closure item 7: standard hours/day feeds the overtime hourly-rate
    // derivation and must not be a bare literal — OrganizationSettings
    // already carries exactly this org-level fact (workingHours), reused
    // here rather than duplicating it onto a payroll-specific model.
    const orgSettings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: run.organizationId },
    });
    const standardHoursPerDay = orgSettings?.workingHours ?? 8;

    const components = await this.prisma.salaryComponent.findMany({
      where: {
        OR: [{ organizationId: run.organizationId }, { organizationId: null }],
        isActive: true,
      },
    });

    // On a single-company install, employees added before they were tied to the organization
    // (organizationId empty) belong to it too; otherwise they were silently left out of payroll.
    const singleOrg = (await this.prisma.organization.count()) === 1;
    const activeSalaries = await this.prisma.employeeSalary.findMany({
      where: {
        status: 'ACTIVE',
        user: singleOrg
          ? {
              OR: [
                { organizationId: run.organizationId },
                { organizationId: null },
              ],
            }
          : { organizationId: run.organizationId },
      },
      include: { user: true },
    });

    // Overtime config is an org-level fact, not per-employee — hoisted out of
    // the per-employee loop below (it used to be re-fetched every iteration)
    // so it can be captured once in the snapshot and queried once total.
    const overtimeConfigRow = await this.prisma.overtimeConfig.findFirst({
      where: { organizationId: run.organizationId, isActive: true },
    });

    // P0 gap-closure: wire the real TaxRegimeConfig/slab/rebate/surcharge/
    // marginal-relief/cess engine into the actual calculation path instead of
    // the flat EmployeeSalary.tds field. Every regime actually present among
    // this run's active employees is resolved once, up front, so (a) it's
    // captured in the snapshot for reproducibility and (b) it isn't re-queried
    // once per employee. An org/regime with no TaxRegimeConfig configured
    // falls back to the flat field — a necessary fallback when no statutory
    // config exists to compute from, not a silent override of one that does.
    const financialYear = getFinancialYear(run.month, run.year);
    const distinctRegimes = Array.from(
      new Set(
        activeSalaries.map(
          (s) => (s as any).taxRegime ?? config.defaultTaxRegime ?? 'NEW',
        ),
      ),
    );
    const taxConfigsByRegime: Record<string, any> = {};
    for (const regimeType of distinctRegimes) {
      try {
        taxConfigsByRegime[regimeType] =
          await this.taxConfigService.getEffective(
            run.organizationId,
            financialYear,
            regimeType,
          );
      } catch (err) {
        // Only "no config exists for this regime/FY" is a legitimate reason
        // to fall back to the flat TDS field. Anything else (a DB error, a
        // bug) must fail the whole calculation loudly, not get silently
        // reinterpreted as "no config" and swallowed — that would be exactly
        // the fail-open pattern this codebase's payroll work has spent this
        // session eliminating elsewhere (worker fail-open, rubric fail-open).
        if (!(err instanceof NotFoundException)) throw err;
        taxConfigsByRegime[regimeType] = null;
      }
    }

    const snapshot = await this.prisma.payrollRunSnapshot.create({
      data: {
        payrollRunId: run.id,
        pfEmployeeRate: config.pfEmployeeRate,
        pfEmployerRate: config.pfEmployerRate,
        pfWageCeiling: config.pfWageCeiling,
        esiEmployeeRate: config.esiEmployeeRate,
        esiEmployerRate: config.esiEmployerRate,
        esiGrossCeiling: config.esiGrossCeiling,
        ptState: config.ptState,
        lwpCalculationBase: config.lwpCalculationBase,
        taxRegime: config.defaultTaxRegime,
        payrollConfigJson: config as any,
        salaryComponentsJson: components as any,
        employeeSalarySnapshotJson: activeSalaries.map((s) => ({
          id: s.id,
          userId: s.userId,
        })) as any,
        workingWeekJson: { ...workingWeek, standardHoursPerDay } as any,
        taxConfigJson: { financialYear, byRegime: taxConfigsByRegime } as any,
        overtimeConfigJson: (overtimeConfigRow ?? null) as any,
        calculationVersion: CALCULATION_ENGINE_VERSION,
        effectiveDate: periodStart,
        capturedBy: userId,
      },
    });

    const appliedAdjustmentIds: string[] = [];

    for (const sal of activeSalaries) {
      const assignments = await this.prisma.employeeSalaryComponent.findMany({
        where: { userId: sal.userId, isEligible: true },
        include: { component: true },
      });

      const calendar = await this.holidayCalendarService.getAssignedCalendar(
        sal.userId,
        periodStart,
      );
      const holidayMap = new Map<string, { isOptional: boolean }>();
      for (const h of calendar?.holidays ?? []) {
        const iso = new Date(h.date).toISOString().slice(0, 10);
        holidayMap.set(iso, { isOptional: h.isOptional });
      }

      const daysInMonth = new Date(run.year, run.month, 0).getDate();
      const periodEnd = new Date(run.year, run.month - 1, daysInMonth);
      const attendanceRecords = await this.prisma.attendance.findMany({
        where: {
          employeeId: sal.userId,
          date: { gte: periodStart, lte: periodEnd },
        },
      });
      const attendanceMap = new Map<
        string,
        {
          category: Exclude<
            DayCategory,
            | 'HOLIDAY'
            | 'OPTIONAL_HOLIDAY'
            | 'WEEKLY_OFF'
            | 'COMP_OFF'
            | 'NOT_JOINED'
            | 'AFTER_EXIT'
          >;
        }
      >();
      for (const a of attendanceRecords) {
        const iso = new Date(a.date).toISOString().slice(0, 10);
        if (a.status === 'PRESENT' || a.status === 'LATE')
          attendanceMap.set(iso, { category: 'PRESENT' });
        else if (a.status === 'HALF_DAY')
          attendanceMap.set(iso, { category: 'HALF_DAY' });
        else if (a.status === 'ABSENT')
          attendanceMap.set(iso, { category: 'ABSENT' });
      }

      const dayRecords = buildDayRecords({
        year: run.year,
        month: run.month,
        workingWeek: workingWeek as any,
        holidayDates: holidayMap,
        attendanceByDate: attendanceMap,
      });
      const dayLwp = calculateLwp({
        days: dayRecords,
        calculationBase: config.lwpCalculationBase,
      });

      const unpaidLeaveAgg = await this.prisma.leaveLedger.aggregate({
        where: {
          userId: sal.userId,
          leaveType: 'UNPAID',
          transactionType: 'LEAVE_DEBIT',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _sum: { quantity: true },
      });
      const ledgerLwpDays = Math.abs(Number(unpaidLeaveAgg._sum.quantity || 0));
      const lwpDays = Math.max(dayLwp.lwpDays, ledgerLwpDays);
      const payableDays = Math.max(0, dayLwp.payableDaysBase - lwpDays);
      const prorationFactor =
        dayLwp.payableDaysBase > 0 ? payableDays / dayLwp.payableDaysBase : 0;

      const context = {
        basic: sal.basicSalary,
        gross:
          sal.basicSalary +
          sal.hra +
          sal.conveyanceAllowance +
          sal.specialAllowance +
          sal.daAllowance +
          sal.otherAllowance,
        ctc: sal.ctc,
        hra: sal.hra,
      };

      // Section 28 backward-compatibility gap this integration test caught:
      // an employee with no dynamic SalaryComponent assignments yet (every
      // employee, until an org actively migrates onto the new system) must
      // still get a correct payslip through this new workflow, not a zero
      // gross pay. Fall back to synthesizing components from their existing
      // EmployeeSalary fixed fields, matching the legacy engine's own
      // PF/ESI/PT applicability (only basic feeds PF; basic+allowances feed
      // ESI/PT gross) until real components are assigned.
      const componentInputs: ComponentInput[] =
        assignments.length > 0
          ? assignments.map((a) => ({
              component: {
                code: a.component.code,
                calcType: a.component.calcType as any,
                fixedAmount: a.component.fixedAmount,
                percentage: a.component.percentage,
                formula: a.component.formula,
                proratable: a.component.proratable,
                type: a.component.type as any,
                pfApplicable: a.component.pfApplicable,
                esiApplicable: a.component.esiApplicable,
                ptApplicable: a.component.ptApplicable,
                tdsApplicable: a.component.tdsApplicable,
              },
              override: {
                amountOverride: a.amountOverride,
                percentageOverride: a.percentageOverride,
                isEligible: a.isEligible,
              },
            }))
          : synthesizeLegacyComponents(sal);

      const overtimeEntries = overtimeConfigRow?.isEnabled
        ? await this.prisma.overtimeEntry.findMany({
            where: {
              userId: sal.userId,
              date: { gte: periodStart, lte: periodEnd },
              status: 'APPROVED',
            },
          })
        : [];

      const pendingAdjustments =
        await this.adjustmentService.getApprovedForPeriod(
          sal.userId,
          run.month,
          run.year,
          run.id,
        );
      appliedAdjustmentIds.push(...pendingAdjustments.map((a) => a.id));

      // P0 gap-closure: statutory TDS via the real tax engine when the org has
      // configured a TaxRegimeConfig for this employee's regime/FY; otherwise
      // fall back to the flat EmployeeSalary.tds field (necessary fallback,
      // not a silent override — see the note above the taxConfigsByRegime
      // lookup). A manual correction, if one is genuinely needed on top of
      // either path, is a PayrollAdjustment (MANUAL_DEDUCTION/MANUAL_EARNING)
      // — an explicit, audited, approval-gated line item — not a value that
      // silently replaces the statutory calculation.
      const employeeRegime =
        (sal as any).taxRegime ?? config.defaultTaxRegime ?? 'NEW';
      const taxConfigForEmployee = taxConfigsByRegime[employeeRegime];
      let monthlyTds: number;
      let tdsSource: 'STATUTORY_ENGINE' | 'FLAT_FALLBACK';
      if (taxConfigForEmployee) {
        const exemptionAgg = await this.prisma.taxExemption.aggregate({
          where: { userId: sal.userId, financialYear },
          _sum: { approvedAmount: true, declaredAmount: true },
        });
        const exemptions = Number(
          exemptionAgg._sum.approvedAmount ??
            exemptionAgg._sum.declaredAmount ??
            0,
        );
        // Flat monthly-projection basis: reference fixed gross * 12 — the
        // same simplification documented in tds-calculator.ts.
        const annualProjectedIncome = context.gross * 12;
        const annualTax = calculateAnnualTax(
          annualProjectedIncome,
          exemptions,
          this.taxConfigService.toEngineInput(taxConfigForEmployee),
        );
        monthlyTds = calculateMonthlyTds(annualTax);
        tdsSource = 'STATUTORY_ENGINE';
      } else {
        monthlyTds = Number((sal as any).tds ?? 0);
        tdsSource = 'FLAT_FALLBACK';
      }

      const result = calculateEmployeePayroll({
        context,
        components: componentInputs,
        prorationFactor,
        payableDays,
        lwpDays,
        pfConfig: {
          enabled: config.pfEnabled,
          employeeRate: config.pfEmployeeRate,
          employerRate: config.pfEmployerRate,
          wageCeiling: config.pfWageCeiling,
          applyWageCap: config.pfApplyWageCap,
        },
        esiConfig: {
          enabled: config.esiEnabled,
          employeeRate: config.esiEmployeeRate,
          employerRate: config.esiEmployerRate,
          grossCeiling: config.esiGrossCeiling,
        },
        ptEnabled: config.ptEnabled,
        ptSlabs: config.ptSlabs,
        statutoryEligibility: {
          pfEligible: sal.pfApplicable,
          esiEligible: sal.esiApplicable,
        },
        statutoryOverrides: {
          pfWageCeilingOverride: (sal as any).pfWageCeiling,
          esiGrossCeilingOverride: (sal as any).esiGrossCeiling,
          ptOverride: (sal as any).professionalTaxOverride,
          voluntaryPfPercent: (sal as any).voluntaryPfPercent ?? 0,
        },
        overtimeEntries: overtimeEntries.map((e) => ({
          hours: e.hours,
          dayKind: e.dayKind as any,
          approved: true,
        })),
        overtimeConfig: overtimeConfigRow
          ? {
              isEnabled: overtimeConfigRow.isEnabled,
              normalMultiplier: overtimeConfigRow.normalMultiplier,
              weekendMultiplier: overtimeConfigRow.weekendMultiplier,
              holidayMultiplier: overtimeConfigRow.holidayMultiplier,
            }
          : undefined,
        standardHoursPerDay,
        calendarDaysInMonth: daysInMonth,
        monthlyTds,
        adjustments: pendingAdjustments.map((a) => ({
          type: PayrollAdjustmentService.isEarning(a.type)
            ? 'EARNING'
            : 'DEDUCTION',
          amount: a.amount,
        })),
        roundingConfig: DEFAULT_ROUNDING,
        netPayRoundingConfig: DEFAULT_NET_PAY_ROUNDING,
      });

      await this.prisma.payslip.upsert({
        where: {
          payrollRunId_userId: { payrollRunId: run.id, userId: sal.userId },
        },
        create: {
          payrollRunId: run.id,
          userId: sal.userId,
          basic: context.basic,
          hra: context.hra,
          grossPay: result.grossEarnings,
          allowances: result.grossEarnings - context.basic,
          pfEmployee: result.pfEmployee,
          pfEmployer: result.pfEmployer,
          esiEmployee: result.esiEmployee,
          esiEmployer: result.esiEmployer,
          professionalTax: result.professionalTax,
          tds: result.tds,
          lwpDays: result.lwpDays,
          lwpDeduction: Math.max(
            0,
            result.grossEarnings -
              result.netPay -
              result.pfEmployee -
              result.esiEmployee -
              result.professionalTax -
              result.tds,
          ),
          deductions: result.totalDeductions,
          workingDays: dayLwp.payableDaysBase,
          presentDays: dayLwp.presentDays,
          netPay: result.netPay,
          componentBreakdownJson: {
            earnings: result.earnings,
            deductions: result.deductions,
            tdsSource,
            taxRegime: employeeRegime,
            financialYear,
          } as any,
          overtimePay: result.overtimePay,
          arrearsAmount: result.adjustmentsEarningTotal,
          employerCost: result.employerCost,
          calculationVersion: result.calculationVersion,
          snapshotId: snapshot.id,
        },
        update: {
          basic: context.basic,
          hra: context.hra,
          grossPay: result.grossEarnings,
          pfEmployee: result.pfEmployee,
          pfEmployer: result.pfEmployer,
          esiEmployee: result.esiEmployee,
          esiEmployer: result.esiEmployer,
          professionalTax: result.professionalTax,
          tds: result.tds,
          lwpDays: result.lwpDays,
          deductions: result.totalDeductions,
          netPay: result.netPay,
          componentBreakdownJson: {
            earnings: result.earnings,
            deductions: result.deductions,
            tdsSource,
            taxRegime: employeeRegime,
            financialYear,
          } as any,
          overtimePay: result.overtimePay,
          arrearsAmount: result.adjustmentsEarningTotal,
          employerCost: result.employerCost,
          calculationVersion: result.calculationVersion,
          snapshotId: snapshot.id,
        },
      });
    }

    await this.adjustmentService.markApplied(appliedAdjustmentIds, run.id);

    return this.prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        status: 'CALCULATED',
        calculatedAt: new Date(),
        createdBy: run.createdBy ?? userId,
      },
    });
  }

  async review(payrollRunId: string) {
    const run = await this.getRunOrThrow(payrollRunId);
    assertTransition(run.status, 'review', ['CALCULATED']);
    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'REVIEW', reviewedAt: new Date() },
    });
  }

  async approve(payrollRunId: string, approverId: string) {
    const run = await this.getRunOrThrow(payrollRunId);
    assertTransition(run.status, 'approve', ['CALCULATED', 'REVIEW']);
    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: approverId,
      },
    });
  }

  async finalize(payrollRunId: string, finalizerId: string) {
    const run = await this.getRunOrThrow(payrollRunId);
    assertTransition(run.status, 'finalize', ['APPROVED']);
    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedBy: finalizerId,
      },
    });
  }

  async lock(payrollRunId: string, lockerId: string) {
    const run = await this.getRunOrThrow(payrollRunId);
    assertTransition(run.status, 'lock', ['FINALIZED']);
    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedBy: lockerId },
    });
  }

  private async getRunOrThrow(payrollRunId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) throw new NotFoundException('Payroll run not found.');
    return run;
  }
}
