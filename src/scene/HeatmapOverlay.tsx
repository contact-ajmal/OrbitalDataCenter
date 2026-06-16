import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  LineSegments,
  LineBasicMaterial,
  Points,
  PointsMaterial,
} from 'three';
import { useSimStore } from '../state/sim';
import { earthGroupRef } from '../state/world';
import { latLonToVec } from '../lib/geo';
import { SCENE } from '../lib/constants';

const EARTH_R = SCENE.EARTH_R;
const SHELL_R = EARTH_R * 1.008; // holographic wireframe grid shell radius

const CITIES = [
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'New York', lat: 40.71, lon: -74.00 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Tokyo', lat: 35.68, lon: 139.76 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Cape Town', lat: -33.93, lon: 18.42 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'Anchorage', lat: 61.22, lon: -149.90 },
  { name: 'Honolulu', lat: 21.31, lon: -157.86 },
];

export function HeatmapOverlay() {
  const active = useSimStore((s) => s.toggles.heatmap);
  const groupRef = useRef<Group>(null);
  const shellRef = useRef<Group>(null);
  const spikesRef = useRef<LineSegments>(null);
  const beaconsRef = useRef<Points>(null);

  // Compute base coordinates for the 16 cities
  const cityBases = useMemo(() => {
    return CITIES.map((c) => latLonToVec(c.lat, c.lon, SHELL_R));
  }, []);

  // Pre-allocate line segment buffers for vertical spikes (16 lines = 32 vertices)
  const spikesData = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(CITIES.length * 2 * 3);
    const col = new Float32Array(CITIES.length * 2 * 3);
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const colAttr = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);

    const mat = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    return { geo, mat, posAttr, colAttr, pos, col };
  }, []);

  // Pre-allocate points for pulsing beacons on the surface
  const beaconsData = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(CITIES.length * 3);
    const col = new Float32Array(CITIES.length * 3);
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const colAttr = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);

    // Seed initial positions
    for (let i = 0; i < CITIES.length; i++) {
      const p = cityBases[i]!;
      pos[i * 3 + 0] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
    }
    posAttr.needsUpdate = true;

    const mat = new PointsMaterial({
      size: 6.0,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    return { geo, mat, colAttr, col };
  }, [cityBases]);

  // Modulate demand color
  const _lowCol = useMemo(() => new Color('#00aeff'), []); // Cyan/blue
  const _highCol = useMemo(() => new Color('#ff3b30'), []); // Hot red
  const _color = useMemo(() => new Color(), []);

  useFrame((state, dt) => {
    if (!active) return;

    // 1. Match the rotating Earth's rotation
    const earth = earthGroupRef.current;
    if (earth && groupRef.current) {
      groupRef.current.rotation.copy(earth.rotation);
    }

    // 2. Slow scan spin of the holographic wireframe shell
    if (shellRef.current) {
      shellRef.current.rotation.y += dt * 0.05;
      shellRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.1;
    }

    // 3. Update city beacons and vertical spikes
    const time = state.clock.getElapsedTime();
    const spikesPos = spikesData.pos;
    const spikesCol = spikesData.col;
    const beaconsCol = beaconsData.col;

    for (let i = 0; i < CITIES.length; i++) {
      const base = cityBases[i]!;

      // Fluctuate demand (0.0 to 1.0) using overlapping waves
      const demand = 0.2 + 0.8 * Math.abs(
        Math.sin(time * 0.8 + i * 2) * Math.cos(time * 0.3 - i * 1.5)
      );

      // Spike height (extends radially outwards)
      const height = 0.08 + demand * 0.45; // max height ~2.2 km scale
      const tipX = base.x * (1 + height);
      const tipY = base.y * (1 + height);
      const tipZ = base.z * (1 + height);

      // Write positions of line segment: base -> tip
      spikesPos[i * 6 + 0] = base.x;
      spikesPos[i * 6 + 1] = base.y;
      spikesPos[i * 6 + 2] = base.z;
      spikesPos[i * 6 + 3] = tipX;
      spikesPos[i * 6 + 4] = tipY;
      spikesPos[i * 6 + 5] = tipZ;

      // Map demand to color
      _color.copy(_lowCol).lerp(_highCol, demand);

      // Write colors: base has lower opacity, tip has full color
      spikesCol[i * 6 + 0] = _color.r * 0.4;
      spikesCol[i * 6 + 1] = _color.g * 0.4;
      spikesCol[i * 6 + 2] = _color.b * 0.4;
      spikesCol[i * 6 + 3] = _color.r;
      spikesCol[i * 6 + 4] = _color.g;
      spikesCol[i * 6 + 5] = _color.b;

      // Base beacon color
      beaconsCol[i * 3 + 0] = _color.r;
      beaconsCol[i * 3 + 1] = _color.g;
      beaconsCol[i * 3 + 2] = _color.b;
    }

    spikesData.posAttr.needsUpdate = true;
    spikesData.colAttr.needsUpdate = true;
    beaconsData.colAttr.needsUpdate = true;

    // Modulate points size slightly to create a pulsing/breathing beacon effect
    if (beaconsRef.current) {
      (beaconsRef.current.material as PointsMaterial).size = 5.0 + Math.sin(time * 6) * 1.5;
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {/* 1. Holographic wireframe grid shell */}
      <group ref={shellRef}>
        <mesh>
          <sphereGeometry args={[SHELL_R, 32, 24]} />
          <meshBasicMaterial
            color="#0066ff"
            wireframe
            transparent
            opacity={0.1}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 2. Vertical demand spikes */}
      <lineSegments ref={spikesRef} geometry={spikesData.geo} material={spikesData.mat} frustumCulled={false} />

      {/* 3. Base beacon points */}
      <points ref={beaconsRef} geometry={beaconsData.geo} material={beaconsData.mat} frustumCulled={false} />
    </group>
  );
}
