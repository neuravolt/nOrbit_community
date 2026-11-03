import { BadRequestException } from '@nestjs/common';
import { PayrollFormulaEngine } from './formula-engine';

describe('PayrollFormulaEngine', () => {
  const ctx = { basic: 40000, gross: 65000, ctc: 900000, hra: 16000 };

  it('evaluates a percentage-of-basic formula', () => {
    expect(PayrollFormulaEngine.evaluate('basic * 0.10', ctx)).toBe(4000);
  });

  it('evaluates the HRA metro-exempt template', () => {
    expect(PayrollFormulaEngine.evaluate('min(hra, 0.5 * basic)', ctx)).toBe(
      16000,
    );
  });

  it('evaluates ctc-per-month percentage', () => {
    expect(PayrollFormulaEngine.evaluate('ctc / 12 * 0.05', ctx)).toBe(3750);
  });

  it('rejects a formula referencing an undefined variable', () => {
    expect(() =>
      PayrollFormulaEngine.evaluate('undefinedVar * 2', ctx),
    ).toThrow(BadRequestException);
  });

  it('rejects a formula that resolves to a negative number', () => {
    expect(() => PayrollFormulaEngine.evaluate('basic - gross', ctx)).toThrow(
      BadRequestException,
    );
  });

  it('rejects attempts to reach disabled functions (import/createUnit/evaluate)', () => {
    expect(() => PayrollFormulaEngine.evaluate('import("fs")', ctx)).toThrow(
      BadRequestException,
    );
  });

  it('rejects non-numeric / malformed syntax', () => {
    expect(() => PayrollFormulaEngine.evaluate('basic +* 2', ctx)).toThrow(
      BadRequestException,
    );
  });

  it('validate() reports valid for a well-formed formula', () => {
    expect(PayrollFormulaEngine.validate('gross * 0.05')).toEqual({
      valid: true,
    });
  });

  it('validate() reports invalid with a message for a broken formula', () => {
    const result = PayrollFormulaEngine.validate('gross * ');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
