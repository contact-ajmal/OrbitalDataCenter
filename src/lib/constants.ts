/**
 * AI1 Orbital Compute — real data sheet (single source of truth).
 * Figures from the SpaceX AI1 unveiling (2026-06-08). Do not edit casually;
 * prompts downstream depend on these exact values.
 */

// ── Earth & orbit geometry ──────────────────────────────────────────────
export const EARTH_RADIUS_KM = 6371;
export const ORBIT_ALT_KM = 600; // ~600 km sun-synchronous
export const INCLINATION_DEG = 97.6; // retrograde SSO

// ── Per-satellite spec ──────────────────────────────────────────────────
export const SAT_KW_AVG = 120; // average compute payload
export const SAT_KW_PEAK = 150; // peak compute payload
export const SAT_TONS = 150 / 70; // power density 70 kW/ton → ≈2.14 t/sat
export const WINGSPAN_M = 70; // deployed wingspan (wider than 747-8)
export const SOLAR_KW = 150; // solar array output
export const RADIATOR_M2 = 110; // liquid radiator area

// ── Orbital dynamics ────────────────────────────────────────────────────
export const ORBITAL_V_KMS = 7.56; // orbital velocity
export const PERIOD_MIN = 96.7; // orbital period

// ── Launch ──────────────────────────────────────────────────────────────
export const STARBASE = { lat: 25.997, lon: -97.155 } as const; // Starbase, TX
export const STACK_HEIGHT_M = 124; // Starship V3 full stack

// ── Program facts (single source for ticker + info modal) ───────────────
export const PROGRAM_FACTS = [
  'FCC filing: up to 1,000,000 satellites',
  'Two prototypes targeted early 2027',
  'Gigasat factory · Bastrop, TX · 11M sq ft',
  '1 GW/yr space compute by late 2027',
  'Terafab goal: 1 TW of chips per year',
  '$920M/month Google compute deal',
  'Payload: NVIDIA Rubin / GB300 · TPU planned',
] as const;

// ── Lighting ────────────────────────────────────────────────────────────
// Primary sun direction (un-normalized; normalize at use sites).
export const SUN_DIR = [1, 0.18, 0.35] as const;

// Scene-space (three.js) colors. Kept here so no raw hex literals live in TSX
// (HUD chrome colors come from Tailwind @theme tokens instead).
export const SCENE_COLORS = {
  skyTint: '#b9c4cf',
  ambient: '#18222e',
  sunLight: '#fff3e0', // warm white
  // Satellite parts
  satBus: '#39424e',
  satWing: '#1b2b4d',
  satWingEmissive: '#0b1a3a',
  satRadiator: '#e3e9f0',
  satEclipse: '#3a4450', // instanceColor multiplier when in shadow
  // Network
  laser: '#52d7ff',
  downlink: '#ffb554',
  orbitRing: '#3a4a5a',
} as const;

/** Nominal time-warp: at this value the sim runs at its baseline visual rate. */
export const NOMINAL_WARP = 60;

// ── Scene-space scaling (three.js units) ────────────────────────────────
export const SCENE = {
  EARTH_R: 100,
  ORBIT_R: (100 * (EARTH_RADIUS_KM + ORBIT_ALT_KM)) / EARTH_RADIUS_KM,
  MAX_SATS: 2400,
} as const;
