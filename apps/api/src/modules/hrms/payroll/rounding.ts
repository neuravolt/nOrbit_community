// Section 19 — one deterministic rounding policy, applied consistently and
// captured in the payroll snapshot so a historical run's numbers never shift
// if the org's rounding preference changes later.

export type RoundingMode = 'ROUND' | 'CEIL' | 'FLOOR' | 'NONE';

export interface RoundingConfig {
  mode: RoundingMode;
  precision: number; // decimal places; 0 = whole rupee
}

export const DEFAULT_ROUNDING: RoundingConfig = { mode: 'ROUND', precision: 2 };
export const DEFAULT_NET_PAY_ROUNDING: RoundingConfig = {
  mode: 'ROUND',
  precision: 0,
};

export function applyRounding(
  value: number,
  config: RoundingConfig = DEFAULT_ROUNDING,
): number {
  if (config.mode === 'NONE') return value;
  const factor = Math.pow(10, config.precision);
  const scaled = value * factor;
  let rounded: number;
  switch (config.mode) {
    case 'CEIL':
      rounded = Math.ceil(scaled);
      break;
    case 'FLOOR':
      rounded = Math.floor(scaled);
      break;
    case 'ROUND':
    default:
      rounded = Math.round(scaled);
  }
  return rounded / factor;
}
