import { BadRequestException } from '@nestjs/common';
import { create, all } from 'mathjs';

// Enterprise Payroll Engine — safe formula evaluation (Section 5 / risk-review
// item 3). NOT `eval`/`new Function`: mathjs's expression parser is a sandboxed
// grammar, not JS — a formula string never gets JS-level access to the
// filesystem, network, or object prototypes, and the only variables it can
// read are the explicit numeric scope passed in below.
//
// An earlier version of this file additionally tried to shadow `import`,
// `createUnit`, and `evaluate` via math.import({...override:true}) as extra
// defense in depth. That was wrong in a way the test suite caught immediately:
// `import`/`createUnit` are JS-level API methods on the `math` object, not
// functions reachable from inside an expression string, so shadowing them
// blocked nothing real — and shadowing `evaluate` overwrote the very method
// this class calls to run formulas, breaking every evaluation. Removed.
const math = create(all, {});

// Defense in depth against pathological input, even though none of these are
// actually reachable as JS from expression syntax — reject anything that even
// looks like it's trying to escape the arithmetic grammar.
const FORBIDDEN_PATTERN =
  /constructor|prototype|__proto__|import\s*\(|createUnit\s*\(/i;

export interface FormulaContext {
  basic: number;
  gross: number;
  ctc: number;
  hra: number;
  [key: string]: number;
}

const SAMPLE_CONTEXT: FormulaContext = {
  basic: 50000,
  gross: 80000,
  ctc: 1200000,
  hra: 20000,
};

export class PayrollFormulaEngine {
  static evaluate(formula: string, context: FormulaContext): number {
    if (FORBIDDEN_PATTERN.test(formula)) {
      throw new BadRequestException(
        `Invalid formula "${formula}": contains a disallowed token.`,
      );
    }
    let result: unknown;
    try {
      result = math.evaluate(formula, { ...context });
    } catch (err: any) {
      throw new BadRequestException(
        `Invalid formula "${formula}": ${err.message}`,
      );
    }
    if (typeof result !== 'number' || !isFinite(result) || result < 0) {
      throw new BadRequestException(
        `Formula "${formula}" produced an invalid result: ${result}`,
      );
    }
    return Math.round(result * 100) / 100;
  }

  // Validate a formula against a representative sample context before it's saved
  // on a SalaryComponent — used by POST /hrms/payroll/formula/validate.
  static validate(formula: string): { valid: boolean; error?: string } {
    try {
      this.evaluate(formula, SAMPLE_CONTEXT);
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}

// Pre-defined templates the admin UI offers as a dropdown. Free-form formula
// entry (any string reaching PayrollFormulaEngine.evaluate directly) is gated
// to SUPER_ADMIN at the controller layer — see payroll.controller.ts.
export const FORMULA_TEMPLATES: Record<string, string> = {
  PERCENTAGE_OF_BASIC: 'basic * {rate}',
  PERCENTAGE_OF_GROSS: 'gross * {rate}',
  PERCENTAGE_OF_CTC: 'ctc / 12 * {rate}',
  HRA_METRO_EXEMPT: 'min(hra, 0.5 * basic)',
  HRA_NON_METRO_EXEMPT: 'min(hra, 0.4 * basic)',
};
