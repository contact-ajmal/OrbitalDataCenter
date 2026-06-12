// Program roadmap milestones (the real announced beats) + interpolation helpers.

import { SCENE } from './constants';

export type Milestone = {
  year: number;
  label: string;
  fleet: number | 'vision';
  note?: string;
};

export const MILESTONES: Milestone[] = [
  { year: 2027.0, label: 'TWO AI1 PROTOTYPES', fleet: 2 },
  { year: 2027.5, label: 'FIRST OPERATIONAL PLANES', fleet: 240 },
  { year: 2027.9, label: 'GIGASAT AT 1 GW/YR', fleet: 480, note: '~8,300 sats/yr rate' },
  { year: 2028.5, label: 'GOOGLE CAPACITY ONLINE', fleet: 1200, note: '$920M/mo anchor' },
  { year: 2029.5, label: 'TERAFAB FIRST SILICON', fleet: 2400, note: 'toward 1 TW/yr chips' },
  { year: 2032.0, label: 'THE MILLION-SAT SHELL', fleet: 'vision' },
];

export const YEAR_MIN = 2027;
export const YEAR_MAX = 2032;
export const VISION_YEAR = 2031.6; // engage vision mode at/after this point

const NUMERIC = MILESTONES.filter((m) => typeof m.fleet === 'number') as (Milestone & {
  fleet: number;
})[];

/** Interpolated fleet size at a year (snapped to step 60), or 'vision'. */
export function fleetAt(year: number): number | 'vision' {
  if (year >= VISION_YEAR) return 'vision';
  if (year <= NUMERIC[0]!.year) return NUMERIC[0]!.fleet;
  const last = NUMERIC[NUMERIC.length - 1]!;
  if (year >= last.year) return last.fleet;
  for (let i = 0; i + 1 < NUMERIC.length; i++) {
    const a = NUMERIC[i]!;
    const b = NUMERIC[i + 1]!;
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year);
      const raw = a.fleet + (b.fleet - a.fleet) * t;
      return Math.min(SCENE.MAX_SATS, Math.max(60, Math.round(raw / 60) * 60));
    }
  }
  return last.fleet;
}

/** Launch $/kg along the declining cost curve 1500 → 150 across the timeline. */
export function launchCostAt(year: number): number {
  const t = Math.max(0, Math.min(1, (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
  return Math.round(1500 - t * (1500 - 150));
}

/** The active milestone at a year (largest year ≤ given). */
export function eraAt(year: number): Milestone {
  let m = MILESTONES[0]!;
  for (const ms of MILESTONES) if (year >= ms.year) m = ms;
  return m;
}
