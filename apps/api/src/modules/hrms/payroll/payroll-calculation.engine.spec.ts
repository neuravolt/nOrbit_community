import {
  calculateEmployeePayroll,
  ComponentInput,
} from './payroll-calculation.engine';

const ctx = { basic: 40000, gross: 60000, ctc: 900000, hra: 16000 };

const pfConfig = {
  enabled: true,
  employeeRate: 0.12,
  employerRate: 0.12,
  wageCeiling: 15000,
  applyWageCap: true,
};
const esiConfig = {
  enabled: true,
  employeeRate: 0.0075,
  employerRate: 0.0325,
  grossCeiling: 21000,
};
const ptSlabs = [
  { upTo: 14999, amount: 0 },
  { upTo: 19999, amount: 150 },
  { upTo: 9999999, amount: 200 },
];

function basicComponent(): ComponentInput {
  return {
    component: {
      code: 'BASIC',
      calcType: 'FIXED',
      fixedAmount: 40000,
      percentage: null,
      formula: null,
      proratable: true,
      type: 'EARNING',
      pfApplicable: true,
      esiApplicable: true,
      ptApplicable: true,
      tdsApplicable: true,
    },
    override: null,
  };
}

function hraComponent(): ComponentInput {
  return {
    component: {
      code: 'HRA',
      calcType: 'PERCENTAGE_OF_BASIC',
      fixedAmount: null,
      percentage: 0.4,
      formula: null,
      proratable: true,
      type: 'EARNING',
      pfApplicable: false,
      esiApplicable: true,
      ptApplicable: true,
      tdsApplicable: true,
    },
    override: null,
  };
}

describe('calculateEmployeePayroll — full month, no LWP', () => {
  it('computes gross, PF, ESI (blocked by ceiling), PT, and net pay', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent(), hraComponent()],
      prorationFactor: 1,
      payableDays: 30,
      lwpDays: 0,
      pfConfig,
      esiConfig,
      ptEnabled: true,
      ptSlabs,
      statutoryEligibility: { pfEligible: true, esiEligible: true },
      monthlyTds: 0,
    });

    expect(result.earnings.BASIC).toBe(40000);
    expect(result.earnings.HRA).toBe(16000);
    expect(result.grossEarnings).toBe(56000);
    expect(result.pfEmployee).toBe(1800); // capped at wage ceiling 15000 * 12%
    expect(result.esiEmployee).toBe(0); // gross 56000 > 21000 ceiling
    expect(result.professionalTax).toBe(200); // top slab
    expect(result.netPay).toBe(56000 - 1800 - 200);
  });
});

describe('calculateEmployeePayroll — LWP proration', () => {
  it('prorates all proratable earnings by the LWP proration factor', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent(), hraComponent()],
      prorationFactor: 0.5,
      payableDays: 15,
      lwpDays: 15,
      pfConfig,
      esiConfig,
      ptEnabled: true,
      ptSlabs,
      statutoryEligibility: { pfEligible: true, esiEligible: true },
      monthlyTds: 0,
    });

    expect(result.earnings.BASIC).toBe(20000);
    expect(result.earnings.HRA).toBe(8000);
    expect(result.grossEarnings).toBe(28000);
    expect(result.payableDays).toBe(15);
    expect(result.lwpDays).toBe(15);
  });

  it('does not prorate a component explicitly marked non-proratable', () => {
    const fixedAllowance: ComponentInput = {
      component: {
        code: 'FIXED_ALLOWANCE',
        calcType: 'FIXED',
        fixedAmount: 1000,
        percentage: null,
        formula: null,
        proratable: false,
        type: 'EARNING',
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: false,
        tdsApplicable: true,
      },
      override: null,
    };
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [fixedAllowance],
      prorationFactor: 0.5,
      payableDays: 15,
      lwpDays: 15,
      pfConfig,
      esiConfig,
      ptEnabled: true,
      ptSlabs,
      statutoryEligibility: { pfEligible: false, esiEligible: false },
      monthlyTds: 0,
    });
    expect(result.earnings.FIXED_ALLOWANCE).toBe(1000);
  });
});

describe('calculateEmployeePayroll — statutory eligibility gates', () => {
  it('applies zero PF/ESI when the employee is not eligible, even with applicable components', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent()],
      prorationFactor: 1,
      payableDays: 30,
      lwpDays: 0,
      pfConfig,
      esiConfig,
      ptEnabled: true,
      ptSlabs,
      statutoryEligibility: { pfEligible: false, esiEligible: false },
      monthlyTds: 0,
    });
    expect(result.pfEmployee).toBe(0);
    expect(result.esiEmployee).toBe(0);
  });
});

describe('calculateEmployeePayroll — TDS, overtime, adjustments flow through to net pay', () => {
  it('includes monthly TDS in total deductions', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent()],
      prorationFactor: 1,
      payableDays: 30,
      lwpDays: 0,
      pfConfig,
      esiConfig,
      ptEnabled: false,
      ptSlabs,
      statutoryEligibility: { pfEligible: false, esiEligible: false },
      monthlyTds: 2500,
    });
    expect(result.tds).toBe(2500);
    expect(result.totalDeductions).toBeGreaterThanOrEqual(2500);
    expect(result.netPay).toBe(40000 - 2500);
  });

  it('adds approved overtime pay into net pay', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent()],
      prorationFactor: 1,
      payableDays: 30,
      lwpDays: 0,
      pfConfig,
      esiConfig,
      ptEnabled: false,
      ptSlabs,
      statutoryEligibility: { pfEligible: false, esiEligible: false },
      monthlyTds: 0,
      overtimeEntries: [{ hours: 4, dayKind: 'NORMAL', approved: true }],
      overtimeConfig: {
        isEnabled: true,
        normalMultiplier: 1.5,
        weekendMultiplier: 2,
        holidayMultiplier: 2,
      },
      standardHoursPerDay: 8,
      calendarDaysInMonth: 30,
    });
    // hourly rate = 40000 / (8*30) = 166.67; OT = 4 * 166.67 * 1.5 ≈ 1000
    expect(result.overtimePay).toBeCloseTo(1000, 0);
    expect(result.netPay).toBeCloseTo(40000 + result.overtimePay, 0);
  });

  it('applies a manual earning adjustment (e.g. arrears) into net pay, and a manual deduction against it', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent()],
      prorationFactor: 1,
      payableDays: 30,
      lwpDays: 0,
      pfConfig,
      esiConfig,
      ptEnabled: false,
      ptSlabs,
      statutoryEligibility: { pfEligible: false, esiEligible: false },
      monthlyTds: 0,
      adjustments: [
        { type: 'EARNING', amount: 5000 }, // arrears
        { type: 'DEDUCTION', amount: 1000 }, // e.g. loan recovery
      ],
    });
    expect(result.adjustmentsEarningTotal).toBe(5000);
    expect(result.adjustmentsDeductionTotal).toBe(1000);
    expect(result.netPay).toBe(40000 + 5000 - 1000);
  });
});

describe('calculateEmployeePayroll — employer cost', () => {
  it('includes employer PF/ESI contributions in employer cost but not employee net pay', () => {
    const result = calculateEmployeePayroll({
      context: ctx,
      components: [basicComponent()],
      prorationFactor: 1,
      payableDays: 30,
      lwpDays: 0,
      pfConfig,
      esiConfig,
      ptEnabled: false,
      ptSlabs,
      statutoryEligibility: { pfEligible: true, esiEligible: true },
      monthlyTds: 0,
    });
    expect(result.employerCost).toBe(
      result.grossEarnings + result.pfEmployer + result.esiEmployer,
    );
    expect(result.netPay).toBeLessThan(result.employerCost);
  });
});

describe('calculateEmployeePayroll — determinism', () => {
  it('produces identical output for identical input, twice in a row', () => {
    const inputBuilder = () => ({
      context: ctx,
      components: [basicComponent(), hraComponent()],
      prorationFactor: 0.9,
      payableDays: 27,
      lwpDays: 3,
      pfConfig,
      esiConfig,
      ptEnabled: true,
      ptSlabs,
      statutoryEligibility: { pfEligible: true, esiEligible: true },
      monthlyTds: 1234,
    });
    const first = calculateEmployeePayroll(inputBuilder());
    const second = calculateEmployeePayroll(inputBuilder());
    expect(first).toEqual(second);
  });
});
