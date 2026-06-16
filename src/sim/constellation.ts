// Pure-TS orbital mechanics for the AI1 sun-synchronous constellation.
// NO React / no three runtime imports (math only). Unit-tested in constellation.test.ts.

import { SCENE, INCLINATION_DEG } from '../lib/constants';

/** A 3-component vector. Tuple form keeps indices statically known (no undefined). */
export type Vec3 = readonly [number, number, number];

export type Sat = {
  plane: number;
  slot: number;
  raan: number;
  inc: number;
  phase: number;
  r: number;
  deployFrom?: [number, number, number];
  deployT?: number;
  deorbiting?: boolean;
  burned?: boolean;
  lowPower?: boolean;
};

/** Mean angular rate (rad / sim-second) shared by every satellite. */
export const ANGULAR_RATE = 0.1;

const ORBIT_R = SCENE.ORBIT_R;
const INC = (INCLINATION_DEG * Math.PI) / 180;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Build a Walker-style constellation of n satellites.
 * planes = clamp(round(sqrt(n/3)), 6, 24); RAAN evenly spread around the equator;
 * phase staggered per plane; radius jittered ±0.25 in scene units.
 */
export function buildWalkerConstellation(n: number): { sats: Sat[]; planes: number } {
  const planes = clamp(Math.round(Math.sqrt(n / 3)), 6, 24);
  const per = Math.ceil(n / planes); // satellites per plane
  const sats: Sat[] = [];

  let count = 0;
  for (let p = 0; p < planes && count < n; p++) {
    const raan = (p / planes) * 2 * Math.PI;
    for (let s = 0; s < per && count < n; s++) {
      const phase = (s * 2 * Math.PI) / per + p * 0.35;
      const r = ORBIT_R + (Math.random() * 2 - 1) * 0.25;
      sats.push({ plane: p, slot: s, raan, inc: INC, phase, r });
      count++;
    }
  }
  return { sats, planes };
}

/**
 * World position for an orbital angle.
 * Earth axis = +Y, equator = x–z plane.
 * pos = rotY(raan) · rotX(inc) · (r·cos a, 0, r·sin a).
 * Max latitude = inc, so 97.6° retrograde reaches ±82.4°.
 */
export function angleToPos(
  angle: number,
  raan: number,
  inc: number,
  r: number,
  out: Float64Array | number[],
): Float64Array | number[] {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);

  // base vector in the equatorial plane
  const bx = r * ca;
  const bz = r * sa;

  // rotX(inc): rotate about +X
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const x1 = bx;
  const y1 = -bz * si;
  const z1 = bz * ci;

  // rotY(raan): rotate about +Y
  const cr = Math.cos(raan);
  const sr = Math.sin(raan);
  out[0] = x1 * cr + z1 * sr;
  out[1] = y1;
  out[2] = -x1 * sr + z1 * cr;
  return out;
}

/** Orbital angle of a satellite at sim-time t. */
export function satAngle(sat: Sat, t: number): number {
  return sat.phase + t * ANGULAR_RATE;
}

/**
 * RAAN of the orbital plane (inclination = global INC) that passes over a point.
 * Plane normal n = (sinI·sinθ, cosI, sinI·cosθ); solve n·P = 0:
 *   A·sinθ + B·cosθ = C,  A=sinI·Px, B=sinI·Pz, C=−cosI·Py
 *   θ = asin(clamp(C/hypot(A,B),−1,1)) − atan2(B,A)
 */
export function planeRaanOverPoint(p: Vec3, inc: number = INC): number {
  const si = Math.sin(inc);
  const ci = Math.cos(inc);
  const A = si * p[0];
  const B = si * p[2];
  const C = -ci * p[1];
  const h = Math.hypot(A, B) || 1e-12;
  return Math.asin(clamp(C / h, -1, 1)) - Math.atan2(B, A);
}

/**
 * Orbital phase angle of a point assumed to lie in the plane (raan, inc).
 * Apply the inverse rotations, then atan2(z, x) in the base frame.
 */
export function phaseOfPointInPlane(p: Vec3, raan: number, inc: number = INC): number {
  // inverse rotY(raan)
  const cr = Math.cos(raan);
  const sr = Math.sin(raan);
  const x1 = p[0] * cr - p[2] * sr;
  const y1 = p[1];
  const z1 = p[0] * sr + p[2] * cr;

  // inverse rotX(inc)
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const x2 = x1;
  const z2 = -y1 * si + z1 * ci;

  return Math.atan2(z2, x2);
}
