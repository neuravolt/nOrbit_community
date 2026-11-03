// Sections 7/8/9 — PF, ESI, and Professional Tax, made component-aware instead
// of reading hardcoded field names. The arithmetic itself is intentionally
// identical to the pre-existing formulas in hrms.service.ts's
// processPayrollRun (same rate application, same wage-cap logic, same PT slab
// lookup) — only the *inputs* changed, from "the fixed `basic` field" to "the
// sum of whichever components are flagged pfApplicable", so component-wise
// applicability (Section 7/8's explicit requirement) is honored without
// silently changing what a rupee of PF/ESI/PT means for an existing org.

export interface PfConfig {
  enabled: boolean;
  employeeRate: number;
  employerRate: number;
  wageCeiling: number;
  applyWageCap: boolean;
}

export interface PfResult {
  pfEmployee: number;
  pfEmployer: number;
  pfBase: number;
}

export function calculatePf(
  pfApplicableBase: number,
  isEmployeeEligible: boolean,
  config: PfConfig,
  voluntaryPfPercent = 0,
  employeeWageCeilingOverride?: number,
): PfResult {
  if (!config.enabled || !isEmployeeEligible) {
    return { pfEmployee: 0, pfEmployer: 0, pfBase: 0 };
  }
  const effectiveCeiling = employeeWageCeilingOverride ?? config.wageCeiling;
  const pfBase = config.applyWageCap
    ? Math.min(pfApplicableBase, effectiveCeiling)
    : pfApplicableBase;
  const pfEmployee = Number(
    (pfBase * (config.employeeRate + voluntaryPfPercent / 100)).toFixed(2),
  );
  const pfEmployer = Number((pfBase * config.employerRate).toFixed(2));
  return { pfEmployee, pfEmployer, pfBase };
}

export interface EsiConfig {
  enabled: boolean;
  employeeRate: number;
  employerRate: number;
  grossCeiling: number;
}

export interface EsiResult {
  esiEmployee: number;
  esiEmployer: number;
}

export function calculateEsi(
  esiApplicableGross: number,
  isEmployeeEligible: boolean,
  config: EsiConfig,
  employeeCeilingOverride?: number,
): EsiResult {
  if (!config.enabled || !isEmployeeEligible) {
    return { esiEmployee: 0, esiEmployer: 0 };
  }
  const effectiveCeiling = employeeCeilingOverride ?? config.grossCeiling;
  if (esiApplicableGross > effectiveCeiling) {
    return { esiEmployee: 0, esiEmployer: 0 };
  }
  return {
    esiEmployee: Number((esiApplicableGross * config.employeeRate).toFixed(2)),
    esiEmployer: Number((esiApplicableGross * config.employerRate).toFixed(2)),
  };
}

export interface PtSlab {
  upTo: number;
  amount: number;
}

export function calculatePt(
  ptApplicableGross: number,
  ptEnabled: boolean,
  slabs: PtSlab[],
  employeeOverride?: number | null,
): number {
  // ptEnabled gates everything, including a per-employee override — matches
  // the pre-existing legacy processPayrollRun behavior this function now
  // backs directly. An org with PT disabled globally (e.g. operates in a
  // state with no PT) shouldn't have a stray employee override reintroduce
  // it; disabling PT is an org-wide statement, not a default employees can
  // individually opt back into.
  if (!ptEnabled) return 0;
  if (employeeOverride !== null && employeeOverride !== undefined) {
    return Number(employeeOverride);
  }
  const sorted = [...slabs].sort((a, b) => a.upTo - b.upTo);
  for (const slab of sorted) {
    if (ptApplicableGross <= slab.upTo) return slab.amount;
  }
  return sorted.length ? sorted[sorted.length - 1].amount : 0;
}
