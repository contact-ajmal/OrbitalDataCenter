import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { toast } from '../lib/bus';
import { telemetry } from '../state/telemetry';
import { useSimStore, type ViewMode } from '../state/sim';
import { stopTour, tour } from '../state/tour';

type Act = {
  dur: number;
  dist: number;
  view: ViewMode;
  toast: string;
  pickRandom?: boolean;
};

const ACTS: Act[] = [
  { dur: 6, dist: 330, view: 'overview', toast: 'TOUR 1/4 — FULL CONSTELLATION' },
  { dur: 9, dist: 6.5, view: 'inspect', toast: 'TOUR 2/4 — VEHICLE INSPECTION', pickRandom: true },
  { dur: 6, dist: 24, view: 'chase', toast: 'TOUR 3/4 — RIDING THE ORBIT' },
  { dur: 5, dist: 330, view: 'overview', toast: 'TOUR 4/4 — THE GRID ABOVE' },
];

/** Drives the four-act cinematic on REAL dt (so it runs even while paused). */
export function TourController() {
  const lastStep = useRef(-1);

  const applyAct = (i: number) => {
    const act = ACTS[i]!;
    tour.camDist = act.dist;
    const st = useSimStore.getState();
    if (act.pickRandom) {
      const c = telemetry.count;
      const idx = c > 0 ? (Math.random() * c) | 0 : 0;
      st.selectSat(idx); // sets selectedIdx + chaseIdx + inspect
    } else {
      st.setViewMode(act.view);
    }
    toast(act.toast);
  };

  useFrame((_, dt) => {
    if (!tour.active) {
      lastStep.current = -1;
      return;
    }
    if (tour.step !== lastStep.current) {
      lastStep.current = tour.step;
      applyAct(tour.step);
    }
    tour.t += dt; // REAL dt
    if (tour.t >= ACTS[tour.step]!.dur) {
      if (tour.step + 1 >= ACTS.length) {
        stopTour(false);
        return;
      }
      tour.step++;
      tour.t = 0;
    }
  });

  return null;
}
