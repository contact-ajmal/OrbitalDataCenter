// Orbital vs terrestrial compute economics — pure, unit-tested. Every input is a
// named, tunable parameter; the panel exposes them as steppers. Illustrative.

export type EconParams = {
  launchCostPerKg: number; // $/kg to LEO
  satMassKg: number;
  satLifeYears: number;
  satComputeKW: number;
  satHardwareCost: number; // $ per satellite (GPU rack etc.)
  solarOpex: number; // $/GPU-hr energy in orbit (≈ 0 — sunlight is free)
  dcCapexPerKW: number; // terrestrial datacenter build $/kW
  powerPerKWh: number; // terrestrial $/kWh
  pue: number; // terrestrial power usage effectiveness
  terrestrialUptime: number; // fraction
};

export const ECON_DEFAULTS: EconParams = {
  launchCostPerKg: 200,
  satMassKg: 2140,
  satLifeYears: 5,
  satComputeKW: 120,
  satHardwareCost: 1_200_000,
  solarOpex: 0,
  dcCapexPerKW: 12_000,
  powerPerKWh: 0.08,
  pue: 1.25,
  terrestrialUptime: 0.95,
};

export const GPUS_PER_SAT = 72; // ≈ one GB300 NVL72 rack
const HOURS_PER_YEAR = 8766;
export const GOOGLE_DEAL_PER_MONTH = 920_000_000; // the real anchor contract
export const GOOGLE_FLEET = 1200; // fleet the anchor capacity maps to
export const SATS_PER_LAUNCH = 60;

/** Orbital $/GPU-hour at a given live uptime (sunlit fraction). */
export function orbitalCost(p: EconParams, uptime: number): number {
  const capex = p.launchCostPerKg * p.satMassKg + p.satHardwareCost;
  const u = Math.max(0.01, uptime);
  const gpuHours = p.satLifeYears * HOURS_PER_YEAR * u * GPUS_PER_SAT;
  return capex / gpuHours + p.solarOpex;
}

/** Terrestrial $/GPU-hour. */
export function terrestrialCost(p: EconParams): number {
  const capex = p.dcCapexPerKW * p.satComputeKW + p.satHardwareCost;
  const gpuHours = p.satLifeYears * HOURS_PER_YEAR * p.terrestrialUptime * GPUS_PER_SAT;
  const energyPerGpuHr = (p.satComputeKW / GPUS_PER_SAT) * p.pue * p.powerPerKWh;
  return capex / gpuHours + energyPerGpuHr;
}

/**
 * Launch $/kg at which orbital == terrestrial (bisection). Returns 0 if orbital
 * already beats terrestrial at $0/kg, or the upper bound if it never crosses.
 */
export function crossoverLaunchCost(p: EconParams, uptime: number, hi = 5000): number {
  const target = terrestrialCost(p);
  const at = (launch: number) => orbitalCost({ ...p, launchCostPerKg: launch }, uptime);
  let lo = 0;
  if (at(lo) > target) return 0; // orbital never cheaper
  if (at(hi) < target) return hi; // orbital cheaper even at hi
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Monthly revenue potential at a fleet size, anchored to the Google contract. */
export function fleetRevenuePerMonth(fleet: number): number {
  return (fleet / GOOGLE_FLEET) * GOOGLE_DEAL_PER_MONTH;
}

/** Cost of one launch (60 sats) at the current launch price. */
export function launchCost(p: EconParams): number {
  return SATS_PER_LAUNCH * p.satMassKg * p.launchCostPerKg;
}
