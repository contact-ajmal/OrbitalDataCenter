import { toast } from '../lib/bus';

/**
 * Cinematic tour singleton. Ticked on REAL dt by TourController (works while
 * paused). CameraRig reads `active` + `camDist` to drive the dolly.
 */
export const tour = {
  active: false,
  t: 0,
  step: 0,
  camDist: 330,
};

export function startTour(): void {
  if (tour.active) return;
  tour.active = true;
  tour.step = 0;
  tour.t = 0;
}

export function stopTour(cancelled: boolean): void {
  if (!tour.active) return;
  tour.active = false;
  toast(cancelled ? 'TOUR CANCELLED — MANUAL CONTROL' : 'TOUR COMPLETE — THE GRID ABOVE');
}
