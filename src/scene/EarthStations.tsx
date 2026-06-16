import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATIONS } from '../lib/stations';
import { latLonToVec } from '../lib/geo';
import { SCENE } from '../lib/constants';
import { useUiStore } from '../state/ui';

const STATION_R = SCENE.EARTH_R * 1.002;

interface StationProps {
  st: {
    name: string;
    pos: THREE.Vector3;
    quat: THREE.Quaternion;
    idx: number;
  };
  weatherState: string;
}

function SingleStation({ st, weatherState }: StationProps) {
  const dishGroupRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const solarRef1 = useRef<THREE.Group>(null);
  const solarRef2 = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const sdt = dt; // keep animations smooth regardless of pause state for visual fidelity
    const time = state.clock.getElapsedTime();

    // 1) Animate dish pan and tilt to simulate active tracking
    if (dishGroupRef.current) {
      dishGroupRef.current.rotation.y = Math.sin(time * 0.12 + st.idx * 1.7) * 0.22;
      dishGroupRef.current.rotation.x = 0.35 + Math.cos(time * 0.22 + st.idx * 1.3) * 0.08;
    }

    // 2) Pulsate volumetric uplink beam opacity
    if (beamRef.current) {
      const beamMat = beamRef.current.material as THREE.MeshBasicMaterial;
      beamMat.opacity = (0.22 + Math.sin(time * 14 + st.idx * 3.1) * 0.12) * 0.7;
    }

    // 3) Spin and scale the weather crystal hologram inside its glass dome
    if (crystalRef.current) {
      crystalRef.current.rotation.y += sdt * 1.6;
      crystalRef.current.rotation.z += sdt * 0.9;
      const scale = 0.9 + Math.sin(time * 6 + st.idx) * 0.1;
      crystalRef.current.scale.setScalar(scale);
    }

    // 4) Pivot solar arrays slowly
    if (solarRef1.current && solarRef2.current) {
      const targetRot = Math.sin(time * 0.06 + st.idx) * 0.35;
      solarRef1.current.rotation.z = targetRot;
      solarRef2.current.rotation.z = -targetRot;
    }
  });

  return (
    <group position={st.pos} quaternion={st.quat}>
      {/* Concrete Foundation Pad */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.5, 1.6, 0.1, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Surrounding Security Perimeter Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.8, 1.95, 24]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.4} />
      </mesh>

      {/* Glowing Power Conduit Grid (surface lines connecting elements) */}
      {/* Conduit from Dome to Dish Base */}
      <mesh position={[0.55, 0.065, -0.1]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[1.1, 0.012, 0.04]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
      </mesh>
      {/* Conduit from Generator to Dish Base */}
      <mesh position={[0.6, 0.065, 0.5]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.7, 0.012, 0.04]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
      </mesh>
      {/* Conduit from Solar Panels to building */}
      <mesh position={[-0.9, 0.065, 0.1]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.012, 0.04]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
      </mesh>

      {/* Main Control Terminal Building (low hexagonal housing) */}
      <mesh position={[-0.7, 0.2, -0.7]}>
        <cylinderGeometry args={[0.4, 0.45, 0.3, 6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Back-up Power Generator Box */}
      <mesh position={[-0.8, 0.15, 0.6]}>
        <boxGeometry args={[0.3, 0.3, 0.4]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>

      {/* Solar Panel Wing 1 (Pivoting) */}
      <group position={[-1.2, 0, -0.15]} ref={solarRef1}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.4, 0.012, 0.2]} />
          <meshStandardMaterial color="#1e2b4d" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Solar Panel Wing 2 (Pivoting) */}
      <group position={[-1.2, 0, 0.25]} ref={solarRef2}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.4, 0.012, 0.2]} />
          <meshStandardMaterial color="#1e2b4d" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Detailed Satellite Uplink Dish Assembly */}
      <group position={[0.4, 0, 0.4]}>
        {/* Strut Stand / Base */}
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.8, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>

        {/* Tracking Assembly Group */}
        <group position={[0, 0.8, 0]} ref={dishGroupRef}>
          {/* Rotator Yoke */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.2, 0.15, 0.25]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>

          {/* Dish Bowl & Feed Assembly */}
          <group position={[0, 0.15, 0]}>
            {/* Dish bowl */}
            <mesh>
              <coneGeometry args={[0.9, 0.35, 16, 1, true]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.35} roughness={0.55} side={THREE.DoubleSide} />
            </mesh>
            {/* Central feed horn support */}
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.9} />
            </mesh>
            {/* Transceiver Feed Horn tip */}
            <mesh position={[0, 0.68, 0]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>

            {/* Volumetric Laser Uplink Beam (additive blending cone) */}
            <mesh position={[0, 2.0, 0]} ref={beamRef}>
              <cylinderGeometry args={[0.01, 0.45, 2.6, 16, 1, true]} />
              <meshBasicMaterial
                color={weatherState === 'cloudy' ? '#f59e0b' : '#38bdf8'}
                transparent
                opacity={0.25}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* Glowing Optical Weather Indicator Dome */}
      <group position={[0.7, 0.15, -0.6]}>
        {/* Transparent outer glass dome */}
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.2} roughness={0.1} metalness={0.9} />
        </mesh>

        {/* Spinning holographic weather crystal */}
        <mesh position={[0, 0.12, 0]} ref={crystalRef}>
          <octahedronGeometry args={[0.12]} />
          <meshBasicMaterial
            color={weatherState === 'cloudy' ? '#ff9800' : '#8b5cf6'}
            wireframe
            transparent
            opacity={0.8}
          />
        </mesh>

        {/* Small status support ring */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.08, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export function EarthStations() {
  const weatherStates = useUiStore((s) => s.weatherStates);

  // Pre-calculate positions and rotations for the 4 ground stations
  const stationsData = useMemo(() => {
    return STATIONS.map((s, idx) => {
      const pos = latLonToVec(s.lat, s.lon, STATION_R);
      const normal = pos.clone().normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      return { name: s.name, pos, quat, idx };
    });
  }, []);

  return (
    <>
      {stationsData.map((st) => (
        <SingleStation key={st.name} st={st} weatherState={weatherStates[st.idx] || 'clear'} />
      ))}
    </>
  );
}
