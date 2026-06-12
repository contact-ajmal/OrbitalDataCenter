// Pure launch sequencing + trajectory math. Vector3 / QuadraticBezierCurve3 are
// three MATH types (allowed in src/sim); no React, no scene objects.

import { QuadraticBezierCurve3, Vector3 } from 'three';
import { INCLINATION_DEG, SCENE } from '../lib/constants';
import {
  ANGULAR_RATE,
  angleToPos,
  phaseOfPointInPlane,
  planeRaanOverPoint,
  type Sat,
  type Vec3,
} from './constellation';

export const LAUNCH = {
  COUNTDOWN_FROM: -5, // T-minus start (sim seconds)
  T_ASC: 16, // ascent ends / SECO
  SEP_T: 7.5, // hot-stage separation
  BOOSTER_RETURN_END: 15.2, // booster caught on the arms
  DEPLOY_START: 17,
  DEPLOY_INTERVAL: 0.35,
  DEPLOY_COUNT: 60,
  DEORBIT_BURN: 1.1, // retro burn duration
  DEORBIT_FADE: 1.2, // material fade duration
  CATCH_HEIGHT: 2.85, // catch point above the pad (radial)
  CLOCK_SCALE: 32, // displayed mission clock = t × 32 after liftoff
} as const;

const INC = (INCLINATION_DEG * Math.PI) / 180;
const ORBIT_R = SCENE.ORBIT_R;
const EARTH_R = SCENE.EARTH_R;

export type LaunchPlan = {
  raan: number;
  inc: number;
  a0: number;
  pad: Vector3;
  insertion: Vector3;
  curve: QuadraticBezierCurve3;
  newPlane: number;
};

/** Build the ascent plan AT RELEASE from the live pad position. */
export function buildPlan(padWorld: Vector3, newPlane: number): LaunchPlan {
  const p: Vec3 = [padWorld.x, padWorld.y, padWorld.z];
  const raan = planeRaanOverPoint(p, INC);
  const a0 = phaseOfPointInPlane(p, raan, INC) + 0.55;

  const out: number[] = [0, 0, 0];
  angleToPos(a0, raan, INC, ORBIT_R, out);
  const insertion = new Vector3(out[0]!, out[1]!, out[2]!);

  const pad = padWorld.clone();
  const control = pad.clone().normalize().multiplyScalar(EARTH_R + 7);
  const curve = new QuadraticBezierCurve3(pad, control, insertion);

  return { raan, inc: INC, a0, pad, insertion, curve, newPlane };
}

export type PhaseInfo = { key: string; label: string };

/** Mission phase label from elapsed sim seconds + flags. */
export function phaseFor(
  t: number,
  deployed: number,
  caught: boolean,
  deorbiting: boolean,
): PhaseInfo {
  if (t < 0) return { key: 'countdown', label: 'T-MINUS — FINAL COUNT · STARBASE, TX' };
  if (t < 1) return { key: 'ignition', label: 'IGNITION · 33 RAPTORS' };
  if (t < 2.5) return { key: 'liftoff', label: 'LIFTOFF · 124 M STACK' };
  if (t < 5) return { key: 'maxq', label: 'MAX-Q' };
  if (t < LAUNCH.SEP_T) return { key: 'meco', label: 'MECO / HOT-STAGE' };
  if (t < 8.5) return { key: 'sep', label: 'STAGE SEP / BOOSTBACK' };
  if (t < LAUNCH.T_ASC)
    return {
      key: 'ses',
      label: caught ? 'SES-1 · BOOSTER CAUGHT' : 'SES-1 · BOOSTBACK',
    };
  if (deorbiting) return { key: 'deorbit', label: 'DEORBIT BURN' };
  if (t < LAUNCH.DEPLOY_START) return { key: 'seco', label: 'SECO · 7.56 KM/S' };
  if (deployed < LAUNCH.DEPLOY_COUNT)
    return { key: 'deploy', label: `PAYLOAD DEPLOY ${deployed}/60 · PEZ DISPENSER` };
  return { key: 'operational', label: 'PLANE OPERATIONAL' };
}

/** Smoothstep ease. */
export const easeAsc = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Manual quadratic bezier into `out` (zero-alloc; endpoint can move per-frame). */
export function quadBezier(
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  s: number,
  out: Vector3,
): Vector3 {
  const u = 1 - s;
  const a = u * u;
  const b = 2 * u * s;
  const c = s * s;
  out.set(
    a * p0.x + b * p1.x + c * p2.x,
    a * p0.y + b * p1.y + c * p2.y,
    a * p0.z + b * p1.z + c * p2.z,
  );
  return out;
}

export function makeDeploySat(
  plan: LaunchPlan,
  k: number,
  simT: number,
  shipPos: Vector3,
): Sat {
  return {
    plane: plan.newPlane,
    slot: k,
    raan: plan.raan,
    inc: plan.inc,
    phase: plan.a0 + (k * 2 * Math.PI) / LAUNCH.DEPLOY_COUNT - simT * ANGULAR_RATE,
    r: ORBIT_R,
    deployFrom: [shipPos.x, shipPos.y, shipPos.z],
    deployT: 0,
  };
}
