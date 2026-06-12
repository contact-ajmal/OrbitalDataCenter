import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  Raycaster,
  Sprite,
  SpriteMaterial,
  Vector2,
} from 'three';
import { on } from '../lib/bus';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { useSimStore } from '../state/sim';

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

  const raycaster = useMemo(() => {
    const r = new Raycaster();
    r.params.Points = { threshold: 2.4 };
    return r;
  }, []);
  const ndc = useMemo(() => new Vector2(), []);

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
      const pts = network.glintPoints;
      if (!pts) return;
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      raycaster.params.Points = { threshold: 2.4 };
      const hits = raycaster.intersectObject(pts, false);
      const count = telemetry.count;
      for (const h of hits) {
        if (h.index != null && h.index < count) {
          // select + chase + inspect → "fly into the satellite I clicked"
          useSimStore.getState().selectSat(h.index);
          break;
        }
      }
    });
  }, [camera, raycaster, ndc]);

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
