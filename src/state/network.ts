import type { MeshStandardMaterial, Points } from 'three';
import type { Sat } from '../sim/constellation';

/**
 * Mutable singleton describing the current fleet + laser mesh topology.
 * Rebuilt by Constellation.tsx whenever satCount changes; read by the laser,
 * downlink, and (later) job-routing systems. Not zustand — no per-frame renders.
 */
export const network = {
  sats: [] as Sat[],
  count: 0,
  pairs: [] as [number, number][],
  adj: [] as number[][],
  /** The glint Points object (raycast target for the picker). */
  glintPoints: null as Points | null,
  /** Shared wing material (training mode pulses its emissive intensity). */
  wingMaterial: null as MeshStandardMaterial | null,
};
