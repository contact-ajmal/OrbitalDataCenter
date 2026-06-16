import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, useTexture } from '@react-three/drei';
import { NOMINAL_WARP } from '../lib/constants';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';
import { on, toast } from '../lib/bus';

// Constants
const EM_DIST = 1450;
const MARS_DIST = 2600;

// Scratch vectors for zero-allocation useFrame loops
const _pStart = new THREE.Vector3();
const _pEnd = new THREE.Vector3();
const _pMid = new THREE.Vector3();
const _shipPos = new THREE.Vector3();
const _velDir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

const UP = new THREE.Vector3(0, 1, 0);

type TransitShip = {
  name: string;
  type: 'earth-moon' | 'moon-mars' | 'earth-mars';
  period: number; // in seconds
  offset: number; // phase offset
  label: string;
  color: string;
};

const SHIPS: TransitShip[] = [
  {
    name: 'Starship Artemis-II',
    type: 'earth-moon',
    period: 45,
    offset: 0,
    label: '🚀 Starship Artemis-II (Earth-Moon Cargo)',
    color: '#a78bfa',
  },
  {
    name: 'Starship Ares',
    type: 'earth-mars',
    period: 120,
    offset: 0.3,
    label: '🚀 Starship Ares (Earth-Mars Cargo)',
    color: '#ff5533',
  },
  {
    name: 'Starship Olympus-III',
    type: 'moon-mars',
    period: 90,
    offset: 0.6,
    label: '🚀 Starship Olympus-III (Moon-Mars Transit)',
    color: '#f59e0b',
  },
];

type ActiveThreat = {
  target: 'moon' | 'mars';
  spawnPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number; // 0..1
  speed: number;
};

export function DeepSpaceSandbox() {
  const [threat, setThreat] = useState<ActiveThreat | null>(null);
  const [laserActive, setLaserActive] = useState(false);
  const starshipSpaceTex = useTexture('/textures/starship/starship-space.png');

  // References for animating the Lagrange points
  const emL1Ref = useRef<THREE.Group>(null);
  const emL2Ref = useRef<THREE.Group>(null);
  const marsL1Ref = useRef<THREE.Group>(null);

  const moonShieldRef = useRef<THREE.Mesh>(null);
  const marsShieldRef = useRef<THREE.Mesh>(null);

  const threatRef = useRef<THREE.Group>(null);
  const explosionRef = useRef<THREE.Group>(null);
  const explosionTime = useRef<number>(-1);

  const shipRefs = useRef<(THREE.Group | null)[]>([]);
  const shipPlumeRefs = useRef<(THREE.Mesh | null)[]>([]);


  const l1Positions = useMemo(() => new Float32Array(2 * 3), []);
  const l2Positions = useMemo(() => new Float32Array(2 * 3), []);
  const marsL1Positions = useMemo(() => new Float32Array(2 * 3), []);
  const threatPositions = useMemo(() => new Float32Array(2 * 3), []);

  const goldLineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const greenLineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const l1Line = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(l1Positions, 3));
    return new THREE.Line(geom, goldLineMat);
  }, [l1Positions, goldLineMat]);

  const l2Line = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(l2Positions, 3));
    return new THREE.Line(geom, goldLineMat);
  }, [l2Positions, goldLineMat]);

  const marsL1Line = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(marsL1Positions, 3));
    return new THREE.Line(geom, goldLineMat);
  }, [marsL1Positions, goldLineMat]);

  const threatLine = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(threatPositions, 3));
    return new THREE.Line(geom, greenLineMat);
  }, [threatPositions, greenLineMat]);

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.95,
        roughness: 0.1,
      }),
    []
  );

  const solarMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x1b2b4d,
        metalness: 0.8,
        roughness: 0.2,
      }),
    []
  );

  // ── Listen for threat trigger event ──────────────────────────────────────
  const threatRefState = useRef<ActiveThreat | null>(null);
  threatRefState.current = threat;

  useEffect(() => {
    return on('deepspace:threat', () => {
      if (threatRefState.current) {
        toast('DEFENSE GRID ACTIVE: THREAT ALREADY DETECTED');
        return;
      }
      const target = Math.random() > 0.5 ? 'moon' : 'mars';
      const targetPos = new THREE.Vector3();

      if (target === 'moon') {
        targetPos.set(telemetry.moonWorld[0] ?? 0, telemetry.moonWorld[1] ?? 0, telemetry.moonWorld[2] ?? 0);
      } else {
        targetPos.set(telemetry.marsWorld[0] ?? 0, telemetry.marsWorld[1] ?? 0, telemetry.marsWorld[2] ?? 0);
      }

      // Spawn threat 260 units away from target, drifting inwards
      const dir = targetPos.clone().normalize();
      const spawnPos = targetPos.clone().addScaledVector(dir, 260);

      setThreat({
        target,
        spawnPos,
        targetPos,
        progress: 0,
        speed: 0.12, // progresses 0..1 in ~8 seconds
      });
      toast(`[ALERT] INCOMING DEBRIS THREAT DETECTED TARGETING ${target.toUpperCase()}`);
    });
  }, []);

  useFrame((state, dt) => {
    const sdt = dt;
    const time = state.clock.getElapsedTime();
    const w = useSimStore.getState().timeWarp / NOMINAL_WARP;

    // Get live coordinates of Moon and Mars bases
    const pMoon = new THREE.Vector3(telemetry.moonWorld[0] || 0, telemetry.moonWorld[1] || 0, telemetry.moonWorld[2] || 0);
    const pMars = new THREE.Vector3(telemetry.marsWorld[0] || 0, telemetry.marsWorld[1] || 0, telemetry.marsWorld[2] || 0);
    const pEarth = new THREE.Vector3(0, 0, 0);

    // ── 1. Update Lagrange Point Positions & communication lines ────────────
    // EM-L1 (along Earth-Moon axis, between Earth and Moon at 82%)
    if (emL1Ref.current) {
      const dirMoon = pMoon.clone().normalize();
      const posL1 = dirMoon.clone().multiplyScalar(EM_DIST * 0.82);
      emL1Ref.current.position.copy(posL1);
      emL1Ref.current.rotation.y = time * 0.25;

      // Link EM-L1 to Moon base
      l1Positions[0] = posL1.x;
      l1Positions[1] = posL1.y;
      l1Positions[2] = posL1.z;
      l1Positions[3] = pMoon.x;
      l1Positions[4] = pMoon.y;
      l1Positions[5] = pMoon.z;
      {
        l1Line.geometry.getAttribute('position').needsUpdate = true;
        (l1Line.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(time * 6) * 0.25;
      }
    }

    // EM-L2 (along Earth-Moon axis, beyond Moon at 118%)
    if (emL2Ref.current) {
      const dirMoon = pMoon.clone().normalize();
      const posL2 = dirMoon.clone().multiplyScalar(EM_DIST * 1.18);
      emL2Ref.current.position.copy(posL2);
      emL2Ref.current.rotation.y = time * 0.25;

      // Link EM-L2 to Moon base
      l2Positions[0] = posL2.x;
      l2Positions[1] = posL2.y;
      l2Positions[2] = posL2.z;
      l2Positions[3] = pMoon.x;
      l2Positions[4] = pMoon.y;
      l2Positions[5] = pMoon.z;
      {
        l2Line.geometry.getAttribute('position').needsUpdate = true;
        (l2Line.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(time * 6) * 0.25;
      }
    }

    // Mars-L1 (along Earth-Mars axis, between Earth and Mars at 90%)
    if (marsL1Ref.current) {
      const dirMars = pMars.clone().normalize();
      const posMarsL1 = dirMars.clone().multiplyScalar(MARS_DIST * 0.9);
      marsL1Ref.current.position.copy(posMarsL1);
      marsL1Ref.current.rotation.y = time * 0.15;

      // Link Mars-L1 to Mars Base
      marsL1Positions[0] = posMarsL1.x;
      marsL1Positions[1] = posMarsL1.y;
      marsL1Positions[2] = posMarsL1.z;
      marsL1Positions[3] = pMars.x;
      marsL1Positions[4] = pMars.y;
      marsL1Positions[5] = pMars.z;
      {
        marsL1Line.geometry.getAttribute('position').needsUpdate = true;
        (marsL1Line.material as THREE.LineBasicMaterial).opacity = 0.55 + Math.sin(time * 6) * 0.25;
      }
    }

    // ── 2. Update Transiting Starships ──────────────────────────────────────
    SHIPS.forEach((s, idx) => {
      const shipGroup = shipRefs.current[idx];
      if (!shipGroup) return;

      // Calculate path endpoints based on type
      if (s.type === 'earth-moon') {
        _pStart.copy(pEarth);
        _pEnd.copy(pMoon);
      } else if (s.type === 'earth-mars') {
        _pStart.copy(pEarth);
        _pEnd.copy(pMars);
      } else {
        _pStart.copy(pMoon);
        _pEnd.copy(pMars);
      }

      // Compute progress: cycles 0..1..0 (outward and return)
      const totalTime = s.period;
      const tNorm = ((time * w) / totalTime + s.offset) % 1.0;
      const isReturn = tNorm > 0.5;
      // p goes 0 -> 1 -> 0
      const p = isReturn ? (1.0 - tNorm) * 2.0 : tNorm * 2.0;

      // Bezier control point for a nice arched flight path
      _pMid.addVectors(_pStart, _pEnd).multiplyScalar(0.5);
      const arcHeight = s.type === 'earth-mars' ? 500 : 250;
      _pMid.y += arcHeight * Math.sin(p * Math.PI); // arch upward

      // Quadratic Bezier interpolation
      const mt = 1.0 - p;
      _shipPos.set(0, 0, 0)
        .addScaledVector(_pStart, mt * mt)
        .addScaledVector(_pMid, 2.0 * mt * p)
        .addScaledVector(_pEnd, p * p);

      shipGroup.position.copy(_shipPos);

      // Orientation matching velocity tangent
      // approximate next position to compute velocity vector
      const nextP = p + 0.005;
      const nmt = 1.0 - nextP;
      _velDir.set(0, 0, 0)
        .addScaledVector(_pStart, nmt * nmt)
        .addScaledVector(_pMid, 2.0 * nmt * nextP)
        .addScaledVector(_pEnd, nextP * nextP)
        .sub(_shipPos)
        .normalize();

      if (isReturn) _velDir.multiplyScalar(-1.0); // reverse direction representation

      _quat.setFromUnitVectors(UP, _velDir);
      shipGroup.quaternion.copy(_quat);

      // Pulsate the thruster scale
      const plume = shipPlumeRefs.current[idx];
      if (plume) {
        plume.scale.setScalar(0.8 + Math.sin(time * 24 + idx) * 0.3);
      }
    });

    // ── 3. Update Keplerian Debris Threat & Defense Laser ───────────────────
    if (threat) {
      // Refresh live target positions (since Moon/Mars move)
      const targetPos = threat.target === 'moon' ? pMoon : pMars;
      threat.targetPos.copy(targetPos);

      // Advance progress
      const nextProgress = threat.progress + sdt * threat.speed * w;
      if (nextProgress >= 1) {
        // Intercept completed/Vaporized
        explosionTime.current = 0;
        if (explosionRef.current) {
          explosionRef.current.position.copy(targetPos);
          explosionRef.current.visible = true;
          const mesh1 = explosionRef.current.children[0] as THREE.Mesh;
          const mesh2 = explosionRef.current.children[1] as THREE.Mesh;
          if (mesh1) {
            mesh1.scale.setScalar(1);
            (mesh1.material as THREE.MeshBasicMaterial).opacity = 1;
          }
          if (mesh2) {
            mesh2.scale.setScalar(1);
            (mesh2.material as THREE.MeshBasicMaterial).opacity = 1;
          }
        }
        setThreat(null);
        setLaserActive(false);
        toast(`[DEFENSE GRID] METEORITE INTERCEPT COMPLETED — ${threat.target.toUpperCase()} SHIELDS NOMINAL`);
      } else {
        threat.progress = nextProgress;
        // Interpolate threat position moving linearly from spawnPos to targetPos
        const currentPos = new THREE.Vector3().lerpVectors(threat.spawnPos, targetPos, nextProgress);
        if (threatRef.current) {
          threatRef.current.position.copy(currentPos);
        }

        // Turn on defense laser when threat gets close (<55% distance remaining)
        if (nextProgress > 0.45) {
          setLaserActive(true);
          // Laser beam from base receiver dome to threat position
          threatPositions[0] = targetPos.x;
          threatPositions[1] = targetPos.y;
          threatPositions[2] = targetPos.z;
          threatPositions[3] = currentPos.x;
          threatPositions[4] = currentPos.y;
          threatPositions[5] = currentPos.z;

          threatLine.geometry.getAttribute('position').needsUpdate = true;
        }
      }
    }

    // Update explosion timer (warp-sensitive, performance-optimized ref updates)
    if (explosionTime.current >= 0) {
      const nextT = explosionTime.current + sdt * 2 * w;
      if (nextT >= 1) {
        explosionTime.current = -1;
        if (explosionRef.current) {
          explosionRef.current.visible = false;
        }
      } else {
        explosionTime.current = nextT;
        if (explosionRef.current) {
          const t = nextT;
          const mesh1 = explosionRef.current.children[0] as THREE.Mesh;
          const mesh2 = explosionRef.current.children[1] as THREE.Mesh;
          if (mesh1) mesh1.scale.setScalar(1 + t * 8);
          if (mesh2) mesh2.scale.setScalar(1 + t * 12);

          if (mesh1) {
            const mat1 = mesh1.material as THREE.MeshBasicMaterial;
            mat1.opacity = 1 - t;
          }
          if (mesh2) {
            const mat2 = mesh2.material as THREE.MeshBasicMaterial;
            mat2.opacity = 1 - t;
          }
        }
      }
    }

    // 4) Animate deflector shields
    if (moonShieldRef.current) {
      moonShieldRef.current.rotation.y += sdt * 0.5 * w;
      const pulseMat = moonShieldRef.current.material as THREE.MeshBasicMaterial;
      pulseMat.opacity = 0.25 + Math.sin(time * 12) * 0.12;
    }
    if (marsShieldRef.current) {
      marsShieldRef.current.rotation.y += sdt * 0.5 * w;
      const pulseMat = marsShieldRef.current.material as THREE.MeshBasicMaterial;
      pulseMat.opacity = 0.25 + Math.sin(time * 12) * 0.12;
    }
  });

  return (
    <>
      {/* Geodesic Dome Deflector Shield over Moon Base */}
      {threat && threat.target === 'moon' && (
        <group position={[telemetry.moonWorld[0] ?? 0, telemetry.moonWorld[1] ?? 0, telemetry.moonWorld[2] ?? 0]}>
          <mesh scale={22} ref={moonShieldRef}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={laserActive ? "#ef4444" : "#a78bfa"}
              wireframe
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}

      {/* Geodesic Dome Deflector Shield over Mars Base */}
      {threat && threat.target === 'mars' && (
        <group position={[telemetry.marsWorld[0] ?? 0, telemetry.marsWorld[1] ?? 0, telemetry.marsWorld[2] ?? 0]}>
          <mesh scale={26} ref={marsShieldRef}>
            <icosahedronGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={laserActive ? "#ef4444" : "#ff5533"}
              wireframe
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}

      {/* ── A. Lagrange Point EM-L1 Relay ── */}
      <group ref={emL1Ref}>
        <mesh material={goldMat}>
          <boxGeometry args={[4, 4, 4]} />
        </mesh>
        {/* Solar panel arrays */}
        <mesh position={[5.5, 0, 0]} material={solarMat}>
          <boxGeometry args={[5, 0.1, 14]} />
        </mesh>
        <mesh position={[-5.5, 0, 0]} material={solarMat}>
          <boxGeometry args={[5, 0.1, 14]} />
        </mesh>
        {/* Antenna dish */}
        <mesh position={[0, 2.8, 0]} rotation={[0.4, 0, 0]}>
          <coneGeometry args={[2.5, 0.8, 16, 1, true]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <Html distanceFactor={120} center position={[0, 6, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded border border-amber-500 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.15em] text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
            📡 Lagrange EM-L1 Relay
          </div>
        </Html>
      </group>

      {/* ── B. Lagrange Point EM-L2 Relay ── */}
      <group ref={emL2Ref}>
        <mesh material={goldMat}>
          <boxGeometry args={[4, 4, 4]} />
        </mesh>
        <mesh position={[5.5, 0, 0]} material={solarMat}>
          <boxGeometry args={[5, 0.1, 14]} />
        </mesh>
        <mesh position={[-5.5, 0, 0]} material={solarMat}>
          <boxGeometry args={[5, 0.1, 14]} />
        </mesh>
        <mesh position={[0, 2.8, 0]} rotation={[-0.4, 0, 0]}>
          <coneGeometry args={[2.5, 0.8, 16, 1, true]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <Html distanceFactor={120} center position={[0, 6, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded border border-amber-500 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.15em] text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
            📡 Lagrange EM-L2 Relay
          </div>
        </Html>
      </group>

      {/* ── C. Lagrange Point Mars-L1 Relay ── */}
      <group ref={marsL1Ref}>
        <mesh material={goldMat}>
          <boxGeometry args={[4.5, 4.5, 4.5]} />
        </mesh>
        <mesh position={[6.5, 0, 0]} material={solarMat}>
          <boxGeometry args={[6, 0.1, 18]} />
        </mesh>
        <mesh position={[-6.5, 0, 0]} material={solarMat}>
          <boxGeometry args={[6, 0.1, 18]} />
        </mesh>
        <mesh position={[0, 3.2, 0]} rotation={[0.4, 0, 0]}>
          <coneGeometry args={[3.0, 1.0, 16, 1, true]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <Html distanceFactor={120} center position={[0, 7, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded border border-amber-500 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.15em] text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
            📡 Lagrange Mars-L1 Relay
          </div>
        </Html>
      </group>

      {/* ── D. Interplanetary Transit Starships ── */}
      {SHIPS.map((s, idx) => (
        <group key={s.name} ref={(el) => { shipRefs.current[idx] = el; }}>
          {/* Starship Body (vertical cylindrical tube) */}
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[2.5, 2.5, 12, 16]} />
            <meshStandardMaterial color="#b8bcc4" metalness={0.95} roughness={0.25} />
          </mesh>
          {/* Heat shield tiles (dark half-cylinder) */}
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[2.55, 2.55, 12, 16, 1, true, 0, Math.PI]} />
            <meshStandardMaterial color="#0a0a0c" metalness={0.2} roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 10.5, 0]}>
            <coneGeometry args={[2.5, 4.5, 16]} />
            <meshStandardMaterial color="#b8bcc4" metalness={0.95} roughness={0.25} />
          </mesh>
          {/* Forward flaps */}
          {([1.8, -1.8] as const).map((z) => (
            <mesh key={`ff${z}`} position={[0, 9.5, z]}>
              <boxGeometry args={[1.8, 1.2, 0.15]} />
              <meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.4} />
            </mesh>
          ))}
          {/* Aft flaps */}
          {([2.2, -2.2] as const).map((z) => (
            <mesh key={`af${z}`} position={[0, -1.5, z]}>
              <boxGeometry args={[2.6, 2.0, 0.15]} />
              <meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.4} />
            </mesh>
          ))}
          {/* Starship billboard photo (visible at close range) */}
          <sprite position={[6, 6, 0]} scale={[8, 8, 1]}>
            <spriteMaterial map={starshipSpaceTex} transparent opacity={0.85} depthWrite={false} />
          </sprite>
          {/* Engine Plume */}
          <mesh ref={(el) => { shipPlumeRefs.current[idx] = el; }} position={[0, -5, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.8, 8, 16, 1, true]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <Html distanceFactor={100} center position={[0, 14, 0]}>
            <div
              style={{ borderColor: s.color, color: s.color }}
              className="pointer-events-none whitespace-nowrap rounded border bg-black/90 px-1.5 py-0.5 text-[5px] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(255,255,255,0.25)]"
            >
              {s.label}
            </div>
          </Html>
        </group>
      ))}

      {/* ── E. Lagrange Point Communication Beams (Gold additive lines) ── */}
      <primitive object={l1Line} />
      <primitive object={l2Line} />
      <primitive object={marsL1Line} />

      {/* ── F. Keplerian Debris Threat & Base Defense Intercept Laser ── */}
      {threat && (
        <group ref={threatRef}>
          {/* Threat Meteorite / Debris */}
          <mesh>
            <sphereGeometry args={[10, 16, 16]} />
            <meshStandardMaterial color="#ef4444" roughness={0.9} />
          </mesh>
          {/* Warning outline ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[15, 17, 16]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.6} />
          </mesh>
          <Html distanceFactor={140} center position={[0, 18, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded border border-red-500 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.15em] text-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.7)]">
              🚨 WARNING: METEORITE IMPACT DANGER
            </div>
          </Html>
        </group>
      )}

      {/* Defense Intercept Laser Line */}
      <primitive object={threatLine} visible={laserActive} />

      {/* Interception Explosion Flash */}
      <group ref={explosionRef} visible={false}>
        <mesh>
          <sphereGeometry args={[12, 16, 16]} />
          <meshBasicMaterial color="#ffb03a" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <octahedronGeometry args={[14]} />
          <meshBasicMaterial color="#ef4444" wireframe transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
