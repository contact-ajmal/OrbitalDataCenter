import { Vector3 } from 'three';
import { ANGULAR_RATE, angleToPos } from '../sim/constellation';
import { network } from './network';

const TCA = 12; // closest approach at t = 12 s
const MANEUVER_T = 6; // burn begins at T−6 s
const R_NUDGE = 0.0345; // ≈ +2.2 km raise
const _out: number[] = [0, 0, 0];
const _cross = new Vector3();
const _pred = new Vector3();

export type ConjPhase = 'idle' | 'alert' | 'maneuver' | 'resolved';

export const conjunction = {
  active: false,
  phase: 'idle' as ConjPhase,
  satIdx: -1,
  satId: '',
  t: 0,
  r0: 0,
  rTarget: 0,
  pc: '1:8,400',
  counted: false,
  maneuvers: 0,
  start: new Vector3(),
  vel: new Vector3(),
  pos: new Vector3(),
  tumble: new Vector3(),
};

const ease = (x: number) => x * x * (3 - 2 * x);

/** Start a conjunction against a random active satellite (never mid-deploy). */
export function triggerConjunction(simT: number): boolean {
  if (conjunction.active) return false;
  const sats = network.sats;
  if (sats.length < 2) return false;

  let idx = -1;
  for (let tries = 0; tries < 40; tries++) {
    const k = (Math.random() * sats.length) | 0;
    if (sats[k]!.deployT === undefined) {
      idx = k;
      break;
    }
  }
  if (idx < 0) return false;
  const sat = sats[idx]!;

  // predicted (un-maneuvered) position at TCA
  const futureAngle = sat.phase + (simT + TCA) * ANGULAR_RATE;
  angleToPos(futureAngle, sat.raan, sat.inc, sat.r, _out);
  _pred.set(_out[0]!, _out[1]!, _out[2]!);

  // a random crossing direction; debris arrives at the predicted point at TCA
  _cross.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  conjunction.start.copy(_pred).addScaledVector(_cross, 26);
  conjunction.vel.copy(_pred).sub(conjunction.start).multiplyScalar(1 / TCA);

  conjunction.active = true;
  conjunction.phase = 'alert';
  conjunction.satIdx = idx;
  conjunction.satId = `AI1-${String(idx).padStart(4, '0')}`;
  conjunction.t = 0;
  conjunction.r0 = sat.r;
  conjunction.rTarget = sat.r + R_NUDGE;
  conjunction.counted = false;
  conjunction.pc = `1:${(5000 + Math.random() * 6000) | 0}`;
  conjunction.tumble.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
  conjunction.pos.copy(conjunction.start);
  return true;
}

/** Advance the event by `simDelta` seconds. */
export function tickConjunction(simDelta: number): void {
  if (!conjunction.active) return;
  conjunction.t += simDelta;
  const t = conjunction.t;
  conjunction.pos.copy(conjunction.start).addScaledVector(conjunction.vel, t);

  if (t < MANEUVER_T) {
    conjunction.phase = 'alert';
  } else if (t < TCA) {
    conjunction.phase = 'maneuver';
    const sat = network.sats[conjunction.satIdx];
    if (sat) {
      const rt = Math.min(1, (t - MANEUVER_T) / 3); // raise over 3 s
      sat.r = conjunction.r0 + (conjunction.rTarget - conjunction.r0) * ease(rt);
    }
  } else if (t < TCA + 3) {
    if (!conjunction.counted) {
      conjunction.counted = true;
      conjunction.maneuvers++;
    }
    conjunction.phase = 'resolved';
  } else {
    conjunction.active = false;
    conjunction.phase = 'idle';
    conjunction.satIdx = -1;
  }
}

export const conjunctionTiming = { TCA, MANEUVER_T };
