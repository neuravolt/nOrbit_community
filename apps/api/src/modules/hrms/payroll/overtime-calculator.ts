// Section 15 — overtime pay. Hourly rate is derived from the employee's own
// basic (the conventional Indian-payroll definition: basic / (calendar days *
// standard hours/day)) rather than a separately-configured number, so it
// stays consistent with whatever basic the SalaryComponent engine resolved
// for that month.

export type OvertimeDayKind = 'NORMAL' | 'WEEKEND' | 'HOLIDAY';

export interface OvertimeConfigInput {
  isEnabled: boolean;
  normalMultiplier: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
}

export interface OvertimeEntryInput {
  hours: number;
  dayKind: OvertimeDayKind;
  approved: boolean;
}

export function hourlyRateFromBasic(
  basic: number,
  standardHoursPerDay: number,
  calendarDays: number,
): number {
  const totalStandardHours = standardHoursPerDay * calendarDays;
  if (totalStandardHours <= 0) return 0;
  return basic / totalStandardHours;
}

function multiplierFor(
  dayKind: OvertimeDayKind,
  config: OvertimeConfigInput,
): number {
  switch (dayKind) {
    case 'WEEKEND':
      return config.weekendMultiplier;
    case 'HOLIDAY':
      return config.holidayMultiplier;
    case 'NORMAL':
    default:
      return config.normalMultiplier;
  }
}

export function calculateOvertimePay(
  entries: OvertimeEntryInput[],
  hourlyRate: number,
  config: OvertimeConfigInput,
): { totalHours: number; totalPay: number } {
  if (!config.isEnabled) return { totalHours: 0, totalPay: 0 };

  let totalHours = 0;
  let totalPay = 0;
  for (const entry of entries) {
    if (!entry.approved) continue;
    const multiplier = multiplierFor(entry.dayKind, config);
    totalHours += entry.hours;
    totalPay += entry.hours * hourlyRate * multiplier;
  }
  return { totalHours, totalPay: Math.round(totalPay * 100) / 100 };
}
