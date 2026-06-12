// Shareable view state as a compact base64 URL hash (#s=...). Schema-versioned
// so future fields stay forward-compatible. Transient state (launch/job/training)
// is intentionally NOT serialized.

import { useSimStore } from '../state/sim';
import { cameraState } from '../state/cameraState';

const SCHEMA = 1;

/** Set true when a shared view was restored on load (intro is skipped). */
export const permalinkState = { sharedRestored: false };

type Payload = {
  v: number;
  sc: number; // satCount
  tw: number; // timeWarp
  vm: string; // viewMode
  ci: number; // chaseIdx
  tg: [boolean, boolean, boolean, boolean]; // lasers, downlink, orbits, starlink
  vis: boolean;
  th: boolean; // thermal
  cam: [number, number, number]; // yaw, pitch, dist
};

export function encodeState(): string {
  const st = useSimStore.getState();
  const p: Payload = {
    v: SCHEMA,
    sc: st.satCount,
    tw: st.timeWarp,
    vm: st.viewMode,
    ci: st.chaseIdx,
    tg: [st.toggles.lasers, st.toggles.downlink, st.toggles.orbits, st.toggles.starlink],
    vis: st.visionOn,
    th: st.thermal,
    cam: [
      +cameraState.yaw.toFixed(3),
      +cameraState.pitch.toFixed(3),
      +cameraState.dist.toFixed(1),
    ],
  };
  return btoa(JSON.stringify(p));
}

export function currentShareUrl(): string {
  return `${location.origin}${location.pathname}#s=${encodeState()}`;
}

/** True if a valid shared payload was present and applied. */
export function applyHash(): boolean {
  const m = /#s=([^&]+)/.exec(location.hash);
  if (!m) return false;
  try {
    const p = JSON.parse(atob(m[1]!)) as Payload;
    if (!p || p.v !== SCHEMA) return false;
    const st = useSimStore.getState();
    st.setSatCount(p.sc);
    st.setTimeWarp(p.tw);
    st.setViewMode(p.vm as ReturnType<typeof useSimStore.getState>['viewMode']);
    st.setChaseIdx(p.ci);
    if (st.toggles.lasers !== p.tg[0]) st.toggle('lasers');
    if (st.toggles.downlink !== p.tg[1]) st.toggle('downlink');
    if (st.toggles.orbits !== p.tg[2]) st.toggle('orbits');
    if (st.toggles.starlink !== p.tg[3]) st.toggle('starlink');
    st.setVisionOn(p.vis);
    if (st.thermal !== p.th) st.toggleThermal();
    cameraState.restore = { yaw: p.cam[0], pitch: p.cam[1], dist: p.cam[2] };
    permalinkState.sharedRestored = true;
    return true;
  } catch {
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Debounced hash write (500 ms). */
export function scheduleHashUpdate(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    history.replaceState(null, '', `#s=${encodeState()}`);
  }, 500);
}
