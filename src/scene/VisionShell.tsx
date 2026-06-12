import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Points,
  PointsMaterial,
} from 'three';
import { INCLINATION_DEG, NOMINAL_WARP, SCENE, SCENE_COLORS } from '../lib/constants';
import { angleToPos } from '../sim/constellation';
import { toast } from '../lib/bus';
import { useSimStore } from '../state/sim';

const INC = (INCLINATION_DEG * Math.PI) / 180;
const ORBIT_R = SCENE.ORBIT_R;
const PLANES = 160;
const TOTAL = 60_000;
const PER_PLANE = Math.floor(TOTAL / PLANES);

/** Build the projected million-satellite shell (60k points, lazily). */
function buildShell(): Points {
  const positions = new Float32Array(PLANES * PER_PLANE * 3);
  const out: number[] = [0, 0, 0];
  let p = 0;
  for (let plane = 0; plane < PLANES; plane++) {
    const raan = (plane / PLANES) * 2 * Math.PI;
    for (let j = 0; j < PER_PLANE; j++) {
      const angle = Math.random() * 2 * Math.PI;
      const r = ORBIT_R + Math.random() * 7;
      angleToPos(angle, raan, INC, r, out);
      positions[p++] = out[0]!;
      positions[p++] = out[1]!;
      positions[p++] = out[2]!;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  const mat = new PointsMaterial({
    color: SCENE_COLORS.laser,
    size: 1.0,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return new Points(geo, mat);
}

export function VisionShell() {
  const visionOn = useSimStore((s) => s.visionOn);
  const groupRef = useRef<Group>(null);
  const shellRef = useRef<Points | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (visionOn && !shellRef.current) {
      shellRef.current = buildShell();
      setReady(true);
      toast('10⁶ VISION — 1,000,000 SATS · 120 GW · ~2.14 M T · PROJECTED');
    }
  }, [visionOn]);

  useFrame((_, dt) => {
    if (!visionOn || !groupRef.current) return;
    const st = useSimStore.getState();
    const sdt = st.paused ? 0 : dt;
    const w = st.timeWarp / NOMINAL_WARP;
    groupRef.current.rotation.y += sdt * 0.01 * w;
  });

  return (
    <group ref={groupRef} visible={visionOn}>
      {ready && shellRef.current && <primitive object={shellRef.current} frustumCulled={false} />}
    </group>
  );
}
