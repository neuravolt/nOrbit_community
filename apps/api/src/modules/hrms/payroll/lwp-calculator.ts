// Section 13/14 — LWP and proration. The one rule everything else here exists
// to protect: a Holiday, Optional Holiday, Weekly Off, or Comp Off day must
// NEVER be counted as Loss-of-Pay just because the employee wasn't "present"
// that day. Only ABSENT, UNPAID_LEAVE, and (half-weighted) HALF_DAY reduce pay
// — everything else is either fully payable or outside the employment window.

export type DayCategory =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'HOLIDAY'
  | 'OPTIONAL_HOLIDAY'
  | 'WEEKLY_OFF'
  | 'COMP_OFF'
  | 'NOT_JOINED'
  | 'AFTER_EXIT';

export interface DayRecord {
  date: string; // ISO date, one entry per calendar day in the period
  category: DayCategory;
}

export type LwpCalculationBase = 'CALENDAR' | 'FIXED_26' | 'FIXED_30';

export interface LwpCalculationInput {
  days: DayRecord[];
  calculationBase: LwpCalculationBase;
}

export interface LwpCalculationResult {
  calendarDays: number;
  payableDaysBase: number;
  holidays: number;
  weeklyOffs: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lwpDays: number;
  payableDays: number;
  prorationFactor: number;
}

// The 26/30 here are not hardcoded statutory rates — they're the literal
// definition of the FIXED_26/FIXED_30 calculation-basis options themselves
// (an org picks "FIXED_26" specifically to mean "salary divided by 26",
// same as FIXED_30 means "divided by 30"). The actual configurable choice —
// which basis an org uses — lives in PayrollConfigVersion.lwpCalculationBase,
// read from the database like every other payroll config value.
function payableDaysBaseFor(
  calculationBase: LwpCalculationBase,
  calendarDays: number,
): number {
  switch (calculationBase) {
    case 'FIXED_26':
      return 26;
    case 'FIXED_30':
      return 30;
    case 'CALENDAR':
    default:
      return calendarDays;
  }
}

export function calculateLwp(input: LwpCalculationInput): LwpCalculationResult {
  const { days, calculationBase } = input;
  const calendarDays = days.length;

  let holidays = 0;
  let weeklyOffs = 0;
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let lwpDays = 0;

  for (const day of days) {
    switch (day.category) {
      case 'HOLIDAY':
      case 'OPTIONAL_HOLIDAY':
        holidays += 1;
        break;
      case 'WEEKLY_OFF':
      case 'COMP_OFF':
        weeklyOffs += 1;
        break;
      case 'PRESENT':
        presentDays += 1;
        break;
      case 'PAID_LEAVE':
        paidLeaveDays += 1;
        break;
      case 'HALF_DAY':
        halfDays += 1;
        lwpDays += 0.5;
        break;
      case 'UNPAID_LEAVE':
        unpaidLeaveDays += 1;
        lwpDays += 1;
        break;
      case 'ABSENT':
      case 'NOT_JOINED':
      case 'AFTER_EXIT':
        lwpDays += 1;
        break;
    }
  }

  const payableDaysBase = payableDaysBaseFor(calculationBase, calendarDays);
  // Scale LWP proportionally when the payable-days base differs from the
  // actual calendar length (FIXED_26/FIXED_30 bases), so a 31-day month on a
  // FIXED_26 base doesn't let LWP days exceed the base itself.
  const scaledLwp =
    calendarDays > 0 ? (lwpDays / calendarDays) * payableDaysBase : 0;
  const payableDays = Math.max(0, payableDaysBase - scaledLwp);
  const prorationFactor =
    payableDaysBase > 0 ? payableDays / payableDaysBase : 0;

  return {
    calendarDays,
    payableDaysBase,
    holidays,
    weeklyOffs,
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    lwpDays,
    payableDays,
    prorationFactor,
  };
}
