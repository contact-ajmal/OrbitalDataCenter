import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { useSimStore } from '../state/sim';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { stationWorld } from '../lib/stations';
import { greedyRoute } from '../sim/links';
import type { Vec3 } from '../sim/constellation';

const ROUTE_CONFIGS = [
  { start: 0, end: 1, color: new Color('#00f3ff'), name: 'BASTROP-YORK' }, // Cyan
  { start: 1, end: 3, color: new Color('#00ff66'), name: 'YORK-TYO' },      // Green
  { start: 3, end: 2, color: new Color('#ffcc00'), name: 'TYO-SYD' },      // Gold
  { start: 2, end: 0, color: new Color('#ff00cc'), name: 'SYD-BASTROP' },  // Magenta
];

const PACKETS_PER_ROUTE = 4;
const MAX_NODES = 32;

// Scratch variables
const _a = new Vector3();
const _b = new Vector3();

export function TrafficPackets() {
  const active = useSimStore((s) => s.toggles.traffic);

  // Reference for the packets Points
  const pointsRef = useRef<Points>(null);

  // Setup geometries and materials
  const lines = useMemo(() => {
    return ROUTE_CONFIGS.map((cfg) => {
      const geo = new BufferGeometry();
      geo.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(MAX_NODES * 3), 3).setUsage(DynamicDrawUsage)
      );
      geo.setDrawRange(0, 0);

      const mat = new LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.2,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const lineInstance = new Line(geo, mat);
      lineInstance.frustumCulled = false;
      return lineInstance;
    });
  }, []);

  const packetsData = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(ROUTE_CONFIGS.length * PACKETS_PER_ROUTE * 3);
    const col = new Float32Array(ROUTE_CONFIGS.length * PACKETS_PER_ROUTE * 3);
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const colAttr = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);

    // Initial packet colors and offsets
    const progress = new Float32Array(ROUTE_CONFIGS.length * PACKETS_PER_ROUTE);
    for (let r = 0; r < ROUTE_CONFIGS.length; r++) {
      const color = ROUTE_CONFIGS[r]!.color;
      for (let p = 0; p < PACKETS_PER_ROUTE; p++) {
        const idx = r * PACKETS_PER_ROUTE + p;
        progress[idx] = p / PACKETS_PER_ROUTE; // space out initial progress
        col[idx * 3 + 0] = color.r;
        col[idx * 3 + 1] = color.g;
        col[idx * 3 + 2] = color.b;
      }
    }

    const mat = new PointsMaterial({
      size: 4.5,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    return { geo, mat, progress, posAttr, colAttr, pos };
  }, []);

  useFrame((_, dt) => {
    if (!active) return;

    const count = telemetry.count;
    const sw = telemetry.satWorld;
    if (count < 2 || network.adj.length < count) return;

    const st = useSimStore.getState();
    const paused = st.paused;
    const timeWarp = st.timeWarp;
    const sdt = paused ? 0 : dt;
    const warpFactor = 1 + Math.log10(timeWarp / 10 + 1);

    // Track the 16 packet positions
    const posArr = packetsData.pos;

    ROUTE_CONFIGS.forEach((cfg, rIdx) => {
      // 1. Resolve geographic positions of start/end stations
      stationWorld(cfg.start, _a);
      stationWorld(cfg.end, _b);

      // 2. Find nearest satellite to start station
      let startSat = 0;
      let bestD = Infinity;
      for (let i = 0; i < count; i++) {
        const dx = sw[i * 3]! - _a.x;
        const dy = sw[i * 3 + 1]! - _a.y;
        const dz = sw[i * 3 + 2]! - _a.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
          bestD = d;
          startSat = i;
        }
      }

      // 3. Compute routing path
      const target: Vec3 = [_b.x, _b.y, _b.z];
      const acc = (i: number): Vec3 => [sw[i * 3]!, sw[i * 3 + 1]!, sw[i * 3 + 2]!];
      const route = greedyRoute(network.adj, acc, startSat, target, 24);

      // Create full node position list: Start Station -> Satellite Hops -> End Station
      const pathPos: Vector3[] = [];
      pathPos.push(_a.clone());
      route.forEach((satIdx) => {
        pathPos.push(new Vector3(sw[satIdx * 3]!, sw[satIdx * 3 + 1]!, sw[satIdx * 3 + 2]!));
      });
      pathPos.push(_b.clone());

      // 4. Update the line path coordinates
      const line = lines[rIdx];
      if (line) {
        const lineGeo = line.geometry;
        const linePosAttr = lineGeo.getAttribute('position') as BufferAttribute;
        const lineArr = linePosAttr.array as Float32Array;

        const drawCount = Math.min(MAX_NODES, pathPos.length);
        for (let i = 0; i < drawCount; i++) {
          const pt = pathPos[i]!;
          lineArr[i * 3 + 0] = pt.x;
          lineArr[i * 3 + 1] = pt.y;
          lineArr[i * 3 + 2] = pt.z;
        }
        linePosAttr.needsUpdate = true;
        lineGeo.setDrawRange(0, drawCount);
      }

      // 5. Animate and position the packets along this path
      for (let p = 0; p < PACKETS_PER_ROUTE; p++) {
        const idx = rIdx * PACKETS_PER_ROUTE + p;

        // Advance progress
        if (!paused) {
          // Takes ~5 seconds per loop at 1x speed, scaled by warp
          packetsData.progress[idx] = (packetsData.progress[idx]! + sdt * 0.2 * warpFactor) % 1;
        }

        const prog = packetsData.progress[idx]!;
        const numSegs = pathPos.length - 1;
        if (numSegs > 0) {
          const segFloat = prog * numSegs;
          const segIdx = Math.floor(segFloat);
          const localT = segFloat - segIdx;

          const pStart = pathPos[segIdx]!;
          const pEnd = pathPos[Math.min(numSegs, segIdx + 1)]!;

          posArr[idx * 3 + 0] = pStart.x + (pEnd.x - pStart.x) * localT;
          posArr[idx * 3 + 1] = pStart.y + (pEnd.y - pStart.y) * localT;
          posArr[idx * 3 + 2] = pStart.z + (pEnd.z - pStart.z) * localT;
        }
      }
    });

    packetsData.posAttr.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group>
      {/* 4 Trunk Lines */}
      {lines.map((lineInstance, idx) => (
        <primitive key={idx} object={lineInstance} />
      ))}

      {/* Packet Points */}
      <points ref={pointsRef} geometry={packetsData.geo} material={packetsData.mat} frustumCulled={false} />
    </group>
  );
}
