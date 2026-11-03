import {
  resolveComponentAmount,
  ResolvableComponent,
  ComponentOverride,
  ComponentResolutionExtras,
} from './component-resolver';
import {
  calculatePf,
  calculateEsi,
  calculatePt,
  PfConfig,
  EsiConfig,
  PtSlab,
} from './statutory-calculator';
import {
  calculateOvertimePay,
  hourlyRateFromBasic,
  OvertimeConfigInput,
  OvertimeEntryInput,
} from './overtime-calculator';
import {
  applyRounding,
  RoundingConfig,
  DEFAULT_ROUNDING,
  DEFAULT_NET_PAY_ROUNDING,
} from './rounding';
import { FormulaContext } from './formula-engine';

// Section 18 — the one centralized, deterministic payroll calculation engine.
// Every payroll formula in the system (component resolution, PF/ESI/PT,
// overtime, rounding) is composed here rather than scattered across
// controllers/services; TDS is the one exception, taken as a pre-computed
// monthly figure — annual tax projection needs year-to-date income this
// single-month function doesn't have, so that composition happens one layer
// up, in the service that calls this engine once per employee per month.
//
// A note on `context.gross` for PERCENTAGE_OF_GROSS components: it is the
// employee's *fixed* reference gross (sum of MONTHLY-frequency earnings,
// resolved before this call), not the fully-resolved gross including this
// month's variable pay — resolving it from the final gross would be
// circular. This mirrors how "percentage of gross" is conventionally defined
// on Indian payroll (against the fixed CTC-derived gross), and is documented
// here rather than left implicit.

export const CALCULATION_ENGINE_VERSION = '1.0.0';

export interface ComponentInput {
  component: ResolvableComponent & {
    type: 'EARNING' | 'DEDUCTION';
    pfApplicable: boolean;
    esiApplicable: boolean;
    ptApplicable: boolean;
    tdsApplicable: boolean;
  };
  override: ComponentOverride | null;
  extras?: ComponentResolutionExtras;
}

export interface EmployeeStatutoryEligibility {
  pfEligible: boolean;
  esiEligible: boolean;
}

export interface EmployeeStatutoryOverrides {
  pfWageCeilingOverride?: number;
  esiGrossCeilingOverride?: number;
  ptOverride?: number | null;
  voluntaryPfPercent?: number;
}

export interface PayrollCalculationInput {
  context: FormulaContext; // basic/gross(fixed reference)/ctc/hra
  components: ComponentInput[];
  prorationFactor: number; // 0..1, from calculateLwp
  payableDays: number;
  lwpDays: number;

  pfConfig: PfConfig;
  esiConfig: EsiConfig;
  ptEnabled: boolean;
  ptSlabs: PtSlab[];
  statutoryEligibility: EmployeeStatutoryEligibility;
  statutoryOverrides?: EmployeeStatutoryOverrides;

  overtimeEntries?: OvertimeEntryInput[];
  overtimeConfig?: OvertimeConfigInput;
  standardHoursPerDay?: number;
  calendarDaysInMonth?: number;

  monthlyTds: number;

  adjustments?: Array<{ type: 'EARNING' | 'DEDUCTION'; amount: number }>;

  roundingConfig?: RoundingConfig;
  netPayRoundingConfig?: RoundingConfig;
}

export interface PayrollCalculationResult {
  calculationVersion: string;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  grossEarnings: number;
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  overtimePay: number;
  overtimeHours: number;
  adjustmentsEarningTotal: number;
  adjustmentsDeductionTotal: number;
  totalDeductions: number;
  netPay: number;
  payableDays: number;
  lwpDays: number;
  employerCost: number;
}

export function calculateEmployeePayroll(
  input: PayrollCalculationInput,
): PayrollCalculationResult {
  const rounding = input.roundingConfig ?? DEFAULT_ROUNDING;
  const netPayRounding = input.netPayRoundingConfig ?? DEFAULT_NET_PAY_ROUNDING;

  const earnings: Record<string, number> = {};
  const deductions: Record<string, number> = {};

  let pfApplicableBase = 0;
  let esiApplicableGross = 0;
  let ptApplicableGross = 0;

  for (const { component, override, extras } of input.components) {
    const amount = applyRounding(
      resolveComponentAmount(component, override, input.context, {
        ...extras,
        prorationFactor: input.prorationFactor,
      }),
      rounding,
    );

    if (component.type === 'EARNING') {
      earnings[component.code] = amount;
      if (component.pfApplicable) pfApplicableBase += amount;
      if (component.esiApplicable) esiApplicableGross += amount;
      if (component.ptApplicable) ptApplicableGross += amount;
    } else {
      deductions[component.code] = amount;
    }
  }

  const grossEarnings = applyRounding(
    Object.values(earnings).reduce((sum, v) => sum + v, 0),
    rounding,
  );
  if (
    Object.keys(earnings).length === 0 ||
    !input.components.some((c) => c.component.ptApplicable)
  ) {
    // No component was flagged PT-applicable — fall back to gross earnings,
    // matching the pre-existing behavior where PT was always computed on
    // full gross rather than requiring explicit per-component tagging.
    ptApplicableGross = grossEarnings;
  }

  const { pfEmployee, pfEmployer } = calculatePf(
    pfApplicableBase,
    input.statutoryEligibility.pfEligible,
    input.pfConfig,
    input.statutoryOverrides?.voluntaryPfPercent ?? 0,
    input.statutoryOverrides?.pfWageCeilingOverride,
  );

  const { esiEmployee, esiEmployer } = calculateEsi(
    esiApplicableGross || grossEarnings,
    input.statutoryEligibility.esiEligible,
    input.esiConfig,
    input.statutoryOverrides?.esiGrossCeilingOverride,
  );

  const professionalTax = calculatePt(
    ptApplicableGross,
    input.ptEnabled,
    input.ptSlabs,
    input.statutoryOverrides?.ptOverride,
  );

  let overtimePay = 0;
  let overtimeHours = 0;
  if (input.overtimeConfig && input.overtimeEntries?.length) {
    const rate = hourlyRateFromBasic(
      input.context.basic,
      input.standardHoursPerDay ?? 8,
      input.calendarDaysInMonth ?? 30,
    );
    const result = calculateOvertimePay(
      input.overtimeEntries,
      rate,
      input.overtimeConfig,
    );
    overtimePay = result.totalPay;
    overtimeHours = result.totalHours;
  }

  const adjustments = input.adjustments ?? [];
  const adjustmentsEarningTotal = applyRounding(
    adjustments
      .filter((a) => a.type === 'EARNING')
      .reduce((sum, a) => sum + a.amount, 0),
    rounding,
  );
  const adjustmentsDeductionTotal = applyRounding(
    adjustments
      .filter((a) => a.type === 'DEDUCTION')
      .reduce((sum, a) => sum + a.amount, 0),
    rounding,
  );

  const totalDeductionsBeforeTds =
    pfEmployee +
    esiEmployee +
    professionalTax +
    Object.values(deductions).reduce((sum, v) => sum + v, 0) +
    adjustmentsDeductionTotal;
  const totalDeductions = applyRounding(
    totalDeductionsBeforeTds + input.monthlyTds,
    rounding,
  );

  const netPay = applyRounding(
    Math.max(
      0,
      grossEarnings + overtimePay + adjustmentsEarningTotal - totalDeductions,
    ),
    netPayRounding,
  );

  const employerCost = applyRounding(
    grossEarnings + overtimePay + pfEmployer + esiEmployer,
    rounding,
  );

  return {
    calculationVersion: CALCULATION_ENGINE_VERSION,
    earnings,
    deductions,
    grossEarnings,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    professionalTax,
    tds: input.monthlyTds,
    overtimePay,
    overtimeHours,
    adjustmentsEarningTotal,
    adjustmentsDeductionTotal,
    totalDeductions,
    netPay,
    payableDays: input.payableDays,
    lwpDays: input.lwpDays,
    employerCost,
  };
}
