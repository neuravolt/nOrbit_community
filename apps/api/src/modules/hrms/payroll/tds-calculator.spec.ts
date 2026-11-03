import {
  calculateAnnualTax,
  calculateMonthlyTds,
  getFinancialYear,
} from './tds-calculator';

// Slab/surcharge/rebate values below are illustrative round numbers chosen to
// exercise the engine's logic (slab composition, rebate cliff, surcharge
// marginal relief, cess) — they are not asserted to be the exact current
// statutory FY figures. The engine takes whatever TaxRegimeConfig it's handed
// from the database; verifying that config against the real statute is an
// admin data-entry task, not something this pure function can check.
const BASE_CONFIG = {
  standardDeduction: 50000,
  rebateLimit: 700000,
  rebateAmount: 25000,
  cessRate: 0.04,
  slabs: [
    { incomeFrom: 0, incomeTo: 300000, taxRate: 0 },
    { incomeFrom: 300000, incomeTo: 700000, taxRate: 0.05 },
    { incomeFrom: 700000, incomeTo: 1000000, taxRate: 0.1 },
    { incomeFrom: 1000000, incomeTo: 1200000, taxRate: 0.15 },
    { incomeFrom: 1200000, incomeTo: 1500000, taxRate: 0.2 },
    { incomeFrom: 1500000, incomeTo: null, taxRate: 0.3 },
  ],
  surcharges: [
    { incomeFrom: 5000000, incomeTo: 10000000, surchargeRate: 0.1 },
    { incomeFrom: 10000000, incomeTo: 20000000, surchargeRate: 0.15 },
  ],
};

describe('calculateAnnualTax — basic slabs (Phase 3a shape)', () => {
  it('computes zero tax below the standard deduction + first slab', () => {
    const result = calculateAnnualTax(300000, 0, BASE_CONFIG);
    expect(result.totalAnnualTax).toBe(0);
  });

  it('applies the 87A rebate to zero out tax within the rebate limit', () => {
    const result = calculateAnnualTax(600000, 0, BASE_CONFIG);
    // taxable = 550000; slab tax = (550000-300000)*0.05 = 12500, fully rebated
    expect(result.baseTax).toBe(12500);
    expect(result.rebate).toBe(12500);
    expect(result.totalAnnualTax).toBe(0);
  });

  it('applies slab tax + cess once above the rebate limit', () => {
    const result = calculateAnnualTax(900000, 0, BASE_CONFIG);
    // taxable = 850000; slab tax = 400000*0.05 + 150000*0.1 = 20000+15000=35000
    expect(result.taxableIncomeAfterDeductions).toBe(850000);
    expect(result.baseTax).toBe(35000);
    expect(result.rebate).toBe(0); // above rebateLimit
    expect(result.cess).toBeCloseTo(35000 * 0.04);
    expect(result.totalAnnualTax).toBeCloseTo(35000 * 1.04);
  });
});

describe('calculateAnnualTax — exemptions (Phase 3b shape)', () => {
  it('reduces taxable income by declared exemptions/deductions', () => {
    const withoutExemption = calculateAnnualTax(900000, 0, BASE_CONFIG);
    const withExemption = calculateAnnualTax(900000, 150000, BASE_CONFIG); // e.g. 80C
    expect(withExemption.taxableIncomeAfterDeductions).toBe(
      withoutExemption.taxableIncomeAfterDeductions - 150000,
    );
    expect(withExemption.totalAnnualTax).toBeLessThan(
      withoutExemption.totalAnnualTax,
    );
  });
});

describe('calculateAnnualTax — surcharge + marginal relief (Phase 3c shape)', () => {
  it('applies no surcharge below the surcharge threshold', () => {
    const result = calculateAnnualTax(2000000, 0, BASE_CONFIG);
    expect(result.surcharge).toBe(0);
  });

  it('applies surcharge once income crosses the threshold', () => {
    const result = calculateAnnualTax(6000000, 0, BASE_CONFIG);
    expect(result.surcharge).toBeGreaterThan(0);
  });

  it('marginal relief caps total tax+surcharge just above a threshold from exceeding income above it', () => {
    // Income just barely above the 5,000,000 surcharge threshold — an
    // unrelieved 10% surcharge would cost more in tax than the extra income
    // itself. Marginal relief must prevent that.
    const atThreshold = calculateAnnualTax(5000000, 0, BASE_CONFIG);
    const justAbove = calculateAnnualTax(5000100, 0, BASE_CONFIG);
    const incomeDelta = 100;
    const taxDelta = justAbove.totalAnnualTax - atThreshold.totalAnnualTax;
    expect(taxDelta).toBeLessThanOrEqual(incomeDelta * 1.04 + 0.5); // + cess on the marginal rupee, small rounding slack
  });

  it('marginal relief is not applied when comfortably above the threshold', () => {
    const result = calculateAnnualTax(9000000, 0, BASE_CONFIG);
    expect(result.marginalReliefApplied).toBe(0);
    expect(result.surcharge).toBeCloseTo(result.taxAfterRebate * 0.1);
  });
});

describe('calculateMonthlyTds', () => {
  it('divides the annual tax evenly across 12 months', () => {
    const annual = calculateAnnualTax(900000, 0, BASE_CONFIG);
    const monthly = calculateMonthlyTds(annual);
    expect(monthly).toBeCloseTo(annual.totalAnnualTax / 12);
  });

  it('is zero when annual tax is zero', () => {
    const annual = calculateAnnualTax(300000, 0, BASE_CONFIG);
    expect(calculateMonthlyTds(annual)).toBe(0);
  });
});

describe('getFinancialYear', () => {
  it('April onward belongs to the FY starting that calendar year', () => {
    expect(getFinancialYear(4, 2026)).toBe('2026-27');
    expect(getFinancialYear(12, 2026)).toBe('2026-27');
  });

  it('January-March belongs to the FY that started the previous calendar year', () => {
    expect(getFinancialYear(1, 2027)).toBe('2026-27');
    expect(getFinancialYear(3, 2027)).toBe('2026-27');
  });

  it('rolls the short year over correctly across a century boundary', () => {
    expect(getFinancialYear(4, 2099)).toBe('2099-00');
  });
});
