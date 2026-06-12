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
  type Texture,
} from 'three';
import { NOMINAL_WARP, SCENE, SCENE_COLORS, SUN_DIR } from '../lib/constants';
import { loadTexture } from '../lib/textures';
import { emit } from '../lib/bus';
import { useSimStore } from '../state/sim';

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
  const [tex, setTex] = useState<Texture | null>(null);

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

  useFrame((_, dt) => {
    const st = useSimStore.getState();
    const sdt = st.paused ? 0 : dt;
    const w = st.timeWarp / NOMINAL_WARP;
    if (pivotRef.current) pivotRef.current.rotation.y += sdt * MOON_RATE * w;
  });

  if (!tex) return null;
  return (
    <group rotation={[MOON_TILT, 0, 0]}>
      <group ref={pivotRef}>
        <mesh position={[MOON_DIST, 0, 0]}>
          <sphereGeometry args={[MOON_RADIUS, 48, 48]} />
          <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
        </mesh>
      </group>
    </group>
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
