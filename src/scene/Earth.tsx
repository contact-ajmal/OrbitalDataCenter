import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  DataTexture,
  Group,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
} from 'three';
import { NOMINAL_WARP, SCENE, SUN_DIR } from '../lib/constants';
import { initTextureSystem, loadTexture } from '../lib/textures';
import { emit, toast } from '../lib/bus';
import { earthGroupRef } from '../state/world';
import { useSimStore } from '../state/sim';
import {
  atmosphereFrag,
  atmosphereVert,
  cloudFrag,
  fallbackFrag,
  surfaceFrag,
  surfaceVert,
} from './shaders/earth';

const EARTH_R = SCENE.EARTH_R;

function sunVec(): Vector3 {
  return new Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
}

/** 1×1 white texture so sampler uniforms are never null before assets land. */
function makePlaceholder(): DataTexture {
  const tex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

export function Earth() {
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<Group>(null);
  const [ready, setReady] = useState(false); // swap procedural → HQ once day+night land

  const placeholder = useMemo(makePlaceholder, []);

  // ── Materials (built once) ──────────────────────────────────────────────
  const surfaceMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVert,
        fragmentShader: surfaceFrag,
        uniforms: {
          uSun: { value: sunVec() },
          uDay: { value: placeholder },
          uNight: { value: placeholder },
          uClouds: { value: placeholder },
          uOcean: { value: placeholder },
          uBump: { value: placeholder },
          uCloudsOn: { value: 0 },
          uOceanOn: { value: 0 },
          uBumpOn: { value: 0 },
          uCloudShift: { value: 0 },
          uThermal: { value: 0 },
        },
      }),
    [placeholder],
  );

  const fallbackMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVert,
        fragmentShader: fallbackFrag,
        uniforms: { uSun: { value: sunVec() } },
      }),
    [],
  );

  const cloudMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVert,
        fragmentShader: cloudFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uSun: { value: sunVec() },
          uClouds: { value: placeholder },
          uShift: { value: 0 },
        },
      }),
    [placeholder],
  );
  const [cloudsReady, setCloudsReady] = useState(false);

  const atmoMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmosphereVert,
        fragmentShader: atmosphereFrag,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uSun: { value: sunVec() } },
      }),
    [],
  );

  // publish the rotating group ref for satellites / ground stations
  useEffect(() => {
    earthGroupRef.current = groupRef.current;
    return () => {
      earthGroupRef.current = null;
    };
  }, []);

  // ── Progressive texture loading (AbortController-safe) ───────────────────
  useEffect(() => {
    initTextureSystem(gl);
    const ac = new AbortController();

    (async () => {
      // Base imagery first → unlocks HQ material.
      const [day, night] = await Promise.all([
        loadTexture('earth-day', { srgb: true }),
        loadTexture('earth-night', { srgb: true }),
      ]);
      if (ac.signal.aborted) return;
      if (day) {
        surfaceMat.uniforms.uDay!.value = day;
        emit('asset:loaded', '8K SURFACE');
      }
      if (night) {
        surfaceMat.uniforms.uNight!.value = night;
        emit('asset:loaded', '16K LIGHTS');
      }
      if (day && night) {
        setReady(true);
        toast('EARTH IMAGERY ONLINE — 8K SURFACE · 16K CITY LIGHTS');
      }

      // Enhancement layers — flip flags as each lands.
      const bump = await loadTexture('earth-bump');
      if (!ac.signal.aborted && bump) {
        surfaceMat.uniforms.uBump!.value = bump;
        surfaceMat.uniforms.uBumpOn!.value = 1;
      }

      const ocean = await loadTexture('earth-ocean');
      if (!ac.signal.aborted && ocean) {
        surfaceMat.uniforms.uOcean!.value = ocean;
        surfaceMat.uniforms.uOceanOn!.value = 1;
      }

      const clouds = await loadTexture('earth-clouds', { srgb: true });
      if (!ac.signal.aborted && clouds) {
        clouds.wrapS = RepeatWrapping; // allow horizontal drift to wrap
        clouds.needsUpdate = true;
        surfaceMat.uniforms.uClouds!.value = clouds;
        surfaceMat.uniforms.uCloudsOn!.value = 1;
        cloudMat.uniforms.uClouds!.value = clouds;
        setCloudsReady(true);
        emit('asset:loaded', 'CLOUDS');
        toast('4K LIVE CLOUD LAYER ONLINE');
      }
    })();

    return () => ac.abort();
  }, [gl, surfaceMat, cloudMat]);

  // ── Per-frame: rotate Earth, drift clouds ────────────────────────────────
  useFrame((_, dt) => {
    const st = useSimStore.getState();
    const w = st.timeWarp / NOMINAL_WARP; // normalized warp
    const sdt = st.paused ? 0 : dt;
    const g = groupRef.current;
    if (g) g.rotation.y += sdt * 0.02 * w;
    surfaceMat.uniforms.uCloudShift!.value += sdt * 0.002 * w;
    cloudMat.uniforms.uShift!.value += sdt * 0.002 * 1.35 * w;

    // 0.6 s lerp of the thermal uniform on toggle; clouds fade out in IR
    const target = st.thermal ? 1 : 0;
    const u = surfaceMat.uniforms.uThermal!;
    u.value += (target - u.value) * (1 - Math.exp(-dt / 0.18));
    cloudMat.opacity = 1 - u.value;
    cloudMat.transparent = true;
  });

  return (
    <group ref={groupRef}>
      {/* Surface */}
      <mesh material={ready ? surfaceMat : fallbackMat}>
        <sphereGeometry args={[EARTH_R, 128, 128]} />
      </mesh>

      {/* Cloud shell */}
      {cloudsReady && (
        <mesh material={cloudMat} renderOrder={1}>
          <sphereGeometry args={[EARTH_R * 1.011, 96, 96]} />
        </mesh>
      )}

      {/* Atmosphere shell */}
      <mesh material={atmoMat} renderOrder={2}>
        <sphereGeometry args={[EARTH_R * 1.045, 64, 64]} />
      </mesh>
    </group>
  );
}
