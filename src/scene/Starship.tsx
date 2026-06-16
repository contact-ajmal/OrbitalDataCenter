import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  type Mesh,
  MeshStandardMaterial,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { NOMINAL_WARP, SCENE, STARBASE } from '../lib/constants';
import { latLonToVec } from '../lib/geo';
import { radialTexture } from '../lib/glow';
import { on, toast } from '../lib/bus';
import { ANGULAR_RATE, angleToPos } from '../sim/constellation';
import { buildLinks } from '../sim/links';
import {
  buildPlan,
  easeAsc,
  LAUNCH,
  makeDeploySat,
  phaseFor,
  quadBezier,
  type LaunchPlan,
} from '../sim/launch';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { earthGroupRef } from '../state/world';
import { useSimStore, type ViewMode } from '../state/sim';
import { launch } from '../state/launch';
import { launchTally } from '../state/econ';
import { useTexture } from '@react-three/drei';

const ORBIT_R = SCENE.ORBIT_R;
const EARTH_R = SCENE.EARTH_R;
const UP = new Vector3(0, 1, 0);
const BOOSTER_H = 1.6;
const PAD_LOCAL = latLonToVec(STARBASE.lat, STARBASE.lon, EARTH_R);

/** Stencil-style STARBASE decal for the tower column. */
function makeStarbaseDecal(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.font = '700 34px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(180,190,200,0.9)';
  ctx.fillStyle = 'rgba(120,130,140,0.25)';
  ctx.letterSpacing = '6px';
  ctx.fillText('STARBASE', 128, 34);
  ctx.strokeText('STARBASE', 128, 34);
  return new CanvasTexture(c);
}

type Run = {
  t: number;
  plan: LaunchPlan | null;
  deployed: number;
  inserted: boolean;
  insertionSimT: number;
  sepPos: Vector3 | null;
  ctrl: Vector3 | null;
  caught: boolean;
  deorbiting: boolean;
  deorbT: number;
  fadeT: number;
  prevView: ViewMode;
  prevSatCount: number;
  done: boolean;
};

// scratch
const _shipPos = new Vector3();
const _shipUp = new Vector3();
const _padWorld = new Vector3();
const _radialPad = new Vector3();
const _catch = new Vector3();
const _bWorld = new Vector3();
const _radialB = new Vector3();
const _quat = new Quaternion();
const _q2 = new Quaternion();
const _angA: number[] = [0, 0, 0];
const _angB: number[] = [0, 0, 0];

export function Starship() {
  const runRef = useRef<Run | null>(null);
  const shipRef = useRef<Group>(null);
  const boosterRef = useRef<Group>(null);
  const towerRef = useRef<Group>(null);
  const boosterPlumeRef = useRef<Mesh>(null);
  const starshipLaunchTex = useTexture('/textures/starship/starship-launch.png');
  const returnPlumeRef = useRef<Mesh>(null);
  const shipPlumeRef = useRef<Mesh>(null);
  const doorRef = useRef<Mesh>(null);

  const warm = useMemo(() => new Color('#ff7a2c'), []);
  const cyan = useMemo(() => new Color('#52d7ff'), []);
  const plumeSprite = useMemo(
    () =>
      new Sprite(
        new SpriteMaterial({
          map: radialTexture([
            [0, 'rgba(255,240,210,0.9)'],
            [0.4, 'rgba(255,150,60,0.6)'],
            [1, 'rgba(255,120,40,0)'],
          ]),
          blending: AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      ),
    [],
  );

  const starbaseDecal = useMemo(makeStarbaseDecal, []);

  const towerInner = useMemo(() => {
    const q = new Quaternion().setFromUnitVectors(UP, PAD_LOCAL.clone().normalize());
    return {
      pos: [PAD_LOCAL.x, PAD_LOCAL.y, PAD_LOCAL.z] as [number, number, number],
      quat: [q.x, q.y, q.z, q.w] as [number, number, number, number],
    };
  }, []);

  const resetShipMaterials = (ship: Group) => {
    ship.traverse((o) => {
      const m = (o as Mesh).material;
      if (m instanceof MeshStandardMaterial) {
        m.opacity = 1;
        m.transparent = false;
      }
    });
  };

  // ── Launch trigger ───────────────────────────────────────────────────────
  useEffect(() => {
    return on('launch:request', () => {
      const st = useSimStore.getState();
      if (runRef.current) return;
      if (st.satCount + LAUNCH.DEPLOY_COUNT > SCENE.MAX_SATS) {
        toast('LAUNCH SCRUBBED — FLEET AT CAPACITY');
        return;
      }
      if (shipRef.current) resetShipMaterials(shipRef.current);
      boosterRef.current?.scale.setScalar(1);
      runRef.current = {
        t: LAUNCH.COUNTDOWN_FROM,
        plan: null,
        deployed: 0,
        inserted: false,
        insertionSimT: 0,
        sepPos: null,
        ctrl: null,
        caught: false,
        deorbiting: false,
        deorbT: 0,
        fadeT: 1,
        prevView: st.viewMode,
        prevSatCount: st.satCount,
        done: false,
      };
      launch.active = true;
      launch.deployed = 0;
      st.setViewMode('launch');
    });
  }, []);

  useFrame((_, dt) => {
    const ship = shipRef.current;
    const booster = boosterRef.current;
    const tower = towerRef.current;
    if (!ship || !booster) return;
    const earth = earthGroupRef.current;
    const run = runRef.current;

    // tower rides the planet (copy earth's rotation), visible only on missions
    if (tower) {
      if (earth) tower.quaternion.copy(earth.quaternion);
      tower.visible = !!run;
    }

    if (!run) {
      ship.visible = false;
      booster.visible = false;
      return;
    }

    const sim = useSimStore.getState();
    const w = sim.timeWarp / NOMINAL_WARP;
    const sdt = sim.paused ? 0 : dt; // launch freezes under pause
    run.t += sdt * w;
    ship.visible = true;

    // live pad + catch point (recomputed every frame — the tower rotates)
    if (earth) earth.updateMatrixWorld();
    _padWorld.copy(PAD_LOCAL);
    if (earth) earth.localToWorld(_padWorld);
    _radialPad.copy(_padWorld).normalize();
    _catch.copy(_padWorld).addScaledVector(_radialPad, LAUNCH.CATCH_HEIGHT);

    // ── COUNTDOWN: stacked on the tower, glued to the rotating planet ──
    if (run.t < 0) {
      _quat.setFromUnitVectors(UP, _radialPad);
      booster.visible = true;
      booster.position.copy(_padWorld).addScaledVector(_radialPad, 0.2);
      booster.quaternion.copy(_quat);
      booster.scale.setScalar(1);
      ship.position.copy(_padWorld).addScaledVector(_radialPad, 0.2 + BOOSTER_H);
      ship.quaternion.copy(_quat);
      const igniting = run.t > -0.8;
      if (boosterPlumeRef.current) {
        boosterPlumeRef.current.visible = igniting;
        boosterPlumeRef.current.scale.set(1, 0.4 + Math.random() * 0.5, 1);
      }
      launch.shipPos.copy(ship.position);
      launch.camDist = 8;
      launch.missionT = run.t;
      launch.phaseLabel = phaseFor(run.t, 0, false, false).label;
      return;
    }

    // ── RELEASE: build the ascent bezier from the LIVE pad position ──
    if (!run.plan) {
      let maxPlane = 0;
      for (const s of network.sats) maxPlane = Math.max(maxPlane, s.plane);
      run.plan = buildPlan(_padWorld.clone(), maxPlane + 1);
    }
    const plan = run.plan;

    // ── Ship path ──
    if (run.t <= LAUNCH.T_ASC) {
      const u = easeAsc(run.t / LAUNCH.T_ASC);
      plan.curve.getPointAt(u, _shipPos);
      plan.curve.getTangentAt(u, _shipUp).normalize();
    } else {
      if (!run.inserted) {
        run.inserted = true;
        run.insertionSimT = telemetry.simT;
      }
      const ang = plan.a0 + (telemetry.simT - run.insertionSimT) * ANGULAR_RATE;
      const r = run.deorbiting ? Math.max(EARTH_R, ORBIT_R - run.deorbT * 1.6) : ORBIT_R;
      angleToPos(ang, plan.raan, plan.inc, r, _angA);
      _shipPos.set(_angA[0]!, _angA[1]!, _angA[2]!);
      angleToPos(ang + 0.01, plan.raan, plan.inc, r, _angB);
      _shipUp.set(_angB[0]! - _shipPos.x, _angB[1]! - _shipPos.y, _angB[2]! - _shipPos.z).normalize();
    }
    _quat.setFromUnitVectors(UP, _shipUp);
    ship.position.copy(_shipPos);
    ship.quaternion.copy(_quat);

    // ── Booster: attached → return bezier → caught on the live arms ──
    if (run.t < LAUNCH.SEP_T) {
      booster.visible = true;
      booster.position.copy(_shipPos).addScaledVector(_shipUp, -BOOSTER_H);
      booster.quaternion.copy(_quat);
      booster.scale.setScalar(1);
    } else {
      if (!run.sepPos) {
        run.sepPos = _shipPos.clone().addScaledVector(_shipUp, -BOOSTER_H);
        const mid = run.sepPos.clone().add(_catch).multiplyScalar(0.5);
        run.ctrl = mid.add(mid.clone().normalize().multiplyScalar(15));
      }
      booster.visible = true;
      if (!run.caught) {
        const s = easeAsc(
          (run.t - LAUNCH.SEP_T) / (LAUNCH.BOOSTER_RETURN_END - LAUNCH.SEP_T),
        );
        quadBezier(run.sepPos!, run.ctrl!, _catch, s, _bWorld);
        booster.position.copy(_bWorld);
        _radialB.copy(_bWorld).normalize();
        _q2.setFromUnitVectors(UP, _radialB);
        booster.quaternion.copy(_q2);
        if (returnPlumeRef.current) {
          const on = s < 0.3 || s > 0.74;
          returnPlumeRef.current.visible = on;
          returnPlumeRef.current.scale.set(1, 0.6 + Math.random() * 0.5, 1);
        }
        if (s >= 1) {
          run.caught = true;
          toast('MECHAZILLA CATCH — SUPER HEAVY SECURED ON THE CHOPSTICKS');
        }
      } else {
        booster.position.copy(_catch);
        _radialB.copy(_catch).normalize();
        _q2.setFromUnitVectors(UP, _radialB);
        booster.quaternion.copy(_q2);
        if (returnPlumeRef.current) returnPlumeRef.current.visible = false;
      }
    }

    // plumes
    if (boosterPlumeRef.current) {
      const firing = run.t < LAUNCH.SEP_T;
      boosterPlumeRef.current.visible = firing;
      if (firing) boosterPlumeRef.current.scale.set(1, 0.85 + Math.random() * 0.3, 1);
    }
    if (shipPlumeRef.current) {
      const ascentFire = run.t >= LAUNCH.SEP_T && run.t < LAUNCH.T_ASC;
      const retro = run.deorbiting && run.deorbT < 1;
      shipPlumeRef.current.visible = ascentFire || retro;
      shipPlumeRef.current.scale.set(1, 0.8 + Math.random() * 0.3, 1);
    }

    // door pulse + Pez deploy
    const door = doorRef.current?.material as MeshStandardMaterial | undefined;
    const deploying = run.t >= LAUNCH.DEPLOY_START && run.deployed < LAUNCH.DEPLOY_COUNT;
    if (door) door.emissiveIntensity = deploying ? 0.6 + 0.6 * Math.abs(Math.sin(run.t * 9)) : 0.05;

    if (run.t >= LAUNCH.DEPLOY_START && run.deployed < LAUNCH.DEPLOY_COUNT) {
      const due = Math.min(
        LAUNCH.DEPLOY_COUNT,
        Math.floor((run.t - LAUNCH.DEPLOY_START) / LAUNCH.DEPLOY_INTERVAL) + 1,
      );
      while (run.deployed < due) {
        const newSat = makeDeploySat(plan, run.deployed, telemetry.simT, _shipPos);
        const burnedIdx = network.sats.findIndex((s) => s.burned);
        if (burnedIdx !== -1) {
          const s = network.sats[burnedIdx]!;
          s.burned = false;
          s.deorbiting = false;
          s.r = newSat.r;
          s.plane = newSat.plane;
          s.slot = newSat.slot;
          s.raan = newSat.raan;
          s.inc = newSat.inc;
          s.phase = newSat.phase;
          s.deployFrom = newSat.deployFrom;
          s.deployT = newSat.deployT;
          toast(`REPLACED BURNED SAT-${burnedIdx} WITH NEW DEPLOYMENT`);
        } else {
          network.sats.push(newSat);
        }
        run.deployed++;
      }
      launch.deployed = run.deployed;
    }

    // ── Deorbit burn → fade ──
    const deployEnd = LAUNCH.DEPLOY_START + LAUNCH.DEPLOY_COUNT * LAUNCH.DEPLOY_INTERVAL;
    if (run.deployed >= LAUNCH.DEPLOY_COUNT && run.t > deployEnd + 0.5 && !run.deorbiting) {
      run.deorbiting = true;
    }
    if (run.deorbiting) {
      if (run.deorbT < 1) {
        run.deorbT = Math.min(1, run.deorbT + (sdt * w) / LAUNCH.DEORBIT_BURN);
      } else {
        run.fadeT = Math.max(0, run.fadeT - (sdt * w) / LAUNCH.DEORBIT_FADE);
        ship.traverse((o) => {
          const m = (o as Mesh).material;
          if (m instanceof MeshStandardMaterial) {
            m.transparent = true;
            m.opacity = run.fadeT;
          }
        });
        if (run.fadeT <= 0) {
          // ── Integrate + reset for the next mission ──
          const { pairs, adj } = buildLinks(network.sats);
          network.pairs = pairs;
          network.adj = adj;
          network.count = network.sats.length;
          const st = useSimStore.getState();
          st.setSatCount(network.sats.length);
          st.setViewMode(run.prevView);
          toast('+60 SATS · +7.2 MW · 129 T DELIVERED TO LEO · BOOSTER CAUGHT');
          launchTally.count++;
          resetShipMaterials(ship);
          booster.scale.setScalar(1);
          ship.visible = false;
          booster.visible = false;
          launch.active = false;
          launch.deployed = 0;
          runRef.current = null;
          return;
        }
      }
    }

    // publish
    launch.shipPos.copy(_shipPos);
    launch.missionT = run.t * LAUNCH.CLOCK_SCALE;
    launch.phaseLabel = phaseFor(run.t, run.deployed, run.caught, run.deorbiting).label;
    launch.camDist = run.t < LAUNCH.SEP_T ? 8 : run.t < LAUNCH.DEPLOY_START ? 15 : 18;
  });

  return (
    <>
      {/* ── Mechazilla tower (rides the planet via towerRef = earth quat) ── */}
      <group ref={towerRef} visible={false}>
        <group position={towerInner.pos} quaternion={towerInner.quat}>
          {/* launch mount ring */}
          <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.05, 8, 24]} />
            <meshStandardMaterial color="#3a4450" metalness={0.7} roughness={0.5} />
          </mesh>
          {/* truss column */}
          <mesh position={[0.5, 1.9, 0]}>
            <boxGeometry args={[0.16, 3.6, 0.16]} />
            <meshStandardMaterial color="#4a525c" metalness={0.6} roughness={0.5} />
          </mesh>
          {/* 6 band frames */}
          {[0.7, 1.3, 1.9, 2.5, 3.1, 3.6].map((y) => (
            <mesh key={y} position={[0.5, y, 0]}>
              <boxGeometry args={[0.26, 0.04, 0.26]} />
              <meshStandardMaterial color="#5a626c" metalness={0.6} roughness={0.5} />
            </mesh>
          ))}
          {/* two chopstick arms at height 2.9 */}
          {([-0.16, 0.16] as const).map((z) => (
            <mesh key={z} position={[0.18, 2.9, z]}>
              <boxGeometry args={[0.7, 0.06, 0.07]} />
              <meshStandardMaterial color="#6a727c" metalness={0.7} roughness={0.45} />
            </mesh>
          ))}
          {/* STARBASE decal on the column */}
          <mesh position={[0.5, 2.0, 0.1]}>
            <planeGeometry args={[1, 0.25]} />
            <meshBasicMaterial map={starbaseDecal} transparent depthWrite={false} />
          </mesh>
          {/* Starship photo billboard */}
          <sprite position={[1.5, 2.0, 0]} scale={[2.5, 2.5, 1]}>
            <spriteMaterial map={starshipLaunchTex} transparent opacity={0.9} depthWrite={false} />
          </sprite>
        </group>
      </group>

      {/* ── Ship ── (local +Y up) */}
      <group ref={shipRef} visible={false}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.85, 24]} />
          <meshStandardMaterial color="#b8bcc4" metalness={0.95} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.188, 0.188, 0.85, 24, 1, true, 0, Math.PI]} />
          <meshStandardMaterial color="#0a0a0c" metalness={0.2} roughness={0.85} side={2} />
        </mesh>
        <mesh position={[0, 1.02, 0]}>
          <coneGeometry args={[0.18, 0.34, 24]} />
          <meshStandardMaterial color="#b8bcc4" metalness={0.95} roughness={0.25} />
        </mesh>
        <mesh ref={doorRef} position={[0.17, 0.55, 0]}>
          <boxGeometry args={[0.03, 0.5, 0.16]} />
          <meshStandardMaterial color="#0a1730" emissive="#52d7ff" emissiveIntensity={0.05} />
        </mesh>
        {([0.13, -0.13] as const).map((zx) => (
          <mesh key={`ff${zx}`} position={[0, 0.8, zx]}>
            <boxGeometry args={[0.16, 0.12, 0.03]} />
            <meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.4} />
          </mesh>
        ))}
        {([0.16, -0.16] as const).map((zx) => (
          <mesh key={`af${zx}`} position={[0, 0.12, zx]}>
            <boxGeometry args={[0.22, 0.2, 0.03]} />
            <meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.4} />
          </mesh>
        ))}
        <mesh ref={shipPlumeRef} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.1, 0.5, 16, 1, true]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* ── Super Heavy booster ── */}
      <group ref={boosterRef} visible={false}>
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 1.45, 24]} />
          <meshStandardMaterial color="#aeb3bb" metalness={0.95} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.19, 0.165, 0.16, 24]} />
          <meshStandardMaterial color="#15171c" metalness={0.7} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.185, 0.185, 0.08, 24, 1, true]} />
          <meshStandardMaterial color="#2a2018" emissive={warm} emissiveIntensity={0.5} side={2} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.22, 1.4, Math.sin(a) * 0.22]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.12, 0.14, 0.02]} />
              <meshStandardMaterial color="#80858d" metalness={0.85} roughness={0.45} />
            </mesh>
          );
        })}
        {/* ascent plume */}
        <mesh ref={boosterPlumeRef} position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.16, 0.7, 18, 1, true]} />
          <meshBasicMaterial color={warm} transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* boostback / landing return plume */}
        <mesh ref={returnPlumeRef} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.12, 0.5, 16, 1, true]} />
          <meshBasicMaterial color={warm} transparent opacity={0.75} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        <primitive object={plumeSprite} position={[0, -0.4, 0]} scale={1.1} />
      </group>
    </>
  );
}
