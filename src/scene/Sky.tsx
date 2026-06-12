import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  type Texture,
} from 'three';
import { SCENE_COLORS } from '../lib/constants';
import { loadTexture } from '../lib/textures';
import { emit } from '../lib/bus';
import { useSimStore } from '../state/sim';
import { starsFrag, starsVert } from './shaders/stars';

const SKY_R = 3200;
const STAR_COUNT = 5000;

/** Gaia DR3 Milky Way backdrop. Renders nothing if the texture is missing. */
function GaiaSphere() {
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    loadTexture('sky-gaia', { srgb: true }).then((t) => {
      if (alive) {
        setTex(t);
        if (t) emit('asset:loaded', 'GAIA');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const thermal = useSimStore((s) => s.thermal);
  if (!tex) return null;
  return (
    <mesh rotation={[0, 0, 0.4]} renderOrder={-1}>
      <sphereGeometry args={[SKY_R, 64, 64]} />
      <meshBasicMaterial
        map={tex}
        color={SCENE_COLORS.skyTint}
        side={BackSide}
        depthWrite={false}
        fog={false}
        transparent
        opacity={thermal ? 0.2 : 1}
      />
    </mesh>
  );
}

/** Twinkling star sparkle: 5,000 points on a 2600–3500 shell. */
function Sparkle() {
  const pixelRatio = useThree((s) => s.gl.getPixelRatio());
  const matRef = useRef<ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      // uniform direction on a sphere, radius in [2600, 3500]
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 2600 + Math.random() * 900;
      positions[i * 3 + 0] = r * s * Math.cos(theta);
      positions[i * 3 + 1] = r * u;
      positions[i * 3 + 2] = r * s * Math.sin(theta);

      // ~6% hero stars (3–5 px), rest 1–2 px
      sizes[i] = Math.random() < 0.06 ? 3 + Math.random() * 2 : 1 + Math.random();
      phases[i] = Math.random() * Math.PI * 2;

      // 18% warm-tinted, else cool white
      if (Math.random() < 0.18) {
        colors[i * 3 + 0] = 1.0;
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 0.6;
      } else {
        colors[i * 3 + 0] = 0.82;
        colors[i * 3 + 1] = 0.88;
        colors[i * 3 + 2] = 1.0;
      }
    }

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aSize', new BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new BufferAttribute(phases, 1));
    g.setAttribute('aColor', new BufferAttribute(colors, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: starsVert,
        fragmentShader: starsFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
        },
      }),
    [pixelRatio],
  );
  matRef.current = material;

  const points = useMemo(() => new Points(geometry, material), [geometry, material]);

  useFrame((state) => {
    material.uniforms.uTime!.value = state.clock.elapsedTime;
  });

  return <primitive object={points} renderOrder={-1} />;
}

export function Sky() {
  return (
    <>
      <GaiaSphere />
      <Sparkle />
    </>
  );
}
