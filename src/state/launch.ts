import { Vector3 } from 'three';
import { SCENE } from '../lib/constants';

/**
 * Starship launch state — a mutable singleton. Written every frame by
 * Starship.tsx; read by CameraRig (target + distance) and MissionStrip (clock +
 * phase). Not zustand — no per-frame renders.
 */
export const launch = {
  active: false,
  shipPos: new Vector3(0, SCENE.EARTH_R * 1.02, 0),
  /** Desired camera distance for launch mode (eased by CameraRig). */
  camDist: 12,
  /** Displayed mission clock seconds (= elapsed × CLOCK_SCALE). */
  missionT: 0,
  /** Current mission phase label. */
  phaseLabel: '',
  /** Satellites deployed so far this mission. */
  deployed: 0,
};
