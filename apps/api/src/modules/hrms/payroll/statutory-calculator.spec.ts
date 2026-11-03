import { calculatePf, calculateEsi, calculatePt } from './statutory-calculator';

describe('calculatePf', () => {
  const config = {
    enabled: true,
    employeeRate: 0.12,
    employerRate: 0.12,
    wageCeiling: 15000,
    applyWageCap: true,
  };

  it('caps the PF base at the wage ceiling when applyWageCap is true', () => {
    const result = calculatePf(40000, true, config);
    expect(result.pfBase).toBe(15000);
    expect(result.pfEmployee).toBe(1800); // 15000 * 0.12
    expect(result.pfEmployer).toBe(1800);
  });

  it('uses the full basic when applyWageCap is false', () => {
    const result = calculatePf(40000, true, { ...config, applyWageCap: false });
    expect(result.pfBase).toBe(40000);
    expect(result.pfEmployee).toBe(4800);
  });

  it('returns zero when PF is disabled at org level', () => {
    const result = calculatePf(40000, true, { ...config, enabled: false });
    expect(result.pfEmployee).toBe(0);
    expect(result.pfEmployer).toBe(0);
  });

  it('returns zero when the employee is not PF-eligible', () => {
    const result = calculatePf(40000, false, config);
    expect(result.pfEmployee).toBe(0);
  });

  it('adds voluntary PF percentage on top of the employee rate', () => {
    const result = calculatePf(10000, true, config, 5); // 12% + 5% = 17%
    expect(result.pfEmployee).toBe(1700);
    expect(result.pfEmployer).toBe(1200); // employer unaffected by voluntary %
  });

  it('an employee-level wage ceiling override takes precedence over org config', () => {
    const result = calculatePf(40000, true, config, 0, 20000);
    expect(result.pfBase).toBe(20000);
  });
});

describe('calculateEsi', () => {
  const config = {
    enabled: true,
    employeeRate: 0.0075,
    employerRate: 0.0325,
    grossCeiling: 21000,
  };

  it('applies ESI when gross is at or below the ceiling', () => {
    const result = calculateEsi(20000, true, config);
    expect(result.esiEmployee).toBe(150); // 20000 * 0.0075
    expect(result.esiEmployer).toBe(650); // 20000 * 0.0325
  });

  it('applies zero ESI when gross exceeds the ceiling', () => {
    const result = calculateEsi(25000, true, config);
    expect(result.esiEmployee).toBe(0);
    expect(result.esiEmployer).toBe(0);
  });

  it('returns zero when ESI is disabled', () => {
    const result = calculateEsi(20000, true, { ...config, enabled: false });
    expect(result.esiEmployee).toBe(0);
  });

  it('returns zero when the employee is not ESI-eligible', () => {
    const result = calculateEsi(20000, false, config);
    expect(result.esiEmployee).toBe(0);
  });
});

describe('calculatePt', () => {
  const slabs = [
    { upTo: 14999, amount: 0 },
    { upTo: 19999, amount: 150 },
    { upTo: 9999999, amount: 200 },
  ];

  it('picks the correct slab by ascending upTo', () => {
    expect(calculatePt(12000, true, slabs)).toBe(0);
    expect(calculatePt(18000, true, slabs)).toBe(150);
    expect(calculatePt(50000, true, slabs)).toBe(200);
  });

  it('an employee override of 0 explicitly waives PT rather than falling through to slabs', () => {
    expect(calculatePt(50000, true, slabs, 0)).toBe(0);
  });

  it('a non-zero employee override takes precedence over slabs', () => {
    expect(calculatePt(50000, true, slabs, 75)).toBe(75);
  });

  it('returns zero when PT is disabled and there is no override', () => {
    expect(calculatePt(50000, false, slabs)).toBe(0);
  });

  it('returns zero when PT is disabled at the org level even if an employee override is set — matches legacy processPayrollRun', () => {
    expect(calculatePt(50000, false, slabs, 75)).toBe(0);
  });
});
