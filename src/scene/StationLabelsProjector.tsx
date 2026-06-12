import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { STATION_COUNT, stationWorld } from '../lib/stations';
import { stationLabels } from '../state/stationLabels';
import { useSimStore } from '../state/sim';

const _v = new Vector3();
const MAX_DIST = 250; // only label stations when zoomed in (avoid clutter)

/** Projects ground-station world positions to screen for StationLabels (DOM). */
export function StationLabelsProjector() {
  useFrame((state) => {
    const downlink = useSimStore.getState().toggles.downlink;
    const show = downlink && state.camera.position.length() < MAX_DIST;
    for (let i = 0; i < STATION_COUNT; i++) {
      const p = stationLabels.pts[i]!;
      if (!show) {
        p.vis = false;
        continue;
      }
      stationWorld(i, _v);
      _v.project(state.camera);
      const onScreen = _v.z < 1 && Math.abs(_v.x) <= 1 && Math.abs(_v.y) <= 1;
      p.x = (_v.x * 0.5 + 0.5) * state.size.width;
      p.y = (-_v.y * 0.5 + 0.5) * state.size.height;
      p.vis = onScreen;
    }
  });
  return null;
}
