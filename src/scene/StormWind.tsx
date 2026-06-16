import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { storm } from '../state/storm';
import { useSimStore } from '../state/sim';

const PARTICLE_COUNT = 250;
const STREAM_LENGTH = 30; // sweep distance (from -15 to +15)
const RADIUS = 11; // radius of solar wind cylinder

export function StormWind() {
  const pointsRef = useRef<Points>(null);

  // Initialize particles with randomized progress, speed, and cross-section offsets
  const data = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);

    // Keep parallel arrays for simulation state
    const progress = new Float32Array(PARTICLE_COUNT);
    const speed = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT * 2); // random u, v coords in cross-section disk

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      progress[i] = Math.random(); // staggered start
      speed[i] = 0.25 + Math.random() * 0.15; // 2.5 to 4 seconds to traverse

      // Uniform sampling in a circle
      const theta = Math.random() * 2 * Math.PI;
      const r = Math.sqrt(Math.random()) * RADIUS;
      offsets[i * 2 + 0] = r * Math.cos(theta); // u coord
      offsets[i * 2 + 1] = r * Math.sin(theta); // v coord
    }

    const mat = new PointsMaterial({
      color: new Color('#ff6a00'), // Hot solar orange
      size: 5.0,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0, // start invisible, fade in
      blending: AdditiveBlending,
      depthWrite: false,
    });

    return { geo, mat, posAttr, pos, progress, speed, offsets };
  }, []);

  // Tangents perpendicular to storm direction (computed on changes/frame)
  const uDir = useMemo(() => new Vector3(), []);
  const vDir = useMemo(() => new Vector3(), []);
  const lastDir = useMemo(() => new Vector3(), []);

  // Track overall storm fade (0 = inactive, 1 = active)
  const stormFadeRef = useRef(0);

  useFrame((_, dt) => {
    const active = storm.active;
    const posArr = data.pos;
    const st = useSimStore.getState();
    const paused = st.paused;
    const timeWarp = st.timeWarp;
    const sdt = paused ? 0 : dt;
    const warpFactor = 1 + Math.log10(timeWarp / 10 + 1);

    // 1. Smoothly fade storm wind opacity in/out
    const targetFade = active ? 1 : 0;
    stormFadeRef.current += (targetFade - stormFadeRef.current) * (1 - Math.exp(-dt / 0.8));
    data.mat.opacity = 0.55 * stormFadeRef.current;

    if (stormFadeRef.current < 0.01) {
      if (pointsRef.current) pointsRef.current.visible = false;
      return;
    }
    if (pointsRef.current) pointsRef.current.visible = true;

    // 2. Compute coordinate basis vectors perpendicular to storm direction
    const d = storm.dir;
    if (!lastDir.equals(d)) {
      lastDir.copy(d);
      // Find a non-collinear vector to cross with
      const temp = Math.abs(d.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      uDir.copy(d).cross(temp).normalize();
      vDir.copy(d).cross(uDir).normalize();
    }

    // 3. Move particles along storm direction and offset them into the stream cylinder
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (!paused) {
        data.progress[i] = (data.progress[i]! + sdt * data.speed[i]! * warpFactor) % 1;
      }

      const prog = data.progress[i]!;
      const u = data.offsets[i * 2 + 0]!;
      const v = data.offsets[i * 2 + 1]!;

      // Position from -STREAM_LENGTH/2 to +STREAM_LENGTH/2 along storm.dir
      const dist = -STREAM_LENGTH / 2 + STREAM_LENGTH * prog;

      posArr[i * 3 + 0] = d.x * dist + uDir.x * u + vDir.x * v;
      posArr[i * 3 + 1] = d.y * dist + uDir.y * u + vDir.y * v;
      posArr[i * 3 + 2] = d.z * dist + uDir.z * u + vDir.z * v;
    }

    data.posAttr.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={data.geo} material={data.mat} frustumCulled={false} />;
}
