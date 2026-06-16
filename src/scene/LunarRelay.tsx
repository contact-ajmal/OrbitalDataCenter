import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';

const MOON_TILT = (5.1 * Math.PI) / 180;
const MOON_DIST = 1450;
const MOON_RATE = 0.02 / 27.3;

export function LunarRelay() {
  const lineRef = useRef<THREE.Line>(null);
  const labelRef = useRef<THREE.Group>(null);

  // Pre-allocated coordinates and vectors to prevent per-frame garbage collection
  const moonPos = useMemo(() => new THREE.Vector3(), []);
  const moonDir = useMemo(() => new THREE.Vector3(), []);
  const satPos = useMemo(() => new THREE.Vector3(), []);
  const labelPos = useMemo(() => new THREE.Vector3(), []);

  const linePositions = useMemo(() => new Float32Array(2 * 3), []);
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    return geo;
  }, [linePositions]);

  const lineMat = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0x9955ff, // bright violet/indigo laser
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame(() => {
    // Replicate Moon's orbital Y-spin and tilt to find its exact current world coordinates
    const angle = telemetry.simT * MOON_RATE;
    moonPos.set(MOON_DIST, 0, 0);
    moonPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    moonPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), MOON_TILT);

    moonDir.copy(moonPos).normalize();

    let bestIdx = -1;
    let bestDot = -Infinity;
    const n = telemetry.count;

    // Greedy search for the active line-of-sight relay satellite facing the Moon
    for (let i = 0; i < n; i++) {
      const sat = network.sats[i];
      if (!sat || sat.burned || sat.deorbiting || sat.lowPower) continue;

      const sx = telemetry.satWorld[i * 3]!;
      const sy = telemetry.satWorld[i * 3 + 1]!;
      const sz = telemetry.satWorld[i * 3 + 2]!;
      
      const dot = sx * moonDir.x + sy * moonDir.y + sz * moonDir.z;
      if (dot > bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    }

    telemetry.lunarRelayIdx = bestIdx;

    const line = lineRef.current;
    const label = labelRef.current;

    if (bestIdx >= 0) {
      satPos.set(
        telemetry.satWorld[bestIdx * 3 + 0]!,
        telemetry.satWorld[bestIdx * 3 + 1]!,
        telemetry.satWorld[bestIdx * 3 + 2]!
      );

      // Update line segment positions
      linePositions[0] = satPos.x;
      linePositions[1] = satPos.y;
      linePositions[2] = satPos.z;
      linePositions[3] = moonPos.x;
      linePositions[4] = moonPos.y;
      linePositions[5] = moonPos.z;

      if (line) {
        line.geometry.getAttribute('position').needsUpdate = true;
        line.visible = true;
      }

      // Float label 5% above the satellite's orbital altitude
      labelPos.copy(satPos).multiplyScalar(1.05);
      if (label) {
        label.position.copy(labelPos);
        label.visible = true;
      }
    } else {
      if (line) line.visible = false;
      if (label) label.visible = false;
    }
  });

  return (
    <>
      <primitive object={new THREE.Line(lineGeo, lineMat)} ref={lineRef} />
      <group ref={labelRef} visible={false}>
        <Html distanceFactor={14} center>
          <div className="pointer-events-none whitespace-nowrap rounded-sm border border-violet-500 bg-black/85 px-1.5 py-0.5 text-[8px] uppercase tracking-[.18em] text-violet-400 font-bold shadow-[0_0_10px_rgba(153,85,255,0.4)]">
            📡 Lunar Deep-Link
          </div>
        </Html>
      </group>
    </>
  );
}
