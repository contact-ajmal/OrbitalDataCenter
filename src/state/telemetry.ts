import { SCENE } from '../lib/constants';

/**
 * High-frequency simulation telemetry — a plain mutable singleton (NOT zustand).
 * Written every frame by the constellation useFrame loop; read by the HUD at a
 * throttled ~4 Hz. Keeping it off zustand avoids per-frame React renders.
 */
export const telemetry = {
  /** World positions, packed xyz per satellite (length MAX_SATS*3). */
  satWorld: new Float32Array(SCENE.MAX_SATS * 3),
  /** 1 = in Earth's shadow, 0 = sunlit. */
  eclipsed: new Uint8Array(SCENE.MAX_SATS),
  /** 1 = in the CME storm sector (safe mode). */
  stormHit: new Uint8Array(SCENE.MAX_SATS),
  /** Fraction of the active fleet currently sunlit (0..1). */
  sunlitFrac: 1,
  /** Accumulated sim time (seconds, warp-scaled). */
  simT: 0,
  /** Completed AI jobs (Phase 5). */
  jobsDone: 0,
  /** Active satellite count mirrored from the store for readers. */
  count: 0,
  /** Chased/hero satellite world position + sun-facing orientation. */
  heroPos: new Float32Array(3),
  heroQuat: new Float32Array(4),
  /** Battery charge level (0.0 to 1.0) per satellite. */
  satBatteries: (() => {
    const arr = new Float32Array(SCENE.MAX_SATS);
    arr.fill(1.0);
    return arr;
  })(),
  /** The ground station index (0..3) this satellite is downlinking to, or -1. */
  satDownlinkStation: (() => {
    const arr = new Int8Array(SCENE.MAX_SATS);
    arr.fill(-1);
    return arr;
  })(),
};
