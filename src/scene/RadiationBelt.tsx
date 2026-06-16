import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';

const TORUS_RADIUS = 120;
const TUBE_RADIUS = 24;

export function RadiationBelt() {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Volumetric points geometry for the inner Van Allen belt torus ring
  const geom = useMemo(() => {
    return new THREE.TorusGeometry(TORUS_RADIUS, TUBE_RADIUS, 16, 120);
  }, []);

  const mat = useMemo(() => {
    return new THREE.PointsMaterial({
      color: 0xee55ff, // sci-fi neon magenta/purple glow
      size: 0.18,
      transparent: true,
      opacity: 0.08, // soft volumetric background glow
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame(() => {
    const sw = telemetry.satWorld;
    const n = telemetry.count;
    const rad = telemetry.satRadiation;

    // Evaluate SAA / Van Allen belt boundary intersection for each active satellite
    for (let i = 0; i < n; i++) {
      const sat = network.sats[i];
      if (!sat || sat.burned) {
        rad[i] = 0;
        continue;
      }

      const x = sw[i * 3 + 0]!;
      const y = sw[i * 3 + 1]!;
      const z = sw[i * 3 + 2]!;

      // Torus is centered on the equatorial X-Z plane
      const dist2D = Math.hypot(x, z);
      const dx = dist2D - TORUS_RADIUS;
      const dy = y;
      const distFromTubeCenter = Math.hypot(dx, dy);

      // Check if satellite's coordinates fall inside the torus tube boundary
      if (distFromTubeCenter < TUBE_RADIUS) {
        rad[i] = 1; // Satellite exposed to high radiation zone
      } else {
        rad[i] = 0;
      }
    }
  });

  return <points ref={pointsRef} args={[geom, mat]} frustumCulled={false} />;
}
