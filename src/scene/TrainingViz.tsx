import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points, PointsMaterial, Vector3 } from 'three';
import { NOMINAL_WARP, SCENE } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { useSimStore } from '../state/sim';
import { tickTraining, training } from '../sim/training';
import { stationWorld } from '../lib/stations';

const MAX = SCENE.MAX_SATS;
const TWO_PI = Math.PI * 2;
const _bastrop = new Vector3();

/** Visualizes COMPUTE (wing pulse) + ALL-REDUCE (ring waves) during training. */
export function TrainingViz() {
  const pointsRef = useRef<Points>(null);
  const ringsRef = useRef<number[][] | null>(null);
  const wasActive = useRef(false);

  const geom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(MAX * 3), 3));
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
        vertexColors: true,
        size: 7,
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
    const col = (pts.geometry.getAttribute('color') as BufferAttribute).array as Float32Array;
    let li = 0;

    const rings = ringsRef.current;
    const flashing = training.flash > 0;

    if (flashing) {
      // Grok Consensus Pulse gold wave propagation from Bastrop
      const flashT = 0.25 - training.flash; // 0..0.25
      const waveFront = flashT * ((SCENE.ORBIT_R * 2.2) / 0.25);
      stationWorld(0, _bastrop);

      const n = Math.min(telemetry.count, MAX);
      for (let i = 0; i < n; i++) {
        const sx = sw[i * 3]!;
        const sy = sw[i * 3 + 1]!;
        const sz = sw[i * 3 + 2]!;

        arr[li * 3 + 0] = sx;
        arr[li * 3 + 1] = sy;
        arr[li * 3 + 2] = sz;

        const dx = sx - _bastrop.x;
        const dy = sy - _bastrop.y;
        const dz = sz - _bastrop.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;

        let r = 0.3;
        let g = 0.8;
        let b = 1.0;

        if (dist < waveFront) {
          if (waveFront - dist < 15.0) {
            // Gold wave front
            r = 1.0;
            g = 0.85;
            b = 0.15;
          } else {
            // Cyan trail
            r = 0.3;
            g = 0.8;
            b = 1.0;
          }
        } else {
          // Dim blue before wave reaches
          r = 0.08;
          g = 0.15;
          b = 0.22;
        }

        col[li * 3 + 0] = r;
        col[li * 3 + 1] = g;
        col[li * 3 + 2] = b;
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

          // Color these points light cyan/blue
          col[li * 3 + 0] = 0.5;
          col[li * 3 + 1] = 0.85;
          col[li * 3 + 2] = 1.0;

          li++;
        }
      }
    }

    (pts.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (pts.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
    mat.size = flashing ? 8 : 5;
    pts.geometry.setDrawRange(0, li);
  });

  return <points ref={pointsRef} args={[geom, mat]} frustumCulled={false} />;
}
