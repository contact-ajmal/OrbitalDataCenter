import { Vector3 } from 'three';
import { toast } from '../lib/bus';

/**
 * Solar storm (CME sector event) singleton. The Constellation loop reads `dir`
 * to flag storm-hit satellites and ticks `t` on REAL dt (so it expires even
 * while the sim is paused).
 */
export const storm = {
  active: false,
  t: 0,
  dur: 9,
  dir: new Vector3(1, 0, 0),
};

/** Trigger a CME from a uniformly-random direction on the sphere. */
export function triggerStorm(): void {
  if (storm.active) return;
  // Uniform on the sphere: u∈[-1,1], φ∈[0,2π). (Random xyz would bias corners.)
  const u = Math.random() * 2 - 1;
  const phi = Math.random() * 2 * Math.PI;
  const s = Math.sqrt(1 - u * u);
  storm.dir.set(s * Math.cos(phi), u, s * Math.sin(phi));
  storm.active = true;
  storm.t = 0;
  toast('⚠ CME IMPACT — SECTOR FLEET ENTERING SAFE MODE');
}
