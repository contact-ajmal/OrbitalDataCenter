// SGP4 propagation of real TLE elements into scene space. Pure TS (satellite.js
// is a plain math lib — no React). Propagation is CHUNKED by the caller; this
// module only parses and propagates a slice into a persistent buffer.

import { propagate, twoline2satrec, type SatRec } from 'satellite.js';
import { SCENE } from '../lib/constants';

const KM_PER_UNIT = 63.71;
export const TLE_CAP = 6000;

/** Parse a CelesTrak 3-line (name + L1 + L2) TLE set into satrecs (capped). */
export function parseTle(text: string): SatRec[] {
  const lines = text.split(/\r?\n/);
  const recs: SatRec[] = [];
  for (let i = 0; i + 2 < lines.length && recs.length < TLE_CAP; i += 3) {
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!l1 || !l2 || l1[0] !== '1' || l2[0] !== '2') continue;
    try {
      const rec = twoline2satrec(l1, l2);
      // satrec.error !== 0 means bad elements
      if (rec && (rec as { error?: number }).error === 0) recs.push(rec);
    } catch {
      /* skip parse failures */
    }
  }
  return recs;
}

/**
 * Propagate satrecs[start .. start+count) at `date` into `out` (scene units).
 * ECI (z = pole) is remapped to scene (y = pole) and rotated by the Earth-group
 * yaw so the constellation's ground track aligns with the rotating textured Earth.
 * Returns the next start index (wraps via the caller).
 */
export function propagateChunk(
  recs: SatRec[],
  date: Date,
  out: Float32Array,
  start: number,
  count: number,
  earthYaw: number,
): number {
  const cy = Math.cos(earthYaw);
  const sy = Math.sin(earthYaw);
  const n = recs.length;
  const end = Math.min(start + count, n);
  for (let i = start; i < end; i++) {
    const pv = propagate(recs[i]!, date);
    const p = pv.position;
    if (!p || typeof p === 'boolean') continue;
    // ECI km → scene units, pole eci.z → scene.y
    const x = p.x / KM_PER_UNIT;
    const y = p.z / KM_PER_UNIT;
    const z = -p.y / KM_PER_UNIT;
    // rotate about +Y by the Earth yaw
    out[i * 3 + 0] = x * cy + z * sy;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = -x * sy + z * cy;
  }
  return end >= n ? 0 : end;
}

/** Sanity guard so positions never blow up the scene if elements are bad. */
export const TLE_MAX_R = (SCENE.EARTH_R * 50000) / KM_PER_UNIT;
