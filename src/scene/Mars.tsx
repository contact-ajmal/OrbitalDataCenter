import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useSimStore } from '../state/sim';
import { telemetry } from '../state/telemetry';
import { loadTexture } from '../lib/textures';
import { emit } from '../lib/bus';
import { NOMINAL_WARP, SUN_DIR } from '../lib/constants';

const MARS_DIST = 2600;
const MARS_RADIUS = 53.3;
const MARS_TILT = THREE.MathUtils.degToRad(25.19);
// Mars orbits Earth/Sun extremely slowly
const MARS_RATE = 0.02 / 687;
// Mars rotates on its axis (similar to Earth day)
const MARS_SPIN = 0.02;

const SUN_HAT = new THREE.Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();

export function Mars() {
  const pivotRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const domeRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);

  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [cloudsTex, setCloudsTex] = useState<THREE.Texture | null>(null);
  const dishRef = useRef<THREE.Group>(null);

  const domeWorldPos = useMemo(() => new THREE.Vector3(), []);
  const startWorldPos = useMemo(() => new THREE.Vector3(), []);

  const linePositions = useMemo(() => new Float32Array(2 * 3), []);
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    return geo;
  }, [linePositions]);

  const lineMat = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: 0xff3333, // thick, pulsating crimson laser
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Custom atmosphere shader material (orange-red glow)
  const atmoMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uSun;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 n = normalize(vWorldNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - abs(dot(n, V)), 3.0);
          float sunW = 0.30 + 0.70 * max(dot(n, uSun), 0.0);
          vec3 col = vec3(1.0, 0.30, 0.15) * fres * sunW * 1.6;
          gl_FragColor = vec4(col, fres * sunW);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      uniforms: {
        uSun: { value: SUN_HAT },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const marsShaderMat = useMemo(() => {
    if (!tex) return null;
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uSun;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 n = normalize(vWorldNormal);

          // 1) Finite-difference bump mapping from Mars texture
          float t = 1.0 / 2048.0;
          float hL = texture2D(uMap, vUv - vec2(t, 0.0)).r;
          float hR = texture2D(uMap, vUv + vec2(t, 0.0)).r;
          float hD = texture2D(uMap, vUv - vec2(0.0, t)).r;
          float hU = texture2D(uMap, vUv + vec2(0.0, t)).r;
          vec3 up = abs(n.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 T = normalize(cross(up, n));
          vec3 B = cross(n, T);
          float strength = 4.5;
          n = normalize(n + (T * (hL - hR) + B * (hD - hU)) * strength);

          float dif = dot(n, uSun);
          float day = smoothstep(-0.15, 0.15, dif);
          vec3 dayTex = texture2D(uMap, vUv).rgb;
          vec3 dayCol = dayTex * (0.05 + 1.35 * max(dif, 0.0));
          
          // Sunset terminator band (orange sunset)
          float band = exp(-(dif * dif) / (2.0 * 0.15 * 0.15));
          vec3 sunsetCol = vec3(1.0, 0.45, 0.15) * band * 0.45;
          
          // 2) Procedural night-side colony lights (glowing orange-gold network)
          float grid = step(0.99, fract(vUv.x * 150.0)) * step(0.972, sin(vUv.y * 220.0));
          float spots = step(0.996, fract(sin(dot(floor(vUv * 100.0), vec2(15.1, 83.3))) * 23145.1853));
          float mask = step(0.40, fract(sin(dot(floor(vUv * 9.0), vec2(62.1, 37.3))) * 98765.4321));
          vec3 nightCol = vec3(1.0, 0.45, 0.18) * (spots * 3.0 + grid * 1.5) * mask * 2.0;
          float nightAmt = 1.0 - day;

          // Edge glow (atmospheric Fresnel on surface)
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
          vec3 atmoCol = fres * vec3(1.0, 0.35, 0.15) * 0.75 * smoothstep(-0.2, 0.2, dif);
          
          vec3 col = dayCol * day + nightCol * nightAmt + sunsetCol + atmoCol;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      uniforms: {
        uMap: { value: tex },
        uSun: { value: SUN_HAT },
      },
    });
  }, [tex]);

  // Martian dust storm cloud shell material
  const marsCloudMat = useMemo(() => {
    if (!cloudsTex) return null;
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform sampler2D uClouds;
        uniform vec3 uSun;
        uniform float uShift;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 n = normalize(vWorldNormal);
          float c = texture2D(uClouds, vec2(vUv.x + uShift, vUv.y)).r;
          float dif = max(dot(n, uSun), 0.0);
          float lit = 0.15 + 1.05 * dif;
          vec3 V = normalize(cameraPosition - vWorldPos);
          float limb = smoothstep(0.0, 0.45, dot(n, V));
          float a = c * limb * 0.55; // semi-transparent dust clouds
          vec3 col = vec3(0.88, 0.42, 0.20) * lit;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      uniforms: {
        uClouds: { value: cloudsTex },
        uSun: { value: SUN_HAT },
        uShift: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
  }, [cloudsTex]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadTexture('mars', { srgb: true }),
      loadTexture('earth-clouds', { srgb: true })
    ]).then(([t, c]) => {
      if (alive) {
        setTex(t);
        setCloudsTex(c);
        if (t) emit('asset:loaded', 'MARS');
        if (c) emit('asset:loaded', 'MARS_CLOUDS');
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

    // Orbit Mars around center
    if (pivotRef.current) {
      pivotRef.current.rotation.y += sdt * MARS_RATE * w;
    }

    // Spin Mars on Y axis
    if (meshRef.current) {
      meshRef.current.rotation.y += sdt * MARS_SPIN * w;
    }

    // Drift Martian dust storm clouds
    if (marsCloudMat && marsCloudMat.uniforms.uShift) {
      marsCloudMat.uniforms.uShift.value += sdt * 0.0015 * w;
    }

    // Rotate Olympus base communication dish
    if (dishRef.current) {
      dishRef.current.rotation.y += sdt * 0.35 * w;
    }

    // Get live dome world coordinate for telemetry
    if (domeRef.current) {
      domeRef.current.getWorldPosition(domeWorldPos);
      telemetry.marsWorld[0] = domeWorldPos.x;
      telemetry.marsWorld[1] = domeWorldPos.y;
      telemetry.marsWorld[2] = domeWorldPos.z;
    }

    // Update thick crimson interplanetary laser trunk from Moon (Artemis) to Mars (Olympus)
    const line = lineRef.current;
    if (line && telemetry.moonWorld && telemetry.marsWorld) {
      // Find starting point (Moon's Artemis Base position if available, else Earth/origin)
      if (telemetry.moonWorld[0]) {
        startWorldPos.set(
          telemetry.moonWorld[0] || 0,
          telemetry.moonWorld[1] || 0,
          telemetry.moonWorld[2] || 0
        );
      } else {
        // Fallback to active satellite if Moon not ready
        const bestIdx = telemetry.lunarRelayIdx;
        if (bestIdx >= 0 && telemetry.satWorld) {
          startWorldPos.set(
            telemetry.satWorld[bestIdx * 3 + 0] || 0,
            telemetry.satWorld[bestIdx * 3 + 1] || 0,
            telemetry.satWorld[bestIdx * 3 + 2] || 0
          );
        } else {
          startWorldPos.set(0, 0, 0);
        }
      }

      linePositions[0] = startWorldPos.x;
      linePositions[1] = startWorldPos.y;
      linePositions[2] = startWorldPos.z;

      linePositions[3] = domeWorldPos.x;
      linePositions[4] = domeWorldPos.y;
      linePositions[5] = domeWorldPos.z;

      line.geometry.getAttribute('position').needsUpdate = true;

      // Pulsate the laser opacity over time
      const time = state.clock.getElapsedTime();
      const pulseMat = line.material as THREE.LineBasicMaterial;
      pulseMat.opacity = 0.65 + Math.sin(time * 8) * 0.25;
    }
  });

  return (
    <>
      <group rotation={[MARS_TILT, 0, 0]}>
        <group ref={pivotRef}>
          <mesh ref={meshRef} position={[MARS_DIST, 0, 0]}>
            <sphereGeometry args={[MARS_RADIUS, 64, 64]} />
            {marsShaderMat ? (
              <primitive object={marsShaderMat} attach="material" />
            ) : (
              <meshStandardMaterial color="#a64b2a" roughness={0.9} metalness={0.1} />
            )}

            {/* Olympus Comm-Terminal Dome and Infrastructure on surface */}
            <group position={[-MARS_RADIUS, 0, 0]}>
              {/* Central Dome */}
              <mesh ref={domeRef} rotation={[0, 0, Math.PI / 2]}>
                <sphereGeometry args={[MARS_RADIUS * 0.08, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshBasicMaterial color="#ff5533" transparent opacity={0.85} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0, MARS_RADIUS * 0.12, 32]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.3} depthWrite={false} />
              </mesh>

              {/* Solar array wing 1 */}
              <group position={[0.5, 0, -2.5]} rotation={[0, 0.5, Math.PI / 2]}>
                <mesh position={[0, MARS_RADIUS * 0.02, 0]}>
                  <cylinderGeometry args={[MARS_RADIUS * 0.004, MARS_RADIUS * 0.004, MARS_RADIUS * 0.05, 8]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
                <mesh position={[0, MARS_RADIUS * 0.045, 0]} rotation={[0.4, 0, 0]}>
                  <boxGeometry args={[MARS_RADIUS * 0.04, MARS_RADIUS * 0.002, MARS_RADIUS * 0.025]} />
                  <meshStandardMaterial color="#1b2a47" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* Solar array wing 2 */}
              <group position={[0.5, 0, 2.5]} rotation={[0, -0.5, Math.PI / 2]}>
                <mesh position={[0, MARS_RADIUS * 0.02, 0]}>
                  <cylinderGeometry args={[MARS_RADIUS * 0.004, MARS_RADIUS * 0.004, MARS_RADIUS * 0.05, 8]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
                <mesh position={[0, MARS_RADIUS * 0.045, 0]} rotation={[0.4, 0, 0]}>
                  <boxGeometry args={[MARS_RADIUS * 0.04, MARS_RADIUS * 0.002, MARS_RADIUS * 0.025]} />
                  <meshStandardMaterial color="#1b2a47" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* Rotating Comm Dish */}
              <group position={[-1.2, 0, -1.2]} rotation={[0, 0, Math.PI / 2]} ref={dishRef}>
                <mesh position={[0, MARS_RADIUS * 0.02, 0]}>
                  <cylinderGeometry args={[MARS_RADIUS * 0.005, MARS_RADIUS * 0.005, MARS_RADIUS * 0.04, 8]} />
                  <meshStandardMaterial color="#475569" metalness={0.7} />
                </mesh>
                <mesh position={[0, MARS_RADIUS * 0.04, 0]} rotation={[0.5, 0, 0]}>
                  <coneGeometry args={[MARS_RADIUS * 0.035, MARS_RADIUS * 0.012, 16, 1, true]} />
                  <meshStandardMaterial color="#ef4444" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
                </mesh>
                <mesh position={[0, MARS_RADIUS * 0.05, 0.005]} rotation={[0.5, 0, 0]}>
                  <sphereGeometry args={[MARS_RADIUS * 0.006, 8, 8]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>

              <Html distanceFactor={60} center position={[0, MARS_RADIUS * 0.15, 0]}>
                <div className="pointer-events-none whitespace-nowrap rounded-sm border border-red-500 bg-black/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[.15em] text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                  🔴 Olympus Comm-Terminal
                </div>
              </Html>
            </group>
          </mesh>

          {/* Dust storm clouds shell */}
          {marsCloudMat && (
            <mesh position={[MARS_DIST, 0, 0]} material={marsCloudMat} renderOrder={1}>
              <sphereGeometry args={[MARS_RADIUS * 1.011, 64, 64]} />
            </mesh>
          )}

          {/* Atmosphere glow shell surrounding Mars */}
          <mesh position={[MARS_DIST, 0, 0]} material={atmoMat} renderOrder={2}>
            <sphereGeometry args={[MARS_RADIUS * 1.045, 64, 64]} />
          </mesh>
        </group>
      </group>

      {/* Interplanetary Crimson Laser Line */}
      <primitive object={new THREE.Line(lineGeo, lineMat)} ref={lineRef} />
    </>
  );
}
