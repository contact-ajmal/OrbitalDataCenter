import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  type Mesh,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { NOMINAL_WARP } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { toast } from '../lib/bus';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';
import {
  conjunction,
  conjunctionTiming,
  tickConjunction,
  triggerConjunction,
} from '../state/conjunction';

const _satPos = new Vector3();

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export function DebrisEvent() {
  const debrisRef = useRef<Mesh>(null);
  const autoTimer = useRef(0);
  const nextAuto = useRef(rand(90, 240));
  const wasResolved = useRef(false);

  const reticle = useMemo(() => {
    const s = new Sprite(
      new SpriteMaterial({
        map: radialTexture([
          [0, 'rgba(255,200,120,0)'],
          [0.62, 'rgba(255,181,84,0)'],
          [0.72, 'rgba(255,181,84,0.95)'],
          [0.82, 'rgba(255,181,84,0)'],
          [1, 'rgba(255,181,84,0)'],
        ]),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    s.scale.setScalar(6);
    s.renderOrder = 11;
    s.visible = false;
    return s;
  }, []);

  const plume = useMemo(() => {
    const s = new Sprite(
      new SpriteMaterial({
        map: radialTexture([
          [0, 'rgba(255,240,210,0.9)'],
          [0.4, 'rgba(255,150,60,0.6)'],
          [1, 'rgba(255,120,40,0)'],
        ]),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    s.scale.setScalar(2);
    s.visible = false;
    return s;
  }, []);

  useFrame((_, dt) => {
    const st = useSimStore.getState();
    const simDelta = (st.paused ? 0 : dt) * (st.timeWarp / NOMINAL_WARP);

    // auto-trigger every 90–240 s of sim time
    if (!conjunction.active) {
      autoTimer.current += simDelta;
      if (autoTimer.current >= nextAuto.current) {
        autoTimer.current = 0;
        nextAuto.current = rand(90, 240);
        triggerConjunction(telemetry.simT);
      }
    }

    tickConjunction(simDelta);

    const debris = debrisRef.current;
    if (!conjunction.active) {
      if (debris) debris.visible = false;
      reticle.visible = false;
      plume.visible = false;
      wasResolved.current = false;
      return;
    }

    // resolved-banner transition toast (once)
    if (conjunction.phase === 'resolved' && !wasResolved.current) {
      wasResolved.current = true;
      toast('MISS CONFIRMED — Δv 0.4 M/S · NEW ALT +2.2 KM');
    }

    const i = conjunction.satIdx;
    _satPos.set(
      telemetry.satWorld[i * 3] ?? 0,
      telemetry.satWorld[i * 3 + 1] ?? 0,
      telemetry.satWorld[i * 3 + 2] ?? 0,
    );

    // debris
    if (debris) {
      debris.visible = true;
      debris.position.copy(conjunction.pos);
      debris.rotation.x += conjunction.tumble.x * dt;
      debris.rotation.y += conjunction.tumble.y * dt;
      debris.rotation.z += conjunction.tumble.z * dt;
    }

    // pulsing amber reticle on the threatened sat (alert + maneuver)
    const showReticle = conjunction.phase === 'alert' || conjunction.phase === 'maneuver';
    reticle.visible = showReticle;
    if (showReticle) {
      reticle.position.copy(_satPos);
      reticle.scale.setScalar(5 + Math.sin(performance.now() * 0.012) * 1.2);
    }

    // 1.5 s avoidance burn from T−6 s
    const burning = conjunction.t >= conjunctionTiming.MANEUVER_T && conjunction.t < conjunctionTiming.MANEUVER_T + 1.5;
    plume.visible = burning;
    if (burning) {
      plume.position.copy(_satPos);
      plume.scale.setScalar(1.6 + Math.random() * 0.8);
    }
  });

  return (
    <>
      <mesh ref={debrisRef} visible={false}>
        <boxGeometry args={[0.5, 0.32, 0.4]} />
        <meshStandardMaterial color="#8a8f96" metalness={0.5} roughness={0.7} />
      </mesh>
      <primitive object={reticle} />
      <primitive object={plume} />
    </>
  );
}
