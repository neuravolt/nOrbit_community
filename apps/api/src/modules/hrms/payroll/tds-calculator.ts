// Section 10 — configurable income-tax/TDS engine. No hardcoded slabs: every
// number here comes from TaxRegimeConfig/TaxSlab/TaxSurchargeSlab, which are
// financial-year and regime versioned in the schema. This intentionally
// mirrors the 3-phase split from the plan's own risk review (basic slabs ->
// exemptions -> surcharge/cess/marginal relief) as three composable steps in
// one function, rather than three separate half-built engines.

export interface TaxSlabInput {
  incomeFrom: number;
  incomeTo: number | null;
  taxRate: number;
}

export interface SurchargeSlabInput {
  incomeFrom: number;
  incomeTo: number | null;
  surchargeRate: number;
}

export interface TaxRegimeConfigInput {
  standardDeduction: number;
  rebateLimit: number;
  rebateAmount: number;
  cessRate: number;
  slabs: TaxSlabInput[];
  surcharges: SurchargeSlabInput[];
}

export interface AnnualTaxResult {
  grossTaxableIncome: number;
  taxableIncomeAfterDeductions: number;
  baseTax: number;
  rebate: number;
  taxAfterRebate: number;
  surcharge: number;
  marginalReliefApplied: number;
  cess: number;
  totalAnnualTax: number;
}

function computeSlabTax(income: number, slabs: TaxSlabInput[]): number {
  if (income <= 0) return 0;
  const sorted = [...slabs].sort((a, b) => a.incomeFrom - b.incomeFrom);
  let tax = 0;
  for (const slab of sorted) {
    if (income <= slab.incomeFrom) continue;
    const upperBound = slab.incomeTo ?? Infinity;
    const taxableInSlab = Math.min(income, upperBound) - slab.incomeFrom;
    if (taxableInSlab > 0) tax += taxableInSlab * slab.taxRate;
  }
  return tax;
}

function findApplicableSurcharge(
  income: number,
  surcharges: SurchargeSlabInput[],
): SurchargeSlabInput | null {
  const sorted = [...surcharges].sort((a, b) => a.incomeFrom - b.incomeFrom);
  let applicable: SurchargeSlabInput | null = null;
  for (const slab of sorted) {
    if (income > slab.incomeFrom) applicable = slab;
  }
  return applicable;
}

export function calculateAnnualTax(
  grossTaxableIncome: number,
  exemptionsAndDeductions: number,
  config: TaxRegimeConfigInput,
): AnnualTaxResult {
  const taxableIncomeAfterDeductions = Math.max(
    0,
    grossTaxableIncome - config.standardDeduction - exemptionsAndDeductions,
  );

  const baseTax = computeSlabTax(taxableIncomeAfterDeductions, config.slabs);

  // Section 87A rebate: fully zeroes tax (up to rebateAmount) when taxable
  // income is at or below the rebate threshold.
  const rebate =
    taxableIncomeAfterDeductions <= config.rebateLimit
      ? Math.min(baseTax, config.rebateAmount)
      : 0;
  const taxAfterRebate = Math.max(0, baseTax - rebate);

  // Surcharge, with marginal relief: total tax+surcharge above a surcharge
  // threshold must never exceed (tax at the threshold + income above it) —
  // otherwise a rupee of extra income could cost more than a rupee in tax.
  const surchargeSlab = findApplicableSurcharge(
    taxableIncomeAfterDeductions,
    config.surcharges,
  );
  let surcharge = 0;
  let marginalReliefApplied = 0;
  if (surchargeSlab && taxAfterRebate > 0) {
    surcharge = taxAfterRebate * surchargeSlab.surchargeRate;
    const taxAtThreshold = computeSlabTax(
      surchargeSlab.incomeFrom,
      config.slabs,
    );
    const incomeAboveThreshold =
      taxableIncomeAfterDeductions - surchargeSlab.incomeFrom;
    const uncappedTotal = taxAfterRebate + surcharge;
    const cappedTotal = taxAtThreshold + incomeAboveThreshold;
    if (uncappedTotal > cappedTotal) {
      marginalReliefApplied = uncappedTotal - cappedTotal;
      surcharge = Math.max(0, surcharge - marginalReliefApplied);
    }
  }

  const cess = (taxAfterRebate + surcharge) * config.cessRate;
  const totalAnnualTax =
    Math.round((taxAfterRebate + surcharge + cess) * 100) / 100;

  return {
    grossTaxableIncome,
    taxableIncomeAfterDeductions,
    baseTax: Math.round(baseTax * 100) / 100,
    rebate: Math.round(rebate * 100) / 100,
    taxAfterRebate: Math.round(taxAfterRebate * 100) / 100,
    surcharge: Math.round(surcharge * 100) / 100,
    marginalReliefApplied: Math.round(marginalReliefApplied * 100) / 100,
    cess: Math.round(cess * 100) / 100,
    totalAnnualTax,
  };
}

// Flat monthly projection — the same simplification the plan's own worked
// example uses ("Monthly TDS = ... / slabs / 12"). A precise mid-year
// catch-up recompute (projecting annualized income from months elapsed and
// adjusting future months) is a real refinement or real payroll systems make,
// but is out of scope here — documented in the implementation report.
export function calculateMonthlyTds(annualTaxResult: AnnualTaxResult): number {
  return Math.round((annualTaxResult.totalAnnualTax / 12) * 100) / 100;
}

// Indian financial year runs April -> March. Payroll month 1-3 (Jan-Mar)
// belongs to the FY that started the previous calendar year; month 4-12
// (Apr-Dec) belongs to the FY starting that same calendar year.
export function getFinancialYear(month: number, year: number): string {
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
}
