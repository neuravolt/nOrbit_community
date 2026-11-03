import { PayrollFormulaEngine, FormulaContext } from './formula-engine';

// Sections 4/5/6 — resolves one SalaryComponent (+ optional per-employee
// override) into a rupee amount for the period. This is the one place
// calcType is switched on; the calculation engine itself never hardcodes a
// component's behavior by name/code.

export type SalaryComponentCalcType =
  | 'FIXED'
  | 'PERCENTAGE_OF_BASIC'
  | 'PERCENTAGE_OF_GROSS'
  | 'PERCENTAGE_OF_CTC'
  | 'PER_DAY'
  | 'PER_HOUR'
  | 'TARGET_BASED'
  | 'RATING_BASED'
  | 'MANUAL'
  | 'FORMULA';

export interface ResolvableComponent {
  code: string;
  calcType: SalaryComponentCalcType;
  fixedAmount: number | null;
  percentage: number | null;
  formula: string | null;
  proratable: boolean;
}

export interface ComponentOverride {
  amountOverride: number | null;
  percentageOverride: number | null;
  isEligible: boolean;
}

// Calc-type-specific inputs the caller supplies per employee/period. Only the
// fields relevant to the component's own calcType are read.
export interface ComponentResolutionExtras {
  perDayAmount?: number;
  daysCount?: number;
  perHourAmount?: number;
  hoursCount?: number;
  targetAchievementRatio?: number; // 0..N, e.g. 1.2 = 120% of target
  targetBaseAmount?: number;
  ratingMultiplier?: number; // e.g. a 1-5 rating mapped to a 0..1.5 payout multiplier upstream
  ratingBaseAmount?: number;
  manualApprovedAmount?: number;
  /** 0..1 — applied at the end, only when the component is proratable. */
  prorationFactor?: number;
}

export function resolveComponentAmount(
  component: ResolvableComponent,
  override: ComponentOverride | null,
  context: FormulaContext,
  extras: ComponentResolutionExtras = {},
): number {
  if (override && !override.isEligible) return 0;

  const effectivePercentage =
    override?.percentageOverride ?? component.percentage ?? 0;
  const effectiveFixed = override?.amountOverride ?? component.fixedAmount ?? 0;

  let raw: number;
  switch (component.calcType) {
    case 'FIXED':
      raw = effectiveFixed;
      break;
    case 'PERCENTAGE_OF_BASIC':
      raw = context.basic * effectivePercentage;
      break;
    case 'PERCENTAGE_OF_GROSS':
      raw = context.gross * effectivePercentage;
      break;
    case 'PERCENTAGE_OF_CTC':
      raw = (context.ctc / 12) * effectivePercentage;
      break;
    case 'PER_DAY':
      raw = (extras.perDayAmount ?? 0) * (extras.daysCount ?? 0);
      break;
    case 'PER_HOUR':
      raw = (extras.perHourAmount ?? 0) * (extras.hoursCount ?? 0);
      break;
    case 'TARGET_BASED':
      raw =
        (extras.targetBaseAmount ?? 0) * (extras.targetAchievementRatio ?? 0);
      break;
    case 'RATING_BASED':
      raw = (extras.ratingBaseAmount ?? 0) * (extras.ratingMultiplier ?? 0);
      break;
    case 'MANUAL':
      raw = extras.manualApprovedAmount ?? 0;
      break;
    case 'FORMULA':
      raw = component.formula
        ? PayrollFormulaEngine.evaluate(component.formula, context)
        : 0;
      break;
    default:
      raw = 0;
  }

  const prorationFactor = component.proratable
    ? (extras.prorationFactor ?? 1)
    : 1;
  return Math.round(raw * prorationFactor * 100) / 100;
}
