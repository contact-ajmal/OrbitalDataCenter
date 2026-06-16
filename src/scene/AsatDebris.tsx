import { useEffect, useState, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STARBASE, SCENE } from '../lib/constants';
import { latLonToVec } from '../lib/geo';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { buildLinks } from '../sim/links';
import { angleToPos, satAngle } from '../sim/constellation';
import { toast, on } from '../lib/bus';

const PAD_LOCAL = latLonToVec(STARBASE.lat, STARBASE.lon, SCENE.EARTH_R);



interface StrikeData {
  id: number;
  targetIdx: number;
}

function AsatStrikeInstance({ strike, onComplete }: { strike: StrikeData; onComplete: () => void }) {
  const [phase, setPhase] = useState<'missile' | 'explosion' | 'debris'>('missile');
  const targetIdx = strike.targetIdx;

  const missileMeshRef = useRef<THREE.Mesh>(null);
  const missileTrailRef = useRef<THREE.Line>(null);
  const explosionMeshRef = useRef<THREE.Mesh>(null);
  const debrisPointsRef = useRef<THREE.Points>(null);

  const flightTime = 2.0; // 2 real seconds flight
  const missileAge = useRef(0);

  const explosionTime = 0.6; // 0.6 real seconds explosion flash
  const explosionAge = useRef(0);

  const debrisAge = useRef(0);
  const debrisMaxAge = 12.0; // debris fades out completely at 12s

  const collisionPos = useMemo(() => new THREE.Vector3(), []);
  const parentParams = useRef({ r: 0, raan: 0, inc: 0, phase: 0, tCollision: 0 });

  // Generate 60 debris particles with random Keplerian deviations
  const debrisParticles = useMemo(() => {
    const particles = [];
    for (let j = 0; j < 60; j++) {
      particles.push({
        dr: (Math.random() - 0.5) * 0.12,     // orbital radius offset
        draan: (Math.random() - 0.5) * 0.015,  // RAAN offset
        dinc: (Math.random() - 0.5) * 0.015,   // Inclination offset
        dphase: (Math.random() - 0.5) * 0.035, // Phase offset
      });
    }
    return particles;
  }, []);

  // Pre-allocate arrays
  const debrisPositions = useMemo(() => new Float32Array(60 * 3), []);
  const trailPositions = useMemo(() => new Float32Array(10 * 3), []);
  const recentPositions = useMemo<THREE.Vector3[]>(() => [], []);

  const trailGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    return geom;
  }, [trailPositions]);

  useFrame((_, dt) => {
    // 1. MISSILE Homing/Trajectory Phase
    if (phase === 'missile') {
      missileAge.current += dt;
      const progress = Math.min(missileAge.current / flightTime, 1.0);

      // Current moving position of target satellite from high frequency telemetry
      const targetPos = new THREE.Vector3(
        telemetry.satWorld[targetIdx * 3 + 0] ?? 0,
        telemetry.satWorld[targetIdx * 3 + 1] ?? 0,
        telemetry.satWorld[targetIdx * 3 + 2] ?? 0
      );

      // Lerp position
      const pos = new THREE.Vector3().lerpVectors(PAD_LOCAL, targetPos, progress);
      
      // Curved ballistic height offset
      const arcHeight = Math.sin(progress * Math.PI) * 12.0;
      const radialDir = new THREE.Vector3().copy(pos).normalize();
      pos.addScaledVector(radialDir, arcHeight);

      if (missileMeshRef.current) {
        missileMeshRef.current.position.copy(pos);
      }

      // Record missile trail positions
      recentPositions.push(pos.clone());
      if (recentPositions.length > 10) {
        recentPositions.shift();
      }

      if (missileTrailRef.current) {
        const geom = missileTrailRef.current.geometry;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;
        for (let j = 0; j < 10; j++) {
          const p = recentPositions[Math.min(j, recentPositions.length - 1)] || PAD_LOCAL;
          attr.setXYZ(j, p.x, p.y, p.z);
        }
        attr.needsUpdate = true;
      }

      if (progress >= 1.0) {
        // Intercept/Collision!
        collisionPos.copy(targetPos);

        const sat = network.sats[targetIdx];
        if (sat) {
          const tSim = telemetry.simT;
          const angle = satAngle(sat, tSim);
          
          parentParams.current = {
            r: sat.r,
            raan: sat.raan,
            inc: sat.inc,
            phase: angle,
            tCollision: tSim,
          };

          // Destroy the satellite
          sat.burned = true;
          toast(`💥 ASAT KINETIC INTERCEPT CONFIRMED ON SAT-${targetIdx}`);

          // Rebuild connection topology to sever links
          const { pairs, adj } = buildLinks(network.sats);
          network.pairs = pairs;
          network.adj = adj;
        }

        setPhase('explosion');
      }
    }

    // 2. EXPLOSION FLASH PHASE
    else if (phase === 'explosion') {
      explosionAge.current += dt;
      const progress = Math.min(explosionAge.current / explosionTime, 1.0);

      if (explosionMeshRef.current) {
        const scale = 0.4 + progress * 5.0;
        explosionMeshRef.current.scale.setScalar(scale);
        explosionMeshRef.current.position.copy(collisionPos);
        
        const mat = explosionMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1.0 - progress);
      }

      if (progress >= 1.0) {
        setPhase('debris');
      }
    }

    // 3. DEBRIS KINETIC DRIFT PHASE
    else if (phase === 'debris') {
      debrisAge.current += dt;
      const ageRatio = debrisAge.current / debrisMaxAge;

      if (ageRatio >= 1.0) {
        onComplete();
        return;
      }

      const tSim = telemetry.simT;
      const p = parentParams.current;
      const dtSim = tSim - p.tCollision;

      if (debrisPointsRef.current) {
        const geom = debrisPointsRef.current.geometry;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;

        const outPos = [0, 0, 0] as number[];

        for (let j = 0; j < 60; j++) {
          const pt = debrisParticles[j]!;
          
          // Keplerian drift: smaller radius orbits faster
          const r = p.r + pt.dr;
          const w_j = 0.1 * Math.pow(SCENE.ORBIT_R / r, 1.5);
          
          const angle = p.phase + pt.dphase + dtSim * w_j;
          const raan = p.raan + pt.draan;
          const inc = p.inc + pt.dinc;

          angleToPos(angle, raan, inc, r, outPos);
          attr.setXYZ(j, outPos[0]!, outPos[1]!, outPos[2]!);
        }
        attr.needsUpdate = true;

        const mat = debrisPointsRef.current.material as THREE.PointsMaterial;
        mat.opacity = Math.max(0, 1.0 - ageRatio);
      }
    }
  });

  const explosionMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  const trailMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  return (
    <>
      {phase === 'missile' && (
        <>
          <mesh ref={missileMeshRef}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color={0xff5522} />
          </mesh>
          <primitive object={new THREE.Line(trailGeometry, trailMaterial)} ref={missileTrailRef} />
        </>
      )}

      {phase === 'explosion' && (
        <mesh ref={explosionMeshRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <primitive object={explosionMaterial} attach="material" />
        </mesh>
      )}

      {phase === 'debris' && (
        <points ref={debrisPointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[debrisPositions, 3]}
              count={60}
              array={debrisPositions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#ff9933"
            size={0.15}
            transparent={true}
            opacity={1.0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}
    </>
  );
}

export function AsatDebris() {
  const [strikes, setStrikes] = useState<StrikeData[]>([]);

  useEffect(() => {
    return on('asat:trigger', (targetIdx) => {
      setStrikes((prev) => [...prev, { id: Date.now() + Math.random(), targetIdx }]);
    });
  }, []);

  const handleComplete = (id: number) => {
    setStrikes((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <>
      {strikes.map((strike) => (
        <AsatStrikeInstance
          key={strike.id}
          strike={strike}
          onComplete={() => handleComplete(strike.id)}
        />
      ))}
    </>
  );
}
