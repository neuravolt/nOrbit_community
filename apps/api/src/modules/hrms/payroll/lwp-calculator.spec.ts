import { calculateLwp, DayRecord } from './lwp-calculator';

function days(spec: Array<[number, DayRecord['category']]>): DayRecord[] {
  const out: DayRecord[] = [];
  for (const [count, category] of spec) {
    for (let i = 0; i < count; i++)
      out.push({ date: `d${out.length}`, category });
  }
  return out;
}

describe('calculateLwp', () => {
  it('full month present: zero LWP, full payable days', () => {
    const result = calculateLwp({
      days: days([[30, 'PRESENT']]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(0);
    expect(result.payableDays).toBe(30);
    expect(result.prorationFactor).toBe(1);
  });

  it('holidays never become LWP', () => {
    const result = calculateLwp({
      days: days([
        [26, 'PRESENT'],
        [4, 'HOLIDAY'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.holidays).toBe(4);
    expect(result.lwpDays).toBe(0);
    expect(result.payableDays).toBe(30);
  });

  it('weekly offs never become LWP', () => {
    const result = calculateLwp({
      days: days([
        [22, 'PRESENT'],
        [8, 'WEEKLY_OFF'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.weeklyOffs).toBe(8);
    expect(result.lwpDays).toBe(0);
    expect(result.payableDays).toBe(30);
  });

  it('comp off never becomes LWP', () => {
    const result = calculateLwp({
      days: days([
        [29, 'PRESENT'],
        [1, 'COMP_OFF'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(0);
  });

  it('paid leave never becomes LWP', () => {
    const result = calculateLwp({
      days: days([
        [25, 'PRESENT'],
        [5, 'PAID_LEAVE'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.paidLeaveDays).toBe(5);
    expect(result.lwpDays).toBe(0);
    expect(result.payableDays).toBe(30);
  });

  it('unpaid leave and absence each count a full LWP day', () => {
    const result = calculateLwp({
      days: days([
        [25, 'PRESENT'],
        [3, 'UNPAID_LEAVE'],
        [2, 'ABSENT'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(5);
    expect(result.payableDays).toBe(25);
    expect(result.prorationFactor).toBeCloseTo(25 / 30);
  });

  it('half day counts as half an LWP day', () => {
    const result = calculateLwp({
      days: days([
        [28, 'PRESENT'],
        [2, 'HALF_DAY'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(1);
    expect(result.payableDays).toBe(29);
  });

  it('mid-month joining: days before joining count as LWP via NOT_JOINED', () => {
    const result = calculateLwp({
      days: days([
        [15, 'NOT_JOINED'],
        [15, 'PRESENT'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(15);
    expect(result.payableDays).toBe(15);
  });

  it('mid-month exit: days after exit count as LWP via AFTER_EXIT', () => {
    const result = calculateLwp({
      days: days([
        [20, 'PRESENT'],
        [10, 'AFTER_EXIT'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(10);
    expect(result.payableDays).toBe(20);
  });

  it('FIXED_26 base: LWP is scaled to the 26-day base, not the raw 31-day month', () => {
    // 31-day month, 2 unpaid-leave days out of 31 -> scaled to 26-day base
    const result = calculateLwp({
      days: days([
        [29, 'PRESENT'],
        [2, 'UNPAID_LEAVE'],
      ]),
      calculationBase: 'FIXED_26',
    });
    expect(result.payableDaysBase).toBe(26);
    expect(result.lwpDays).toBe(2); // raw count, unscaled
    expect(result.payableDays).toBeCloseTo(26 - (2 / 31) * 26);
  });

  it('optional holiday never becomes LWP', () => {
    const result = calculateLwp({
      days: days([
        [29, 'PRESENT'],
        [1, 'OPTIONAL_HOLIDAY'],
      ]),
      calculationBase: 'CALENDAR',
    });
    expect(result.lwpDays).toBe(0);
  });

  it('payable days never go negative even in a fully-LWP short period', () => {
    const result = calculateLwp({
      days: days([[5, 'ABSENT']]),
      calculationBase: 'FIXED_26',
    });
    expect(result.payableDays).toBeGreaterThanOrEqual(0);
  });
});
