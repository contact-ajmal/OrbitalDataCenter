import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
  Vector3,
} from 'three';
import { SUN_DIR } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';
import { heroGroupRef, labelState, type LabelKey } from '../state/labels';
import { useUiStore } from '../state/ui';
import { network } from '../state/network';

// Local anchor points (hero space) — must match the geometry below.
const ANCHORS: Record<LabelKey | 'tipL' | 'tipR', Vector3> = {
  portWing: new Vector3(-2.0, 0.02, 0),
  stbdWing: new Vector3(2.0, 0.02, 0),
  radiator: new Vector3(0, 0, 1.55),
  computeModule: new Vector3(0, -0.16, 0.18),
  bus: new Vector3(0, 0.1, -0.22),
  laserTerminal: new Vector3(0.12, 0.2, 0),
  tipL: new Vector3(-2.9, 0, 0),
  tipR: new Vector3(2.9, 0, 0),
};

const SCREEN_MARGIN = 56;

// Module scratch (no per-frame allocation).
const _sun = new Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
const _pos = new Vector3();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _mat = new Matrix4();
const _quat = new Quaternion();
const _world = new Vector3();
const _proj = new Vector3();
const _center = new Vector3();
const _toCam = new Vector3();
const _toAnchor = new Vector3();

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function finalize(c: HTMLCanvasElement, maxAniso: number, repeat?: [number, number]): CanvasTexture {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = maxAniso;
  if (repeat) {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** 512² crinkled gold MLI thermal foil. */
function makeGoldMLI(maxAniso: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9a7424';
  ctx.fillRect(0, 0, 512, 512);
  const base = [154, 116, 36];
  for (let i = 0; i < 2600; i++) {
    const s = 0.65 + Math.random() * 0.7;
    const r = Math.min(255, base[0]! * s);
    const g = Math.min(255, base[1]! * s);
    const b = Math.min(255, base[2]! * s);
    ctx.save();
    ctx.translate(Math.random() * 512, Math.random() * 512);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    const w = 4 + Math.random() * 10;
    const h = 2 + Math.random() * 5;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  return finalize(c, maxAniso);
}

/** 2048×640 solar-cell array. */
function makeSolarTexture(maxAniso: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 640;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#13265c';
  ctx.fillRect(0, 0, c.width, c.height);
  // ~30% of cells filled
  ctx.fillStyle = 'rgba(60,110,230,0.25)';
  for (let x = 0; x < c.width; x += 64) {
    for (let y = 0; y < c.height; y += 64) {
      if (Math.random() < 0.3) ctx.fillRect(x + 2, y + 2, 60, 60);
    }
  }
  // 64 px cell grid
  ctx.strokeStyle = 'rgba(140,180,255,0.35)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= c.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, c.height);
    ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
  }
  // fine 16 px busbars
  ctx.strokeStyle = 'rgba(180,210,255,0.12)';
  ctx.lineWidth = 0.6;
  for (let x = 0; x <= c.width; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, c.height);
    ctx.stroke();
  }
  return finalize(c, maxAniso, [2, 1]);
}

/** 512×1024 white radiator panel with a serpentine coolant line. */
function makeRadiatorTexture(maxAniso: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6edf2';
  ctx.fillRect(0, 0, 512, 1024);
  // faint vertical panel seams
  ctx.strokeStyle = 'rgba(120,140,158,0.18)';
  ctx.lineWidth = 1;
  for (let x = 64; x < 512; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  // serpentine coolant line switchbacking every 64 px
  ctx.strokeStyle = 'rgba(120,140,158,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  let left = true;
  for (let y = 48; y < 1024; y += 64) {
    ctx.moveTo(left ? 36 : 476, y);
    ctx.lineTo(left ? 476 : 36, y);
    ctx.lineTo(left ? 476 : 36, y + 64);
    left = !left;
  }
  ctx.stroke();
  return finalize(c, maxAniso);
}

/** Ribbed radiator panel (5 cross-ribs) at a given z, with serpentine texture. */
function Radiator({
  z,
  tex,
  isRadiatorActive,
  hasActive,
  matRef,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  z: number;
  tex: Texture;
  isRadiatorActive: boolean;
  hasActive: boolean;
  matRef?: React.RefObject<any>;
  onClick?: (e: any) => void;
  onPointerOver?: (e: any) => void;
  onPointerOut?: () => void;
}) {
  const ribs = [-0.6, -0.3, 0, 0.3, 0.6];
  return (
    <group position={[0, 0, z]}>
      <mesh
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[1.5, 0.03, 0.8]} />
        <meshStandardMaterial
          ref={matRef}
          map={tex}
          roughness={0.85}
          metalness={0.05}
          transparent={hasActive}
          opacity={isRadiatorActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
        />
      </mesh>
      {ribs.map((rx) => (
        <mesh key={rx} position={[rx, 0.025, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.78]} />
          <meshStandardMaterial
            color="#b9c4cf"
            roughness={0.6}
            metalness={0.2}
            transparent={hasActive}
            opacity={isRadiatorActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
          />
        </mesh>
      ))}
    </group>
  );
}

export function HeroSat() {
  const groupRef = useRef<Group>(null);
  const viewMode = useSimStore((s) => s.viewMode);

  const hoveredComponent = useUiStore((s) => s.hoveredComponent);
  const inspectComponent = useUiStore((s) => s.inspectComponent);
  const setHoveredComponent = useUiStore((s) => s.setHoveredComponent);
  const setInspectComponent = useUiStore((s) => s.setInspectComponent);
  const activeComponent = inspectComponent || hoveredComponent;
  const hasActive = activeComponent !== null;

  const rcsRefs = [
    useRef<Mesh>(null),
    useRef<Mesh>(null),
    useRef<Mesh>(null),
    useRef<Mesh>(null),
  ];
  const wingLGroupRef = useRef<Group>(null);
  const wingRGroupRef = useRef<Group>(null);
  const curWingAngle = useRef(0);

  const isBusActive = activeComponent === 'bus';
  const isComputeActive = activeComponent === 'compute';
  const isWingActive = activeComponent === 'wing';
  const isRadiatorActive = activeComponent === 'radiator';
  const isLaserActive = activeComponent === 'laser';

  const busMatRef = useRef<any>(null);
  const computeMatRef = useRef<any>(null);
  const wingMatRef1 = useRef<any>(null);
  const wingMatRef2 = useRef<any>(null);
  const radMatRef1 = useRef<any>(null);
  const radMatRef2 = useRef<any>(null);
  const laserMatRef1 = useRef<any>(null);
  const laserMatRef2 = useRef<any>(null);

  const gl = useThree((s) => s.gl) as WebGLRenderer;
  const maxAniso = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);
  const goldTex = useMemo(() => makeGoldMLI(maxAniso), [maxAniso]);
  const solarTex = useMemo(() => makeSolarTexture(maxAniso), [maxAniso]);
  const radTex = useMemo(() => makeRadiatorTexture(maxAniso), [maxAniso]);
  const glowTex = useMemo(
    () =>
      radialTexture([
        [0, 'rgba(220,250,255,1)'],
        [0.4, 'rgba(82,215,255,0.7)'],
        [1, 'rgba(82,215,255,0)'],
      ]),
    [],
  );

  useEffect(() => {
    heroGroupRef.current = groupRef.current;
    return () => {
      heroGroupRef.current = null;
    };
  }, []);

  useFrame((state, dt) => {
    const group = groupRef.current;
    if (!group) return;
    const st = useSimStore.getState();
    const inspect = st.viewMode === 'inspect';
    group.visible = inspect;
    labelState.active = inspect;
    if (!inspect) return;

    // position from the chased satellite
    const i = st.chaseIdx;
    _pos.set(
      telemetry.satWorld[i * 3] ?? 0,
      telemetry.satWorld[i * 3 + 1] ?? 0,
      telemetry.satWorld[i * 3 + 2] ?? 0,
    );

    // sun-facing basis: z = radial, x = sun projected onto tangent plane
    _z.copy(_pos).normalize();
    const d = _sun.dot(_z);
    _x.copy(_sun).addScaledVector(_z, -d);
    if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
    else _x.normalize();
    _y.copy(_z).cross(_x);
    _mat.makeBasis(_x, _y, _z);
    _quat.setFromRotationMatrix(_mat);

    group.position.copy(_pos);
    group.quaternion.copy(_quat);
    group.updateMatrixWorld(true);

    // publish hero transform
    telemetry.heroPos[0] = _pos.x;
    telemetry.heroPos[1] = _pos.y;
    telemetry.heroPos[2] = _pos.z;
    telemetry.heroQuat[0] = _quat.x;
    telemetry.heroQuat[1] = _quat.y;
    telemetry.heroQuat[2] = _quat.z;
    telemetry.heroQuat[3] = _quat.w;

    // project anchors → screen
    const { camera, size } = state;
    _center.copy(_pos);
    _toCam.copy(camera.position).sub(_center).normalize();

    for (const key of Object.keys(ANCHORS) as (keyof typeof ANCHORS)[]) {
      const local = ANCHORS[key];
      _world.copy(local);
      group.localToWorld(_world);

      _toAnchor.copy(_world).sub(_center);
      const facing = _toAnchor.lengthSq() > 1e-9 ? _toCam.dot(_toAnchor.normalize()) : 1;

      _proj.copy(_world).project(camera);
      const onScreen =
        _proj.z < 1 && _proj.x >= -1 && _proj.x <= 1 && _proj.y >= -1 && _proj.y <= 1;
      const sx = clamp((_proj.x * 0.5 + 0.5) * size.width, SCREEN_MARGIN, size.width - SCREEN_MARGIN);
      const sy = clamp(
        (-_proj.y * 0.5 + 0.5) * size.height,
        SCREEN_MARGIN,
        size.height - SCREEN_MARGIN,
      );

      const target = key === 'tipL' ? labelState.tipL : key === 'tipR' ? labelState.tipR : labelState.pts[key];
      target.x = sx;
      target.y = sy;
      target.op = smoothstep(-0.35, 0.35, facing);
      target.vis = onScreen && facing > -0.35;
    }

    // Highlighting dynamic properties updates
    const time = state.clock.getElapsedTime();
    const pulse = 1.3 + Math.sin(time * 8) * 0.4; // pulse between 0.9 and 1.7

    // 1. Solar array swivelling to track the Sun (or lay flat during eclipse)
    const adcsActive = useUiStore.getState().adcsActive;
    const eclipsed = telemetry.eclipsed[i] === 1;
    const sat = network.sats[i];
    const isLowPower = !!(sat && (sat as any).lowPower);

    // Project world sun vector to local tangent frame of sat:
    const localSunY = _sun.dot(_y);
    const localSunZ = _sun.dot(_z);
    const targetAngle = eclipsed ? 0 : Math.atan2(localSunZ, localSunY);
    
    // Smooth transition
    curWingAngle.current += (targetAngle - curWingAngle.current) * Math.min(1.0, dt * 5.0);
    
    if (wingLGroupRef.current) wingLGroupRef.current.rotation.x = curWingAngle.current;
    if (wingRGroupRef.current) wingRGroupRef.current.rotation.x = curWingAngle.current;

    // 2. ADCS RCS thruster firing plumes animation
    const tSec = state.clock.getElapsedTime();
    rcsRefs.forEach((ref, rIdx) => {
      if (ref.current) {
        if (!adcsActive) {
          ref.current.scale.set(0, 0, 0);
          ref.current.visible = false;
          return;
        }
        const phaseOffset = rIdx * 1.5;
        const isFiring = Math.sin(tSec * 15 + phaseOffset) > 0.5 && Math.cos(tSec * 4 + phaseOffset) > -0.3;
        
        if (isFiring) {
          ref.current.visible = true;
          const size = 0.5 + Math.random() * 0.8;
          ref.current.scale.set(size, size * 1.5, size);
        } else {
          ref.current.scale.set(0, 0, 0);
          ref.current.visible = false;
        }
      }
    });

    if (busMatRef.current) {
      busMatRef.current.transparent = hasActive;
      busMatRef.current.opacity = isBusActive ? 1.0 : (hasActive ? 0.25 : 1.0);
      busMatRef.current.emissive.set(isBusActive ? '#52d7ff' : '#000000');
      busMatRef.current.emissiveIntensity = isBusActive ? pulse : 0;
    }
    if (computeMatRef.current) {
      computeMatRef.current.transparent = hasActive;
      computeMatRef.current.opacity = isComputeActive ? 1.0 : (hasActive ? 0.25 : 1.0);
      computeMatRef.current.emissive.set('#52d7ff');
      computeMatRef.current.emissiveIntensity = isComputeActive ? pulse * 1.5 : (hasActive ? 0.15 : 0.8);
    }
    const updateWingMat = (ref: React.RefObject<any>) => {
      if (ref.current) {
        ref.current.transparent = hasActive;
        ref.current.opacity = isWingActive ? 1.0 : (hasActive ? 0.25 : 1.0);
        ref.current.emissive.set(isWingActive ? '#52d7ff' : '#0a1c4a');
        let intensity = isWingActive ? pulse : (hasActive ? 0.1 : 0.5);
        if (isLowPower) {
          intensity *= 0.15; // Dimmed when low power
        }
        ref.current.emissiveIntensity = intensity;
      }
    };
    updateWingMat(wingMatRef1);
    updateWingMat(wingMatRef2);

    if (radMatRef1.current) {
      radMatRef1.current.transparent = hasActive;
      radMatRef1.current.opacity = isRadiatorActive ? 1.0 : (hasActive ? 0.25 : 1.0);
      radMatRef1.current.emissive.set(isRadiatorActive ? '#52d7ff' : '#000000');
      radMatRef1.current.emissiveIntensity = isRadiatorActive ? pulse : 0;
    }
    if (radMatRef2.current) {
      radMatRef2.current.transparent = hasActive;
      radMatRef2.current.opacity = isRadiatorActive ? 1.0 : (hasActive ? 0.25 : 1.0);
      radMatRef2.current.emissive.set(isRadiatorActive ? '#52d7ff' : '#000000');
      radMatRef2.current.emissiveIntensity = isRadiatorActive ? pulse : 0;
    }
    const updateLaserMat = (ref: React.RefObject<any>) => {
      if (ref.current) {
        ref.current.transparent = hasActive;
        ref.current.opacity = isLaserActive ? 1.0 : (hasActive ? 0.25 : 1.0);
        ref.current.emissiveIntensity = isLaserActive ? pulse * 1.5 : (hasActive ? 0.2 : 1.2);
        ref.current.emissive.set(isLaserActive ? '#52d7ff' : '#52d7ff');
      }
    };
    updateLaserMat(laserMatRef1);
    updateLaserMat(laserMatRef2);
  });

  const wingEmissive = useMemo(() => new Color('#0a1c4a'), []);
  const computeGlow = useMemo(() => new Color('#52d7ff'), []);

  return (
    <group ref={groupRef} visible={viewMode === 'inspect'}>
      {/* bus — gold MLI thermal foil */}
      <mesh
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'bus' ? null : 'bus');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('bus');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      >
        <boxGeometry args={[0.7, 0.5, 0.95]} />
        <meshStandardMaterial
          ref={busMatRef}
          map={goldTex}
          metalness={0.75}
          roughness={0.42}
        />
      </mesh>

      {/* compute module: emissive cyan slot + 7 rack vent fins */}
      <mesh
        position={[0, -0.34, 0.12]}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'compute' ? null : 'compute');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('compute');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      >
        <boxGeometry args={[0.6, 0.18, 0.62]} />
        <meshStandardMaterial
          ref={computeMatRef}
          color="#0a1730"
          emissive={computeGlow}
          emissiveIntensity={0.8}
          roughness={0.3}
        />
      </mesh>
      {Array.from({ length: 7 }, (_, k) => (
        <mesh
          key={`fin${k}`}
          position={[-0.24 + k * 0.08, -0.44, 0.12]}
          onClick={(e) => {
            e.stopPropagation();
            setInspectComponent(inspectComponent === 'compute' ? null : 'compute');
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredComponent('compute');
          }}
          onPointerOut={() => setHoveredComponent(null)}
        >
          <boxGeometry args={[0.015, 0.05, 0.5]} />
          <meshStandardMaterial
            color="#23282e"
            metalness={0.7}
            roughness={0.5}
            transparent={hasActive}
            opacity={isComputeActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
          />
        </mesh>
      ))}

      {/* solar wings + yoke arm + hinge drum */}
      {([-1.6, 1.6] as const).map((wx, idx) => (
        <group key={wx}>
          {/* rotating solar panel group */}
          <group ref={idx === 0 ? wingLGroupRef : wingRGroupRef} position={[wx, 0.02, 0]}>
            <mesh
              position={[0, 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                setInspectComponent(inspectComponent === 'wing' ? null : 'wing');
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredComponent('wing');
              }}
              onPointerOut={() => setHoveredComponent(null)}
            >
              <boxGeometry args={[2.6, 0.04, 1.1]} />
              <meshStandardMaterial
                ref={idx === 0 ? wingMatRef1 : wingMatRef2}
                map={solarTex}
                emissive={wingEmissive}
                emissiveIntensity={0.5}
                metalness={0.3}
                roughness={0.5}
              />
            </mesh>
          </group>
          {/* yoke arm */}
          <mesh
            position={[wx * 0.2, 0.02, 0]}
            rotation={[0, 0, Math.PI / 2]}
            onClick={(e) => {
              e.stopPropagation();
              setInspectComponent(inspectComponent === 'wing' ? null : 'wing');
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredComponent('wing');
            }}
            onPointerOut={() => setHoveredComponent(null)}
          >
            <cylinderGeometry args={[0.03, 0.03, Math.abs(wx) * 0.7, 12]} />
            <meshStandardMaterial
              color="#80858d"
              metalness={0.85}
              roughness={0.4}
              transparent={hasActive}
              opacity={isWingActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
            />
          </mesh>
          {/* hinge drum at the bus */}
          <mesh
            position={[wx > 0 ? 0.36 : -0.36, 0.02, 0]}
            rotation={[0, 0, Math.PI / 2]}
            onClick={(e) => {
              e.stopPropagation();
              setInspectComponent(inspectComponent === 'wing' ? null : 'wing');
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredComponent('wing');
            }}
            onPointerOut={() => setHoveredComponent(null)}
          >
            <cylinderGeometry args={[0.07, 0.07, 0.16, 16]} />
            <meshStandardMaterial
              color="#5a606a"
              metalness={0.7}
              roughness={0.45}
              transparent={hasActive}
              opacity={isWingActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
            />
          </mesh>
        </group>
      ))}

      {/* ribbed radiators + coolant manifold pipes */}
      <Radiator
        z={1.55}
        tex={radTex}
        isRadiatorActive={isRadiatorActive}
        hasActive={hasActive}
        matRef={radMatRef1}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'radiator' ? null : 'radiator');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('radiator');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      />
      <Radiator
        z={-1.55}
        tex={radTex}
        isRadiatorActive={isRadiatorActive}
        hasActive={hasActive}
        matRef={radMatRef2}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'radiator' ? null : 'radiator');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('radiator');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      />
      {([1, -1] as const).map((sz) => (
        <mesh
          key={`pipe${sz}`}
          position={[0.12, 0, sz * 0.78]}
          rotation={[Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            setInspectComponent(inspectComponent === 'radiator' ? null : 'radiator');
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredComponent('radiator');
          }}
          onPointerOut={() => setHoveredComponent(null)}
        >
          <cylinderGeometry args={[0.022, 0.022, 1.4, 10]} />
          <meshStandardMaterial
            color="#9aa0a8"
            metalness={0.85}
            roughness={0.4}
            transparent={hasActive}
            opacity={isRadiatorActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
          />
        </mesh>
      ))}

      {/* laser terminals ×2: gimbal sphere + tapered barrel + glow */}
      {([-0.13, 0.13] as const).map((lx, idx) => (
        <group key={lx} position={[lx, 0.2, 0]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              setInspectComponent(inspectComponent === 'laser' ? null : 'laser');
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredComponent('laser');
            }}
            onPointerOut={() => setHoveredComponent(null)}
          >
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
              color="#2a323e"
              metalness={0.8}
              roughness={0.4}
              transparent={hasActive}
              opacity={isLaserActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
            />
          </mesh>
          <mesh
            position={[0, 0.12, 0]}
            onClick={(e) => {
              e.stopPropagation();
              setInspectComponent(inspectComponent === 'laser' ? null : 'laser');
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredComponent('laser');
            }}
            onPointerOut={() => setHoveredComponent(null)}
          >
            <cylinderGeometry args={[0.025, 0.05, 0.22, 14]} />
            <meshStandardMaterial
              ref={idx === 0 ? laserMatRef1 : laserMatRef2}
              color="#0a1730"
              emissive={computeGlow}
              emissiveIntensity={1.2}
              roughness={0.3}
            />
          </mesh>
          <sprite
            position={[0, 0.24, 0]}
            scale={0.32}
            onClick={(e) => {
              e.stopPropagation();
              setInspectComponent(inspectComponent === 'laser' ? null : 'laser');
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredComponent('laser');
            }}
            onPointerOut={() => setHoveredComponent(null)}
          >
            <spriteMaterial
              map={glowTex}
              transparent
              depthWrite={false}
              opacity={isLaserActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
            />
          </sprite>
        </group>
      ))}

      {/* greebles */}
      {/* star-tracker barrel (angled) */}
      <mesh
        position={[0.22, 0.18, -0.3]}
        rotation={[0.5, 0, 0.3]}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'bus' ? null : 'bus');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('bus');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      >
        <cylinderGeometry args={[0.04, 0.05, 0.18, 12]} />
        <meshStandardMaterial
          color="#1a2028"
          metalness={0.6}
          roughness={0.5}
          transparent={hasActive}
          opacity={isBusActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
        />
      </mesh>
      {/* GNSS patch antenna (flat) */}
      <mesh
        position={[-0.22, 0.27, -0.2]}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'bus' ? null : 'bus');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('bus');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      >
        <boxGeometry args={[0.14, 0.02, 0.14]} />
        <meshStandardMaterial
          color="#3a4450"
          metalness={0.5}
          roughness={0.6}
          transparent={hasActive}
          opacity={isBusActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
        />
      </mesh>
      {/* aft thruster nozzle (open cone) */}
      <mesh
        position={[0, -0.1, -0.52]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setInspectComponent(inspectComponent === 'bus' ? null : 'bus');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredComponent('bus');
        }}
        onPointerOut={() => setHoveredComponent(null)}
      >
        <coneGeometry args={[0.08, 0.16, 16, 1, true]} />
        <meshStandardMaterial
          color="#6a6258"
          metalness={0.7}
          roughness={0.5}
          side={2}
          transparent={hasActive}
          opacity={isBusActive ? 1.0 : (hasActive ? 0.25 : 1.0)}
        />
      </mesh>

      {/* ADCS RCS thruster firing plumes */}
      <mesh
        ref={rcsRefs[0]}
        position={[-0.38, 0.2, 0.35]}
        rotation={[0, 0, Math.PI / 2]}
        visible={false}
      >
        <coneGeometry args={[0.03, 0.16, 8]} />
        <meshBasicMaterial
          color="#52d7ff"
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={rcsRefs[1]}
        position={[0.38, 0.2, 0.35]}
        rotation={[0, 0, -Math.PI / 2]}
        visible={false}
      >
        <coneGeometry args={[0.03, 0.16, 8]} />
        <meshBasicMaterial
          color="#52d7ff"
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={rcsRefs[2]}
        position={[-0.38, 0.2, -0.35]}
        rotation={[0, 0, Math.PI / 2]}
        visible={false}
      >
        <coneGeometry args={[0.03, 0.16, 8]} />
        <meshBasicMaterial
          color="#52d7ff"
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={rcsRefs[3]}
        position={[0.38, 0.2, -0.35]}
        rotation={[0, 0, -Math.PI / 2]}
        visible={false}
      >
        <coneGeometry args={[0.03, 0.16, 8]} />
        <meshBasicMaterial
          color="#52d7ff"
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
