import {
  calculateOvertimePay,
  hourlyRateFromBasic,
} from './overtime-calculator';

describe('hourlyRateFromBasic', () => {
  it('derives hourly rate from basic / (standard hours * calendar days)', () => {
    expect(hourlyRateFromBasic(24000, 8, 30)).toBe(100); // 24000 / 240
  });

  it('returns 0 for a degenerate zero-day input rather than dividing by zero', () => {
    expect(hourlyRateFromBasic(24000, 8, 0)).toBe(0);
  });
});

describe('calculateOvertimePay', () => {
  const config = {
    isEnabled: true,
    normalMultiplier: 1.5,
    weekendMultiplier: 2.0,
    holidayMultiplier: 2.0,
  };
  const hourlyRate = 100;

  it('applies 1.5x for normal-day overtime', () => {
    const result = calculateOvertimePay(
      [{ hours: 4, dayKind: 'NORMAL', approved: true }],
      hourlyRate,
      config,
    );
    expect(result.totalPay).toBe(600); // 4 * 100 * 1.5
  });

  it('applies the holiday multiplier for holiday overtime', () => {
    const result = calculateOvertimePay(
      [{ hours: 3, dayKind: 'HOLIDAY', approved: true }],
      hourlyRate,
      config,
    );
    expect(result.totalPay).toBe(600); // 3 * 100 * 2.0
  });

  it('excludes unapproved entries entirely', () => {
    const result = calculateOvertimePay(
      [
        { hours: 4, dayKind: 'NORMAL', approved: true },
        { hours: 10, dayKind: 'NORMAL', approved: false },
      ],
      hourlyRate,
      config,
    );
    expect(result.totalHours).toBe(4);
    expect(result.totalPay).toBe(600);
  });

  it('returns zero when overtime is disabled at the org level, even with approved entries', () => {
    const result = calculateOvertimePay(
      [{ hours: 4, dayKind: 'NORMAL', approved: true }],
      hourlyRate,
      { ...config, isEnabled: false },
    );
    expect(result.totalPay).toBe(0);
    expect(result.totalHours).toBe(0);
  });

  it('sums multiple entries across different day kinds', () => {
    const result = calculateOvertimePay(
      [
        { hours: 2, dayKind: 'NORMAL', approved: true },
        { hours: 3, dayKind: 'WEEKEND', approved: true },
      ],
      hourlyRate,
      config,
    );
    // 2*100*1.5 + 3*100*2.0 = 300 + 600 = 900
    expect(result.totalPay).toBe(900);
    expect(result.totalHours).toBe(5);
  });
});
