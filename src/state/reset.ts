import { toast } from '../lib/bus';
import { useSimStore } from './sim';
import { useUiStore } from './ui';
import { tour } from './tour';
import { storm } from './storm';
import { launch } from './launch';
import { stopTraining } from '../sim/training';

/** Camera-reset easing target (consumed by CameraRig). */
export const cameraReset = { active: false, t: 0, yaw: 0.6, pitch: 0.35, dist: 330 };

/** Set when a reset is requested mid-launch; fired at mission completion. */
export const resetFlags = { queued: false };

/** Reset the camera + UI to the opening state (data is preserved). */
export function performReset(): void {
  // Reset all simulation configurations to defaults
  useSimStore.setState({
    satCount: 480,
    timeWarp: 60,
    toggles: { lasers: true, downlink: true, orbits: false, starlink: false },
    viewMode: 'overview',
    chaseIdx: 0,
    selectedIdx: -1,
    visionOn: false,
    jobBusy: false,
    paused: false,
    thermal: false,
    photoMode: false,
  });

  stopTraining();

  tour.active = false; // silent cancel
  storm.active = false; // end early, suppress the nominal toast
  useUiStore.getState().closeInfo();

  cameraReset.active = true;
  cameraReset.t = 0;
  toast('VIEW RESET — FULL CONSTELLATION');
}

/**
 * Request a reset. If a launch is in flight, queue it (aborting mid-deploy would
 * orphan satellites) and run it automatically when the mission completes.
 */
export function requestReset(): void {
  if (launch.active) {
    resetFlags.queued = true;
    toast('MISSION IN PROGRESS — RESET QUEUED');
    return;
  }
  performReset();
}
