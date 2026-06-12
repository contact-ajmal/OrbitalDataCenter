import type { Group } from 'three';

/**
 * Bridge between the scene-side projector (HeroSat, inside the Canvas) and the
 * DOM-side renderer (PartLabels, in the HUD). HeroSat writes screen-space
 * coordinates here every frame; PartLabels reads them via rAF and applies
 * styles to refs — no React state on the hot path.
 */

export type LabelKey =
  | 'portWing'
  | 'stbdWing'
  | 'radiator'
  | 'computeModule'
  | 'bus'
  | 'laserTerminal';

export const LABEL_KEYS: LabelKey[] = [
  'portWing',
  'stbdWing',
  'radiator',
  'computeModule',
  'bus',
  'laserTerminal',
];

/** Screen-space placement for one anchor. */
export interface ScreenPoint {
  x: number; // px from left
  y: number; // px from top
  vis: boolean; // on-screen AND facing the camera
  op: number; // facing-driven opacity 0..1
}

const sp = (): ScreenPoint => ({ x: 0, y: 0, vis: false, op: 0 });

export const labelState = {
  active: false, // true only while inspect mode is shown
  pts: {
    portWing: sp(),
    stbdWing: sp(),
    radiator: sp(),
    computeModule: sp(),
    bus: sp(),
    laserTerminal: sp(),
  } as Record<LabelKey, ScreenPoint>,
  tipL: sp(),
  tipR: sp(),
};

/** Hero satellite group ref, published by HeroSat for projection. */
export const heroGroupRef: { current: Group | null } = { current: null };
