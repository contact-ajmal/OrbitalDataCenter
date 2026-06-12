import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points, PointsMaterial } from 'three';
import { NOMINAL_WARP, SCENE } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { useSimStore } from '../state/sim';
import { tickTraining, training } from '../sim/training';

const MAX = SCENE.MAX_SATS;
const TWO_PI = Math.PI * 2;

/** Visualizes COMPUTE (wing pulse) + ALL-REDUCE (ring waves) during training. */
export function TrainingViz() {
  const pointsRef = useRef<Points>(null);
  const ringsRef = useRef<number[][] | null>(null);
  const wasActive = useRef(false);

  const geom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new PointsMaterial({
        map: radialTexture([
          [0, 'rgba(230,250,255,1)'],
          [0.4, 'rgba(82,215,255,0.85)'],
          [1, 'rgba(82,215,255,0)'],
        ]),
        color: '#9fe8ff',
        size: 5,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  const buildRings = () => {
    const byPlane = new Map<number, number[]>();
    const sats = network.sats;
    for (let i = 0; i < sats.length; i++) {
      const pl = sats[i]!.plane;
      let arr = byPlane.get(pl);
      if (!arr) {
        arr = [];
        byPlane.set(pl, arr);
      }
      arr.push(i);
    }
    for (const arr of byPlane.values()) arr.sort((a, b) => sats[a]!.slot - sats[b]!.slot);
    ringsRef.current = [...byPlane.values()];
  };

  useFrame((state, dt) => {
    const st = useSimStore.getState();
    const w = st.timeWarp / NOMINAL_WARP;
    const simDelta = (st.paused ? 0 : dt) * w;

    tickTraining(simDelta, telemetry.sunlitFrac);

    // lifecycle: build rings on start, unlock + restore on finish
    if (training.active && !wasActive.current) {
      buildRings();
      wasActive.current = true;
    }
    if (!training.active && wasActive.current) {
      wasActive.current = false;
      ringsRef.current = null;
      st.setJobBusy(false);
      if (network.wingMaterial) network.wingMaterial.emissiveIntensity = 0.7;
    }

    const wing = network.wingMaterial;
    const pts = pointsRef.current;
    const sw = telemetry.satWorld;

    if (!training.active && training.flash <= 0) {
      if (wing) wing.emissiveIntensity = 0.7;
      if (pts) pts.geometry.setDrawRange(0, 0);
      return;
    }

    // COMPUTE: wings pulse in sync. ALL-REDUCE: hold baseline, waves carry it.
    if (wing) {
      wing.emissiveIntensity =
        training.active && training.phase === 'compute'
          ? 0.5 + 0.6 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 5))
          : 0.7;
    }

    if (!pts) return;
    const arr = (pts.geometry.getAttribute('position') as BufferAttribute).array as Float32Array;
    let li = 0;

    const rings = ringsRef.current;
    const flashing = training.flash > 0;

    if (flashing) {
      // cross-plane reduce flash: light the whole fleet briefly
      const n = Math.min(telemetry.count, MAX);
      for (let i = 0; i < n; i++) {
        arr[li * 3 + 0] = sw[i * 3]!;
        arr[li * 3 + 1] = sw[i * 3 + 1]!;
        arr[li * 3 + 2] = sw[i * 3 + 2]!;
        li++;
      }
    } else if (rings && training.phase === 'allreduce') {
      // traveling brightness window sweeping every plane's ring at once
      const s = training.phaseProgress;
      for (let p = 0; p < rings.length; p++) {
        const ring = rings[p]!;
        const m = ring.length;
        if (m < 2) continue;
        const headFrac = (((s + (p * 0.3) / TWO_PI) % 1) + 1) % 1;
        const head = Math.round(headFrac * m);
        for (let win = -1; win <= 1; win++) {
          const idx = ring[(((head + win) % m) + m) % m]!;
          arr[li * 3 + 0] = sw[idx * 3]!;
          arr[li * 3 + 1] = sw[idx * 3 + 1]!;
          arr[li * 3 + 2] = sw[idx * 3 + 2]!;
          li++;
        }
      }
    }

    (pts.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    mat.size = flashing ? 7 : 5;
    pts.geometry.setDrawRange(0, li);
  });

  return <points ref={pointsRef} args={[geom, mat]} frustumCulled={false} />;
}
