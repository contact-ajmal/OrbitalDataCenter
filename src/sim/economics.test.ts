import { describe, it, expect } from 'vitest';
import {
  ECON_DEFAULTS,
  crossoverLaunchCost,
  fleetRevenuePerMonth,
  GOOGLE_DEAL_PER_MONTH,
  GOOGLE_FLEET,
  orbitalCost,
  terrestrialCost,
} from './economics';

describe('economics model', () => {
  it('crossover solver converges (orbital == terrestrial there)', () => {
    const x = crossoverLaunchCost(ECON_DEFAULTS, 0.95);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(5000);
    const orbitalAtX = orbitalCost({ ...ECON_DEFAULTS, launchCostPerKg: x }, 0.95);
    expect(Math.abs(orbitalAtX - terrestrialCost(ECON_DEFAULTS))).toBeLessThan(1e-3);
  });

  it('orbital cost strictly decreases as launch $/kg falls', () => {
    let prev = Infinity;
    for (const launch of [1500, 1000, 500, 200, 100]) {
      const c = orbitalCost({ ...ECON_DEFAULTS, launchCostPerKg: launch }, 0.95);
      expect(c).toBeLessThan(prev);
      prev = c;
    }
  });

  it('an uptime dip raises orbital $/GPU-hr', () => {
    const full = orbitalCost(ECON_DEFAULTS, 0.95);
    const dipped = orbitalCost(ECON_DEFAULTS, 0.6); // storm / eclipse heavy
    expect(dipped).toBeGreaterThan(full);
  });

  it('revenue scales with fleet and anchors to the Google contract', () => {
    expect(fleetRevenuePerMonth(GOOGLE_FLEET)).toBeCloseTo(GOOGLE_DEAL_PER_MONTH, 0);
    expect(fleetRevenuePerMonth(GOOGLE_FLEET * 2)).toBeCloseTo(GOOGLE_DEAL_PER_MONTH * 2, 0);
  });
});
