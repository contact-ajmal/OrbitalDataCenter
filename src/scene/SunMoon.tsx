import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasTexture,
  Group,
  MathUtils,
  Sprite,
  SpriteMaterial,
  AdditiveBlending,
  Vector3,
  Mesh,
  type Texture,
} from 'three';
import { Html } from '@react-three/drei';
import { NOMINAL_WARP, SCENE, SCENE_COLORS, SUN_DIR } from '../lib/constants';
import { loadTexture } from '../lib/textures';
import { emit } from '../lib/bus';
import { useSimStore } from '../state/sim';
import { telemetry } from '../state/telemetry';

const SUN_HAT = new Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
const LIGHT_POS = SUN_HAT.clone().multiplyScalar(800);
const GLOW_POS = SUN_HAT.clone().multiplyScalar(2400);

const MOON_RADIUS = 0.273 * SCENE.EARTH_R; // real Moon/Earth ratio
const MOON_DIST = 1450;
const MOON_TILT = MathUtils.degToRad(5.1);
// Sidereal orbit tied to Earth's spin (0.02 rad/s/day) over 27.3 days.
const MOON_RATE = 0.02 / 27.3;

/** Soft additive radial glow texture for the Sun sprite. */
function makeGlowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,250,235,1.0)');
  g.addColorStop(0.18, 'rgba(255,238,200,0.85)');
  g.addColorStop(0.5, 'rgba(255,210,140,0.25)');
  g.addColorStop(1.0, 'rgba(255,200,120,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

function SunGlow() {
  const sprite = useMemo(() => {
    const mat = new SpriteMaterial({
      map: makeGlowTexture(),
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });
    const s = new Sprite(mat);
    s.position.copy(GLOW_POS);
    s.scale.setScalar(620);
    return s;
  }, []);
  return <primitive object={sprite} renderOrder={-1} />;
}

function Moon() {
  const pivotRef = useRef<Group>(null);
  const domeRef = useRef<Mesh>(null);
  const moonMeshRef = useRef<Mesh>(null);
  const massDriverTipRef = useRef<Group>(null);
  const packetsGroupRef = useRef<Group>(null);
  const packetRefs = useRef<(Mesh | null)[]>([]);
  const [tex, setTex] = useState<Texture | null>(null);

  const domeWorldPos = useMemo(() => new Vector3(), []);
  const moonCenter = useMemo(() => new Vector3(), []);
  const p0 = useMemo(() => new Vector3(), []);
  const p1 = useMemo(() => new Vector3(), []);
  const p2 = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);
  const pResult = useMemo(() => new Vector3(), []);
  
  const packetTimes = useMemo(() => [0.0, 0.33, 0.66], []);

  useEffect(() => {
    let alive = true;
    loadTexture('moon', { srgb: true }).then((t) => {
      if (alive) {
        setTex(t);
        if (t) emit('asset:loaded', 'MOON');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useFrame((state, dt) => {
    const st = useSimStore.getState();
    const sdt = st.paused ? 0 : dt;
    const w = st.timeWarp / NOMINAL_WARP;
    if (pivotRef.current) pivotRef.current.rotation.y += sdt * MOON_RATE * w;

    if (domeRef.current) {
      domeRef.current.getWorldPosition(domeWorldPos);
      telemetry.moonWorld[0] = domeWorldPos.x;
      telemetry.moonWorld[1] = domeWorldPos.y;
      telemetry.moonWorld[2] = domeWorldPos.z;
    }

    // Animate launched satellite packets flying to Earth from the Mass Driver tip
    for (let k = 0; k < 3; k++) {
      const prevT = packetTimes[k] ?? 0;
      let nextT = prevT + sdt * 0.045 * w;
      if (nextT > 1) {
        nextT = 0;
      }
      packetTimes[k] = nextT;

      const t = nextT;
      const mesh = packetRefs.current[k];
      if (mesh && massDriverTipRef.current && moonMeshRef.current) {
        // get p0 (tip position)
        massDriverTipRef.current.getWorldPosition(p0);
        // get moon center
        moonMeshRef.current.getWorldPosition(moonCenter);

        // p1 (control point): launch direction is (p0 - moonCenter) normalized
        dir.copy(p0).sub(moonCenter).normalize();
        p1.copy(p0).addScaledVector(dir, 280); // arc out 280 units perpendicular to Moon surface

        // p2 (end point): Earth center [0,0,0]
        p2.set(0, 0, 0);

        // quadratic bezier interpolation: (1-t)^2 * p0 + 2*(1-t)*t * p1 + t^2 * p2
        const mt = 1 - t;
        pResult.set(0, 0, 0)
          .addScaledVector(p0, mt * mt)
          .addScaledVector(p1, 2 * mt * t)
          .addScaledVector(p2, t * t);

        mesh.position.copy(pResult);

        // scale down as it gets closer to Earth
        mesh.scale.setScalar(0.7 * (1 - t * 0.65));

        // fade out and pulsate opacity
        const pulseMat = mesh.material as SpriteMaterial;
        pulseMat.opacity = (0.7 + Math.sin(state.clock.getElapsedTime() * 12 + k) * 0.3) * (1 - t * 0.95);
      }
    }
  });

  return (
    <>
      <group rotation={[MOON_TILT, 0, 0]}>
        <group ref={pivotRef}>
          <mesh ref={moonMeshRef} position={[MOON_DIST, 0, 0]}>
            <sphereGeometry args={[MOON_RADIUS, 48, 48]} />
            <meshStandardMaterial
              map={tex || undefined}
              color={tex ? undefined : '#555555'}
              roughness={0.95}
              metalness={0}
            />
            {/* Artemis Base Dome & SpaceX/xAI Infrastructure Group */}
            <group position={[-MOON_RADIUS, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              {/* Artemis Base Dome */}
              <mesh ref={domeRef}>
                <sphereGeometry args={[MOON_RADIUS * 0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshBasicMaterial color="#c084fc" transparent opacity={0.8} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0, MOON_RADIUS * 0.18, 32]} />
                <meshBasicMaterial color="#a78bfa" transparent opacity={0.25} depthWrite={false} />
              </mesh>
              <Html distanceFactor={30} center position={[0, MOON_RADIUS * 0.2, 0]}>
                <div className="pointer-events-none whitespace-nowrap rounded-sm border border-violet-500 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.15em] text-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.5)]">
                  Artemis Base
                </div>
              </Html>

              {/* SpaceX Starship HLS Lander */}
              <group position={[2.5, 0, -2.5]}>
                {/* Ship Body */}
                <mesh position={[0, MOON_RADIUS * 0.08, 0]}>
                  <cylinderGeometry args={[MOON_RADIUS * 0.02, MOON_RADIUS * 0.02, MOON_RADIUS * 0.16, 16]} />
                  <meshStandardMaterial metalness={0.9} roughness={0.1} color="#e2e8f0" />
                </mesh>
                {/* Nose Cone */}
                <mesh position={[0, MOON_RADIUS * 0.19, 0]}>
                  <coneGeometry args={[MOON_RADIUS * 0.02, MOON_RADIUS * 0.06, 16]} />
                  <meshStandardMaterial metalness={0.9} roughness={0.1} color="#e2e8f0" />
                </mesh>
                {/* Landing legs */}
                <mesh position={[0, MOON_RADIUS * 0.01, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <cylinderGeometry args={[MOON_RADIUS * 0.03, MOON_RADIUS * 0.035, MOON_RADIUS * 0.02, 4, 1, true]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} />
                </mesh>
                {/* Thruster exhaust glow */}
                <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0, MOON_RADIUS * 0.03, 16]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} depthWrite={false} />
                </mesh>
                <Html distanceFactor={30} center position={[0, MOON_RADIUS * 0.24, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded border border-slate-500 bg-black/85 px-1 py-0.5 text-[5px] font-bold uppercase tracking-wider text-slate-300 shadow-[0_0_8px_rgba(226,232,240,0.3)]">
                    🚀 Starship HLS
                  </div>
                </Html>
              </group>

              {/* xAI Colossus Cluster & Satellite Factory */}
              <group position={[-2.5, 0, -2.5]}>
                {/* Server block 1 */}
                <mesh position={[-0.5, MOON_RADIUS * 0.04, 0]}>
                  <boxGeometry args={[MOON_RADIUS * 0.03, MOON_RADIUS * 0.08, MOON_RADIUS * 0.05]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.5} />
                </mesh>
                {/* Server block 2 */}
                <mesh position={[0.5, MOON_RADIUS * 0.04, 0]}>
                  <boxGeometry args={[MOON_RADIUS * 0.03, MOON_RADIUS * 0.08, MOON_RADIUS * 0.05]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.5} />
                </mesh>
                {/* Glowing red xAI CPU core strip */}
                <mesh position={[0, MOON_RADIUS * 0.03, 0]}>
                  <boxGeometry args={[MOON_RADIUS * 0.012, MOON_RADIUS * 0.06, MOON_RADIUS * 0.052]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                {/* Modular power generator ring */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                  <ringGeometry args={[0, MOON_RADIUS * 0.04, 32]} />
                  <meshBasicMaterial color="#f87171" transparent opacity={0.3} depthWrite={false} />
                </mesh>
                <Html distanceFactor={30} center position={[0, MOON_RADIUS * 0.12, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded border border-red-500 bg-black/85 px-1 py-0.5 text-[5px] font-bold uppercase tracking-wider text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                    🧠 xAI Colossus Lunar
                  </div>
                </Html>
              </group>

              {/* Electromagnetic Mass Driver Catapult */}
              <group position={[2.5, 0, 2.5]}>
                {/* Catapult base */}
                <mesh position={[0, MOON_RADIUS * 0.02, 0]}>
                  <cylinderGeometry args={[MOON_RADIUS * 0.015, MOON_RADIUS * 0.02, MOON_RADIUS * 0.04, 16]} />
                  <meshStandardMaterial color="#334155" metalness={0.7} />
                </mesh>
                {/* Launch Track (inclined at 35 degrees relative to surface) */}
                <group rotation={[0, 0, -Math.PI / 5]}>
                  <mesh position={[0, MOON_RADIUS * 0.1, 0]}>
                    <boxGeometry args={[MOON_RADIUS * 0.01, MOON_RADIUS * 0.22, MOON_RADIUS * 0.015]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
                  </mesh>
                  {/* Glow guide rail */}
                  <mesh position={[0, MOON_RADIUS * 0.1, MOON_RADIUS * 0.009]}>
                    <boxGeometry args={[MOON_RADIUS * 0.002, MOON_RADIUS * 0.22, MOON_RADIUS * 0.002]} />
                    <meshBasicMaterial color="#60a5fa" />
                  </mesh>
                  {/* Dummy group representing Mass Driver Tip for particle launching */}
                  <group position={[0, MOON_RADIUS * 0.21, 0]} ref={massDriverTipRef} />
                </group>
                <Html distanceFactor={30} center position={[0, MOON_RADIUS * 0.22, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded border border-blue-500 bg-black/85 px-1 py-0.5 text-[5px] font-bold uppercase tracking-wider text-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]">
                    ⚡ Mass Driver
                  </div>
                </Html>
              </group>
            </group>
          </mesh>
        </group>
      </group>
      {/* Launched Satellites Group (rendered at scene level, positions set in world coordinates) */}
      <group ref={packetsGroupRef}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <mesh key={idx} ref={(el) => { packetRefs.current[idx] = el; }}>
            <sphereGeometry args={[1.2, 8, 8]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function SunMoon() {
  return (
    <>
      <ambientLight color={SCENE_COLORS.ambient} intensity={1} />
      <directionalLight
        position={LIGHT_POS}
        intensity={2}
        color={SCENE_COLORS.sunLight}
      />
      <SunGlow />
      <Moon />
    </>
  );
}
