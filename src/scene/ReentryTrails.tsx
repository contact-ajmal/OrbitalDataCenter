import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineSegments,
  LineBasicMaterial,
  Vector3,
} from 'three';
import { network } from '../state/network';
import { telemetry } from '../state/telemetry';

const MAX_TRAILS = 10;
const TRAIL_POINTS = 10; // 10 points per trail = 9 segments = 18 vertices

type TrailState = {
  positions: Vector3[];
  fade: number; // 1.0 -> 0.0 after burn
  active: boolean;
};

export function ReentryTrails() {
  const lineRef = useRef<LineSegments>(null);

  // Keep track of trail histories in a ref (no react state re-renders at 60fps)
  const histories = useRef<Map<number, TrailState>>(new Map());

  const data = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(MAX_TRAILS * (TRAIL_POINTS - 1) * 2 * 3);
    const col = new Float32Array(MAX_TRAILS * (TRAIL_POINTS - 1) * 2 * 3);
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const colAttr = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);
    geo.setDrawRange(0, 0);

    const mat = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      linewidth: 2,
    });

    return { geo, mat, pos, col, posAttr, colAttr };
  }, []);

  const _red = useMemo(() => new Color('#ff2200'), []);
  const _orange = useMemo(() => new Color('#ff9900'), []);
  const _color = useMemo(() => new Color(), []);

  useFrame((_, dt) => {
    const st = useSimStore.getState();
    const sats = network.sats;
    const count = telemetry.count;
    const sw = telemetry.satWorld;
    if (count < 1 || !lineRef.current) return;

    const map = histories.current;

    // 1. Process active deorbiting satellites
    for (let i = 0; i < count; i++) {
      const s = sats[i];
      if (s?.deorbiting && !s.burned) {
        let trail = map.get(i);
        if (!trail) {
          trail = { positions: [], fade: 1.0, active: true };
          map.set(i, trail);
        }
        trail.active = true;

        const x = sw[i * 3] ?? 0;
        const y = sw[i * 3 + 1] ?? 0;
        const z = sw[i * 3 + 2] ?? 0;
        const pos = new Vector3(x, y, z);

        // Add to history
        trail.positions.push(pos);
        if (trail.positions.length > TRAIL_POINTS) {
          trail.positions.shift();
        }
      } else {
        const trail = map.get(i);
        if (trail) {
          trail.active = false;
        }
      }
    }

    // 2. Process fading/dead trails (decay fade factor)
    for (const [id, trail] of map.entries()) {
      if (!trail.active) {
        trail.fade -= dt * 1.5; // fade out over 0.67 seconds
        if (trail.positions.length > 0 && !st.paused) {
          // shift out positions slowly as it dies
          if (Math.random() < 0.25) trail.positions.shift();
        }
        if (trail.fade <= 0 || trail.positions.length <= 1) {
          map.delete(id);
        }
      }
    }

    // 3. Write lines to the lineSegments attribute buffers
    const posArr = data.pos;
    const colArr = data.col;
    let lineVertIdx = 0;

    for (const trail of map.values()) {
      const pts = trail.positions;
      if (pts.length < 2) continue;

      const numSegs = pts.length - 1;
      for (let j = 0; j < numSegs; j++) {
        const pStart = pts[j]!;
        const pEnd = pts[j + 1]!;

        // Write start point of segment
        posArr[lineVertIdx * 3 + 0] = pStart.x;
        posArr[lineVertIdx * 3 + 1] = pStart.y;
        posArr[lineVertIdx * 3 + 2] = pStart.z;

        // Write end point of segment
        posArr[lineVertIdx * 3 + 3] = pEnd.x;
        posArr[lineVertIdx * 3 + 4] = pEnd.y;
        posArr[lineVertIdx * 3 + 5] = pEnd.z;

        // Gradient color: tail (start of array) is red/dim, tip (end of array) is yellow/bright
        const ratioStart = j / numSegs;
        const ratioEnd = (j + 1) / numSegs;

        // Base color lerp
        _color.copy(_red).lerp(_orange, ratioStart);
        // Apply fade factor + tail tapering alpha
        const alphaStart = ratioStart * trail.fade * 0.8;
        colArr[lineVertIdx * 3 + 0] = _color.r * alphaStart;
        colArr[lineVertIdx * 3 + 1] = _color.g * alphaStart;
        colArr[lineVertIdx * 3 + 2] = _color.b * alphaStart;

        _color.copy(_red).lerp(_orange, ratioEnd);
        const alphaEnd = ratioEnd * trail.fade * 0.8;
        colArr[lineVertIdx * 3 + 3] = _color.r * alphaEnd;
        colArr[lineVertIdx * 3 + 4] = _color.g * alphaEnd;
        colArr[lineVertIdx * 3 + 5] = _color.b * alphaEnd;

        lineVertIdx += 2;
      }
    }

    data.posAttr.needsUpdate = true;
    data.colAttr.needsUpdate = true;
    data.geo.setDrawRange(0, lineVertIdx);
  });

  const activeTrailsCount = histories.current.size;
  if (activeTrailsCount === 0) return null;

  return <lineSegments ref={lineRef} geometry={data.geo} material={data.mat} frustumCulled={false} />;
}

// Small helper import to accesspaused state
import { useSimStore } from '../state/sim';
