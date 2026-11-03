import { calculatePf, calculateEsi, calculatePt } from './statutory-calculator';

// Gap-closure item 3/5 — "old payroll vs new payroll compatibility". Before
// this pass, hrms.service.ts's processPayrollRun had its own inline PF/ESI/PT
// arithmetic, duplicating statutory-calculator.ts's logic; that inline code
// has now been replaced with direct calls to calculatePf/calculateEsi/
// calculatePt, so the legacy path and the new component-driven engine share
// exactly one implementation of the dangerous statutory math and cannot
// silently drift apart.
//
// This test proves the refactor didn't change legacy's output: each helper
// below is a frozen, byte-for-byte copy of the ORIGINAL inline formula
// (before the refactor), and every case asserts the shared function produces
// an identical result to it, across a representative input matrix.

function legacyPf(
  basic: number,
  pfEnabled: boolean,
  pfApplicable: boolean,
  cfg: any,
  sal: any,
) {
  let pfEmployee = 0;
  let pfEmployer = 0;
  if (pfEnabled && pfApplicable) {
    const salPfCeil = sal.pfWageCeiling;
    const effectiveCeil = salPfCeil ?? cfg.pfWageCeiling;
    const pfBase = cfg.pfApplyWageCap ? Math.min(basic, effectiveCeil) : basic;
    const voluntaryPct = sal.voluntaryPfPercent ?? 0;
    pfEmployee = Number(
      (pfBase * (cfg.pfEmployeeRate + voluntaryPct / 100)).toFixed(2),
    );
    pfEmployer = Number((pfBase * cfg.pfEmployerRate).toFixed(2));
  }
  return { pfEmployee, pfEmployer };
}

function legacyEsi(
  grossEarned: number,
  esiEnabled: boolean,
  esiApplicable: boolean,
  cfg: any,
  sal: any,
) {
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (esiEnabled && esiApplicable) {
    const salEsiCeil = sal.esiGrossCeiling;
    const effectiveEsiCeil = salEsiCeil ?? cfg.esiGrossCeiling;
    if (grossEarned <= effectiveEsiCeil) {
      esiEmployee = Number((grossEarned * cfg.esiEmployeeRate).toFixed(2));
      esiEmployer = Number((grossEarned * cfg.esiEmployerRate).toFixed(2));
    }
  }
  return { esiEmployee, esiEmployer };
}

function legacyPt(grossEarned: number, ptEnabled: boolean, cfg: any, sal: any) {
  let professionalTax = 0;
  if (ptEnabled) {
    const ptOverride = sal.professionalTaxOverride;
    if (ptOverride !== null && ptOverride !== undefined) {
      professionalTax = Number(ptOverride);
    } else {
      const slabs: Array<{ upTo: number; amount: number }> = cfg.ptSlabs || [];
      const sorted = [...slabs].sort((a, b) => a.upTo - b.upTo);
      for (const slab of sorted) {
        if (grossEarned <= slab.upTo) {
          professionalTax = slab.amount;
          break;
        }
      }
    }
  }
  return professionalTax;
}

const CFG = {
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  pfWageCeiling: 15000,
  pfApplyWageCap: true,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  esiGrossCeiling: 21000,
  ptSlabs: [
    { upTo: 14999, amount: 0 },
    { upTo: 19999, amount: 150 },
    { upTo: 9999999, amount: 200 },
  ],
};

const SALARY_CASES = [
  { basic: 40000, grossEarned: 56000, sal: {} },
  { basic: 10000, grossEarned: 18000, sal: {} },
  { basic: 40000, grossEarned: 56000, sal: { pfWageCeiling: 20000 } },
  { basic: 40000, grossEarned: 56000, sal: { voluntaryPfPercent: 5 } },
  { basic: 15000, grossEarned: 21000, sal: { esiGrossCeiling: 25000 } },
  { basic: 40000, grossEarned: 56000, sal: { professionalTaxOverride: 0 } },
  { basic: 40000, grossEarned: 56000, sal: { professionalTaxOverride: 75 } },
];

describe('Legacy vs new engine — PF/ESI/PT byte-for-byte compatibility', () => {
  for (const [i, { basic, grossEarned, sal }] of SALARY_CASES.entries()) {
    it(`case ${i + 1}: identical PF for basic=${basic}, sal=${JSON.stringify(sal)}`, () => {
      const legacy = legacyPf(basic, true, true, CFG, sal);
      const shared = calculatePf(
        basic,
        true,
        {
          enabled: true,
          employeeRate: CFG.pfEmployeeRate,
          employerRate: CFG.pfEmployerRate,
          wageCeiling: CFG.pfWageCeiling,
          applyWageCap: CFG.pfApplyWageCap,
        },
        sal.voluntaryPfPercent ?? 0,
        sal.pfWageCeiling,
      );
      expect(shared.pfEmployee).toBe(legacy.pfEmployee);
      expect(shared.pfEmployer).toBe(legacy.pfEmployer);
    });

    it(`case ${i + 1}: identical ESI for grossEarned=${grossEarned}, sal=${JSON.stringify(sal)}`, () => {
      const legacy = legacyEsi(grossEarned, true, true, CFG, sal);
      const shared = calculateEsi(
        grossEarned,
        true,
        {
          enabled: true,
          employeeRate: CFG.esiEmployeeRate,
          employerRate: CFG.esiEmployerRate,
          grossCeiling: CFG.esiGrossCeiling,
        },
        sal.esiGrossCeiling,
      );
      expect(shared.esiEmployee).toBe(legacy.esiEmployee);
      expect(shared.esiEmployer).toBe(legacy.esiEmployer);
    });

    it(`case ${i + 1}: identical PT for grossEarned=${grossEarned}, sal=${JSON.stringify(sal)}`, () => {
      const legacy = legacyPt(grossEarned, true, CFG, sal);
      const shared = calculatePt(
        grossEarned,
        true,
        CFG.ptSlabs,
        sal.professionalTaxOverride,
      );
      expect(shared).toBe(legacy);
    });
  }

  it('PF disabled at org level: both produce zero', () => {
    const legacy = legacyPf(40000, false, true, CFG, {});
    const shared = calculatePf(40000, true, {
      enabled: false,
      employeeRate: 0.12,
      employerRate: 0.12,
      wageCeiling: 15000,
      applyWageCap: true,
    });
    expect(shared.pfEmployee).toBe(legacy.pfEmployee);
  });

  it('ESI disabled at org level: both produce zero', () => {
    const legacy = legacyEsi(20000, false, true, CFG, {});
    const shared = calculateEsi(20000, true, {
      enabled: false,
      employeeRate: 0.0075,
      employerRate: 0.0325,
      grossCeiling: 21000,
    });
    expect(shared.esiEmployee).toBe(legacy.esiEmployee);
  });

  it('PT disabled at org level, even with an employee override set: both produce zero', () => {
    const sal = { professionalTaxOverride: 200 };
    const legacy = legacyPt(56000, false, CFG, sal);
    const shared = calculatePt(
      56000,
      false,
      CFG.ptSlabs,
      sal.professionalTaxOverride,
    );
    expect(shared).toBe(legacy);
    expect(shared).toBe(0);
  });

  it('employee not PF/ESI-eligible: both produce zero regardless of org config', () => {
    const legacyPfResult = legacyPf(40000, true, false, CFG, {});
    const sharedPf = calculatePf(40000, false, {
      enabled: true,
      employeeRate: 0.12,
      employerRate: 0.12,
      wageCeiling: 15000,
      applyWageCap: true,
    });
    expect(sharedPf.pfEmployee).toBe(legacyPfResult.pfEmployee);

    const legacyEsiResult = legacyEsi(20000, true, false, CFG, {});
    const sharedEsi = calculateEsi(20000, false, {
      enabled: true,
      employeeRate: 0.0075,
      employerRate: 0.0325,
      grossCeiling: 21000,
    });
    expect(sharedEsi.esiEmployee).toBe(legacyEsiResult.esiEmployee);
  });
});
