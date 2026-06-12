import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { on } from '../lib/bus';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';

// ── Module-scope scratch (allocate nothing per frame or click) ─────────────
const _satPos = new Vector3();
const _ndcPos = new Vector3();
const _v = new Vector3();
const _p = new Vector3();

/** Double-ring reticle texture. */
function makeReticle(): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = 'rgba(82,215,255,0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  // corner ticks
  ctx.lineWidth = 3;
  for (let a = 0; a < 4; a++) {
    const ang = (a * Math.PI) / 2 + Math.PI / 4;
    const x = s / 2 + Math.cos(ang) * s * 0.42;
    const y = s / 2 + Math.sin(ang) * s * 0.42;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * 10, y + Math.sin(ang) * 10);
    ctx.stroke();
  }
  return new CanvasTexture(c);
}

export function Picker() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const reticle = useMemo(() => {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: makeReticle(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    sprite.scale.setScalar(7);
    sprite.renderOrder = 10;
    sprite.visible = false;
    return sprite;
  }, []);

  useEffect(() => {
    return on('scene:click', ({ x, y }) => {
      const count = telemetry.count;
      if (count <= 0) return;

      const sw = telemetry.satWorld;
      const camPos = camera.position;
      const width = size.width;
      const height = size.height;

      // Click position mapped to screen pixels
      const clickX = ((x + 1) * width) / 2;
      const clickY = ((1 - y) * height) / 2;

      let bestIdx = -1;
      let bestDist = Infinity;
      const hitRadius = 22; // 22 pixels hit tolerance is extremely comfortable

      for (let i = 0; i < count; i++) {
        _satPos.set(sw[i * 3] ?? 0, sw[i * 3 + 1] ?? 0, sw[i * 3 + 2] ?? 0);

        // 1. Earth Occlusion Check: Line segment C -> S passes through Earth sphere (R=100)
        _v.copy(_satPos).sub(camPos);
        const vLenSq = _v.lengthSq();
        if (vLenSq > 1e-6) {
          const t = -camPos.dot(_v) / vLenSq;
          if (t > 0 && t < 1) {
            _p.copy(camPos).addScaledVector(_v, t);
            if (_p.lengthSq() < 100 * 100) {
              continue; // occluded by Earth!
            }
          }
        }

        // 2. Project 3D satellite position to 2D screen NDC space
        _ndcPos.copy(_satPos).project(camera);
        if (_ndcPos.z > 1) continue; // behind the camera frustum

        const screenX = ((_ndcPos.x + 1) * width) / 2;
        const screenY = ((1 - _ndcPos.y) * height) / 2;

        const dx = screenX - clickX;
        const dy = screenY - clickY;
        const dist = Math.hypot(dx, dy);

        if (dist < hitRadius && dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        useSimStore.getState().selectSat(bestIdx);
      }
    });
  }, [camera, size]);

  useFrame((_, dt) => {
    const st = useSimStore.getState();
    const i = st.selectedIdx;
    // hero replaces the reticle in inspect mode
    if (i < 0 || i >= telemetry.count || st.viewMode === 'inspect') {
      reticle.visible = false;
      return;
    }
    reticle.visible = true;
    reticle.position.set(
      telemetry.satWorld[i * 3] ?? 0,
      telemetry.satWorld[i * 3 + 1] ?? 0,
      telemetry.satWorld[i * 3 + 2] ?? 0,
    );
    (reticle.material as SpriteMaterial).rotation += dt * 0.5;
  });

  return <primitive object={reticle} />;
}
