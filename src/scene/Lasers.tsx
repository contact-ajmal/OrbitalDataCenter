import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  type LineSegments,
  type Points,
  PointsMaterial,
} from 'three';
import { SCENE, SCENE_COLORS } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { useSimStore } from '../state/sim';

const LINK_CAP = SCENE.MAX_SATS * 3; // generous upper bound on edges
const PULSE_COUNT = 420;

type Pulse = { linkIdx: number; t: number; v: number };

export function Lasers() {
  const lasers = useSimStore((s) => s.toggles.lasers);
  const linesRef = useRef<LineSegments>(null);
  const pulsesRef = useRef<Points>(null);

  // ── Link line segments ───────────────────────────────────────────────────
  const lineGeo = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(LINK_CAP * 2 * 3);
    const col = new Float32Array(LINK_CAP * 2 * 3);
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);
  const lineMat = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  // ── Data pulses ──────────────────────────────────────────────────────────
  const pulses = useMemo<Pulse[]>(
    () =>
      Array.from({ length: PULSE_COUNT }, () => ({
        linkIdx: 0,
        t: Math.random(),
        v: 0.6 + Math.random() * 0.8,
      })),
    [],
  );
  const pulseGeo = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(PULSE_COUNT * 3), 3));
    return geo;
  }, []);
  const pulseMat = useMemo(
    () =>
      new PointsMaterial({
        map: radialTexture([
          [0, 'rgba(220,250,255,1)'],
          [0.4, 'rgba(82,215,255,0.85)'],
          [1, 'rgba(82,215,255,0)'],
        ]),
        color: SCENE_COLORS.laser,
        size: 3.2,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  useFrame((_, dt) => {
    const sim = useSimStore.getState();
    if (!sim.toggles.lasers) return;
    const pairs = network.pairs;
    const np = pairs.length;
    const sw = telemetry.satWorld;
    if (!np) return;

    // refresh link line positions
    const lines = linesRef.current;
    if (lines) {
      const posAttr = lines.geometry.getAttribute('position') as BufferAttribute;
      const colAttr = lines.geometry.getAttribute('color') as BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;
      const drawn = Math.min(np, LINK_CAP);
      const rad = telemetry.satRadiation;
      const shieldActive = sim.shieldActive;
      const qkdActive = sim.qkdActive;

      for (let k = 0; k < drawn; k++) {
        const pair = pairs[k]!;
        const idxA = pair[0];
        const idxB = pair[1];
        const a = idxA * 3;
        const b = idxB * 3;
        const o = k * 6;

        arr[o + 0] = sw[a]!;
        arr[o + 1] = sw[a + 1]!;
        arr[o + 2] = sw[a + 2]!;
        arr[o + 3] = sw[b]!;
        arr[o + 4] = sw[b + 1]!;
        arr[o + 5] = sw[b + 2]!;

        // Radiation exposure causes purple/magenta flickering cross-talk
        const inRad = (rad[idxA] === 1 || rad[idxB] === 1) && !shieldActive;
        let r = 0.32;
        let g = 0.84;
        let bVal = 1.0;

        if (qkdActive) {
          r = 0.13;
          g = 0.95;
          bVal = 0.45;
        }

        if (inRad) {
          const f = 0.25 + 0.75 * Math.random();
          r = 0.95 * f;
          g = 0.1 * f;
          bVal = 0.9 * f;
        }

        colArr[o + 0] = r;
        colArr[o + 1] = g;
        colArr[o + 2] = bVal;
        colArr[o + 3] = r;
        colArr[o + 4] = g;
        colArr[o + 5] = bVal;
      }
      lines.geometry.setDrawRange(0, drawn * 2);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // advance + place pulses (frozen under pause)
    const sdt = sim.paused ? 0 : dt;
    const speedMultiplier = sim.qkdActive ? 2.0 : 1.0;
    const speed = sdt * (0.5 + sim.timeWarp * 0.004) * speedMultiplier;
    const pts = pulsesRef.current;
    if (pts) {
      const mat = pts.material as PointsMaterial;
      if (sim.qkdActive) {
        mat.color.setHex(0x39ff14); // neon green QKD pulses
      } else {
        mat.color.set(SCENE_COLORS.laser); // standard blue/cyan laser pulses
      }
      const posAttr = pts.geometry.getAttribute('position') as BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < PULSE_COUNT; i++) {
        const p = pulses[i]!;
        p.t += speed * p.v;
        if (p.t > 1 || p.linkIdx >= np) {
          p.t = 0;
          p.linkIdx = (Math.random() * np) | 0;
          p.v = 0.6 + Math.random() * 0.8;
        }
        const pair = pairs[p.linkIdx]!;
        const a = pair[0] * 3;
        const b = pair[1] * 3;
        const tt = p.t;
        arr[i * 3 + 0] = sw[a]! + (sw[b]! - sw[a]!) * tt;
        arr[i * 3 + 1] = sw[a + 1]! + (sw[b + 1]! - sw[a + 1]!) * tt;
        arr[i * 3 + 2] = sw[a + 2]! + (sw[b + 2]! - sw[a + 2]!) * tt;
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group visible={lasers}>
      <lineSegments ref={linesRef} args={[lineGeo, lineMat]} frustumCulled={false} />
      <points ref={pulsesRef} args={[pulseGeo, pulseMat]} frustumCulled={false} />
    </group>
  );
}
