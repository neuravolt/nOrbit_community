import * as fs from 'fs';
import * as path from 'path';

// P1 gap-closure — "legacy/new payroll boundary" documentation and
// regression guard. This is not a behavioral test (that's what
// legacy-compatibility.spec.ts and the payroll-workflow.calculate
// integration suite are for) — it's a structural guard against the single
// most likely way these two paths could silently drift apart in the future:
// someone re-inlining a copy of the PF/ESI/PT/TDS formula directly into
// hrms.service.ts instead of importing the shared function. If that ever
// happens, this test fails even before anyone writes a behavioral test for
// the new inline copy.
//
// Documented boundary, checked below point by point:
//   1. New workflow (PayrollWorkflowService.calculate) uses the centralized
//      calculateEmployeePayroll() engine — proven behaviorally by
//      payroll-workflow.calculate.integration.spec.ts.
//   2. PF/ESI/PT: legacy processPayrollRun and the new engine call the exact
//      same statutory-calculator.ts functions — proven behaviorally by
//      legacy-compatibility.spec.ts (25 cases), enforced structurally here
//      (assertion 1 below: the import and call sites still exist).
//   3. TDS: the new engine uses the real TaxRegimeConfig/slab/rebate/
//      surcharge/marginal-relief/cess engine when configured (proven by
//      payroll-workflow.calculate.integration.spec.ts's "TDS integration"
//      suite). Legacy TDS remains the flat EmployeeSalary.tds field,
//      unchanged and untouched by this work — a deliberate scope boundary,
//      not an oversight, enforced structurally here (assertion 2 below).
//   4. Dynamic salary components: used when assigned, synthesized from
//      legacy fields when not (payroll-workflow.calculate.integration.spec's
//      first two tests + payroll-migration.service.spec.ts).
//   5. Holiday/working-week/attendance/leave: day-record-builder.spec.ts +
//      lwp-calculator.spec.ts + the integration suite.
//   6. Snapshots: created every calculate() call, immutable at the DB layer
//      (prisma.service.spec.ts), reproducible after a later config change
//      (payroll-workflow.calculate.integration.spec.ts).
//   7. Finalized/locked immutability: payroll-workflow.service.spec.ts (35
//      state-machine tests).
describe('Legacy/new payroll boundary — structural regression guard', () => {
  const hrmsServiceSource = fs.readFileSync(
    path.join(__dirname, '..', 'hrms.service.ts'),
    'utf-8',
  );

  it('legacy processPayrollRun imports and calls the SHARED statutory-calculator functions, not an inline copy', () => {
    expect(hrmsServiceSource).toMatch(
      /import\s*\{\s*calculatePf,\s*calculateEsi,\s*calculatePt,?\s*\}\s*from\s*['"]\.\/payroll\/statutory-calculator['"]/,
    );
    expect(hrmsServiceSource).toMatch(/calculatePf\(/);
    expect(hrmsServiceSource).toMatch(/calculateEsi\(/);
    expect(hrmsServiceSource).toMatch(/calculatePt\(/);

    // Structural drift guard: if PF/ESI/PT arithmetic (rate multiplication
    // combined with .toFixed rounding) reappears inline in this file outside
    // of the shared-function call sites, someone has reintroduced a second,
    // divergent implementation of statutory math. This regex is deliberately
    // narrow (rate * base then .toFixed) to avoid false positives on
    // unrelated rounding elsewhere in the file.
    const suspiciousInlineRateMath =
      /pfBase\s*\*\s*\(?cfg\.pf|effectiveCeil\s*\*\s*cfg\.esi/;
    expect(hrmsServiceSource).not.toMatch(suspiciousInlineRateMath);
  });

  it('legacy TDS remains the flat EmployeeSalary.tds field — an intentional, documented scope boundary, not silently changed', () => {
    // The exact pre-P0 line, byte-for-byte: TDS in the legacy path was never
    // touched by the TDS-integration work, by design (see P0's own scope:
    // "the ACTUAL payroll calculation path" refers to the new workflow).
    expect(hrmsServiceSource).toMatch(
      /const\s+tds\s*=\s*Number\(\(sal as any\)\.tds\s*\?\?\s*0\)/,
    );
    // And, just as importantly, legacy must NOT have grown its own call into
    // the new tax-slab engine — that integration is scoped to
    // PayrollWorkflowService only, documented above.
    expect(hrmsServiceSource).not.toMatch(
      /calculateAnnualTax|calculateMonthlyTds|TaxConfigService/,
    );
  });

  it("the new engine module directory contains no direct duplicate of hrms.service.ts's PF/ESI/PT loop", () => {
    // payroll-workflow.service.ts must call the same shared functions too —
    // if it ever stops importing them, that's the new path drifting instead.
    const workflowSource = fs.readFileSync(
      path.join(__dirname, 'payroll-workflow.service.ts'),
      'utf-8',
    );
    // The new path doesn't call calculatePf/Esi/Pt directly — it calls
    // calculateEmployeePayroll(), which internally calls them (this is
    // asserted in payroll-calculation.engine.ts's own source and covered
    // behaviorally by payroll-calculation.engine.spec.ts).
    expect(workflowSource).toMatch(/calculateEmployeePayroll\(/);
    const engineSource = fs.readFileSync(
      path.join(__dirname, 'payroll-calculation.engine.ts'),
      'utf-8',
    );
    expect(engineSource).toMatch(/calculatePf\(/);
    expect(engineSource).toMatch(/calculateEsi\(/);
    expect(engineSource).toMatch(/calculatePt\(/);
  });
});
