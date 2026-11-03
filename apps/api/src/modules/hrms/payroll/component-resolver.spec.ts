import {
  resolveComponentAmount,
  ResolvableComponent,
} from './component-resolver';

const ctx = { basic: 40000, gross: 65000, ctc: 900000, hra: 16000 };

function component(
  overrides: Partial<ResolvableComponent> = {},
): ResolvableComponent {
  return {
    code: 'TEST',
    calcType: 'FIXED',
    fixedAmount: 1000,
    percentage: null,
    formula: null,
    proratable: true,
    ...overrides,
  };
}

describe('resolveComponentAmount', () => {
  it('FIXED: returns the fixed amount', () => {
    expect(
      resolveComponentAmount(
        component({ calcType: 'FIXED', fixedAmount: 5000 }),
        null,
        ctx,
      ),
    ).toBe(5000);
  });

  it('PERCENTAGE_OF_BASIC: applies percentage to basic', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'PERCENTAGE_OF_BASIC', percentage: 0.1 }),
      null,
      ctx,
    );
    expect(result).toBe(4000); // 10% of basic
  });

  it('PERCENTAGE_OF_GROSS: applies percentage to gross', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'PERCENTAGE_OF_GROSS', percentage: 0.05 }),
      null,
      ctx,
    );
    expect(result).toBeCloseTo(3250);
  });

  it('PERCENTAGE_OF_CTC: applies percentage to monthly CTC', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'PERCENTAGE_OF_CTC', percentage: 0.02 }),
      null,
      ctx,
    );
    expect(result).toBeCloseTo(1500); // 900000/12 * 0.02
  });

  it('PER_DAY: multiplies per-day amount by days count', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'PER_DAY' }),
      null,
      ctx,
      {
        perDayAmount: 200,
        daysCount: 3,
      },
    );
    expect(result).toBe(600);
  });

  it('PER_HOUR: multiplies hourly rate by hours', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'PER_HOUR' }),
      null,
      ctx,
      {
        perHourAmount: 150,
        hoursCount: 4,
      },
    );
    expect(result).toBe(600);
  });

  it('TARGET_BASED: scales base amount by achievement ratio', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'TARGET_BASED' }),
      null,
      ctx,
      {
        targetBaseAmount: 10000,
        targetAchievementRatio: 1.2,
      },
    );
    expect(result).toBe(12000);
  });

  it('RATING_BASED: scales base amount by rating multiplier', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'RATING_BASED' }),
      null,
      ctx,
      {
        ratingBaseAmount: 8000,
        ratingMultiplier: 0.5,
      },
    );
    expect(result).toBe(4000);
  });

  it('MANUAL: uses the manually-approved amount verbatim', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'MANUAL' }),
      null,
      ctx,
      {
        manualApprovedAmount: 3333,
      },
    );
    expect(result).toBe(3333);
  });

  it('FORMULA: evaluates the configured formula against context', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'FORMULA', formula: 'min(hra, 0.5 * basic)' }),
      null,
      ctx,
    );
    expect(result).toBe(16000);
  });

  it('applies an employee-level amount override for FIXED components', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'FIXED', fixedAmount: 1000 }),
      { amountOverride: 2500, percentageOverride: null, isEligible: true },
      ctx,
    );
    expect(result).toBe(2500);
  });

  it('applies an employee-level percentage override', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'PERCENTAGE_OF_BASIC', percentage: 0.1 }),
      { amountOverride: null, percentageOverride: 0.2, isEligible: true },
      ctx,
    );
    expect(result).toBe(8000);
  });

  it('returns zero when the employee override marks the component ineligible', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'FIXED', fixedAmount: 5000 }),
      { amountOverride: null, percentageOverride: null, isEligible: false },
      ctx,
    );
    expect(result).toBe(0);
  });

  it('applies proration when the component is proratable', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'FIXED', fixedAmount: 3000, proratable: true }),
      null,
      ctx,
      {
        prorationFactor: 0.5,
      },
    );
    expect(result).toBe(1500);
  });

  it('ignores proration when the component is marked non-proratable', () => {
    const result = resolveComponentAmount(
      component({ calcType: 'FIXED', fixedAmount: 3000, proratable: false }),
      null,
      ctx,
      { prorationFactor: 0.5 },
    );
    expect(result).toBe(3000);
  });
});
