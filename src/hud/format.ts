// Display formatters for the HUD. Numbers render with grouping; powers and
// token rates auto-select units.

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Compute power: kW → MW → GW auto-unit. */
export function fmtPower(kW: number): { val: string; unit: string } {
  const mw = kW / 1000;
  if (mw >= 1000) return { val: (mw / 1000).toFixed(2), unit: 'GW' };
  if (mw >= 1) return { val: mw.toFixed(1), unit: 'MW' };
  return { val: Math.round(kW).toString(), unit: 'kW' };
}

/** Inference throughput: tokens/s → K / M / B. */
export function fmtTokens(t: number): { val: string; unit: string } {
  if (t >= 1e9) return { val: (t / 1e9).toFixed(2), unit: 'B' };
  if (t >= 1e6) return { val: (t / 1e6).toFixed(2), unit: 'M' };
  if (t >= 1e3) return { val: (t / 1e3).toFixed(1), unit: 'K' };
  return { val: Math.round(t).toString(), unit: '' };
}
