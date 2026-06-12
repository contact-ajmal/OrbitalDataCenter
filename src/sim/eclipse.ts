// Cylindrical eclipse test — pure TS, unit-tested in eclipse.test.ts.

import type { Vec3 } from './constellation';

/**
 * Is `pos` inside Earth's cylindrical shadow for a given sun direction?
 * The shadow is the half-cylinder of radius earthR extending anti-sunward.
 *   along = dot(pos, sunHat);  eclipsed ⇔ along < 0 && (|pos|² − along²) < earthR²
 * sunDir need not be unit length — it is normalized internally.
 */
export function isEclipsed(pos: Vec3, sunDir: Vec3, earthR: number): boolean {
  const sl = Math.hypot(sunDir[0], sunDir[1], sunDir[2]) || 1e-12;
  const sx = sunDir[0] / sl;
  const sy = sunDir[1] / sl;
  const sz = sunDir[2] / sl;

  const along = pos[0] * sx + pos[1] * sy + pos[2] * sz;
  if (along >= 0) return false; // sun-side hemisphere

  const lenSq = pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2];
  const perpSq = lenSq - along * along; // squared distance from shadow axis
  return perpSq < earthR * earthR;
}
