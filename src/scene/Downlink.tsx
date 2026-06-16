import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type LineSegments,
  LineBasicMaterial,
  type Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { SCENE } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { STATION_COUNT, stationWorld } from '../lib/stations';
import { telemetry } from '../state/telemetry';
import { earthGroupRef } from '../state/world';
import { useSimStore } from '../state/sim';
import { useUiStore } from '../state/ui';
import { network } from '../state/network';

const EARTH_R = SCENE.EARTH_R;
const LINK_RANGE = 0.9 * EARTH_R;

const _stationW = new Vector3();

export function Downlink() {
  const downlink = useSimStore((s) => s.toggles.downlink);
  const dotsRef = useRef<Points>(null);
  const beamRef = useRef<LineSegments>(null);

  const dotGeo = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(STATION_COUNT * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(STATION_COUNT * 3), 3));
    return geo;
  }, []);
  const dotMat = useMemo(
    () =>
      new PointsMaterial({
        map: radialTexture([
          [0, 'rgba(255,240,210,1)'],
          [0.4, 'rgba(255,181,84,0.9)'],
          [1, 'rgba(255,181,84,0)'],
        ]),
        vertexColors: true,
        size: 12,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  const beamGeo = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(STATION_COUNT * 2 * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(STATION_COUNT * 2 * 3), 3));
    return geo;
  }, []);
  const beamMat = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useFrame(() => {
    if (!useSimStore.getState().toggles.downlink) return;
    const earth = earthGroupRef.current;
    const dots = dotsRef.current;
    const beams = beamRef.current;
    if (!earth || !dots || !beams) return;

    const sw = telemetry.satWorld;
    const count = telemetry.count;
    const dotArr = (dots.geometry.getAttribute('position') as BufferAttribute).array as Float32Array;
    const dotCol = (dots.geometry.getAttribute('color') as BufferAttribute).array as Float32Array;
    const beamArr = (beams.geometry.getAttribute('position') as BufferAttribute)
      .array as Float32Array;
    const beamCol = (beams.geometry.getAttribute('color') as BufferAttribute)
      .array as Float32Array;

    // Reset downlink station tracking
    telemetry.satDownlinkStation.fill(-1);

    const uiStore = useUiStore.getState();
    const weatherSim = uiStore.weatherSim;
    const currentStates: ('clear' | 'cloudy')[] = [];

    for (let si = 0; si < STATION_COUNT; si++) {
      stationWorld(si, _stationW);
      dotArr[si * 3 + 0] = _stationW.x;
      dotArr[si * 3 + 1] = _stationW.y;
      dotArr[si * 3 + 2] = _stationW.z;

      // Compute deterministic weather state based on sim time and station index
      const isCloudy = weatherSim && (Math.sin(telemetry.simT * 0.2 + si * 1.5) > 0.0);
      currentStates.push(isCloudy ? 'cloudy' : 'clear');

      // Clear = Violet (0.6, 0.3, 1.0), Cloudy = Amber (1.0, 0.55, 0.1)
      const r = isCloudy ? 1.0 : 0.6;
      const g = isCloudy ? 0.55 : 0.3;
      const b = isCloudy ? 0.1 : 1.0;

      dotCol[si * 3 + 0] = r;
      dotCol[si * 3 + 1] = g;
      dotCol[si * 3 + 2] = b;

      let bestD = Infinity;
      let bestIdx = -1;
      let bx = _stationW.x;
      let by = _stationW.y;
      let bz = _stationW.z;
      for (let i = 0; i < count; i++) {
        const sat = network.sats[i];
        // Skip destroyed, deorbiting, or low-power satellites
        if (!sat || sat.burned || sat.deorbiting || (sat as any).lowPower) continue;

        const x = sw[i * 3]!;
        const y = sw[i * 3 + 1]!;
        const z = sw[i * 3 + 2]!;
        const dx = x - _stationW.x;
        const dy = y - _stationW.y;
        const dz = z - _stationW.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD) {
          bestD = d2;
          bestIdx = i;
          bx = x;
          by = y;
          bz = z;
        }
      }
      const inRange = bestD < LINK_RANGE * LINK_RANGE;
      const o = si * 6;
      beamArr[o + 0] = _stationW.x;
      beamArr[o + 1] = _stationW.y;
      beamArr[o + 2] = _stationW.z;
      beamArr[o + 3] = inRange ? bx : _stationW.x;
      beamArr[o + 4] = inRange ? by : _stationW.y;
      beamArr[o + 5] = inRange ? bz : _stationW.z;

      // Color both endpoints of the beam segment
      beamCol[o + 0] = r;
      beamCol[o + 1] = g;
      beamCol[o + 2] = b;
      beamCol[o + 3] = r;
      beamCol[o + 4] = g;
      beamCol[o + 5] = b;

      if (inRange && bestIdx >= 0) {
        telemetry.satDownlinkStation[bestIdx] = si;
      }
    }

    // Safely update UI weather state on transitions
    const oldStates = uiStore.weatherStates;
    let changed = false;
    for (let k = 0; k < STATION_COUNT; k++) {
      if (oldStates[k] !== currentStates[k]) changed = true;
    }
    if (changed) {
      uiStore.setWeatherStates(currentStates);
    }

    (dots.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (dots.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
    (beams.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (beams.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  });

  return (
    <group visible={downlink}>
      <points ref={dotsRef} args={[dotGeo, dotMat]} frustumCulled={false} />
      <lineSegments ref={beamRef} args={[beamGeo, beamMat]} frustumCulled={false} />
    </group>
  );
}
