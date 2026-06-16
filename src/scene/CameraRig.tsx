import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { emit } from '../lib/bus';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';
import { launch } from '../state/launch';
import { stopTour, tour } from '../state/tour';
import { cameraReset } from '../state/reset';
import { cameraState } from '../state/cameraState';
import { useUiStore } from '../state/ui';

const DIST_MIN = 6;
const DIST_MAX = 900;
const DIST_MIN_DEFAULT = 118; // overview floor
const DIST_MIN_TRACK = 4.2; // chase / inspect floor
const INSPECT_DIST = 6.5; // default distance on entering inspect
const CLICK_THRESHOLD = 6; // px of movement that still counts as a click

const _desired = new Vector3();
const _pos = new Vector3();

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const damp = (cur: number, to: number, lambda: number, dt: number) =>
  cur + (to - cur) * (1 - Math.exp(-lambda * dt));

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Mode-driven camera rig (replaces drei OrbitControls). Spherical orbit around
 * a target that depends on viewMode; smooth lerp on target + distance so mode
 * switches never jump. Drags rotate, wheel/pinch zoom. A non-drag click emits a
 * 'scene:click' bus event with NDC coords (the Phase-5 picker subscribes).
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const yaw = useRef(0.5);
  const pitch = useRef(0.45);
  const dist = useRef(320);
  const targetDist = useRef(320);
  const target = useRef(new Vector3());
  const lastInput = useRef(0);
  const reduced = useRef(prefersReducedMotion());
  const prevMode = useRef('overview');

  const drag = useRef({ active: false, lastX: 0, lastY: 0, moved: 0, downX: 0, downY: 0 });
  const pinch = useRef({ active: false, startDist: 0, startTarget: 320 });

  useEffect(() => {
    const dom = gl.domElement;

    const markInput = () => {
      lastInput.current = performance.now();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (tour.active) stopTour(true); // any drag hands control back
      drag.current.active = true;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.downX = e.clientX;
      drag.current.downY = e.clientY;
      drag.current.moved = 0;
      dom.setPointerCapture(e.pointerId);
      markInput();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      yaw.current -= dx * 0.005;
      pitch.current = clamp(pitch.current + dy * 0.005, -1.4, 1.4);
      markInput();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!drag.current.active) return;
      drag.current.active = false;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      // click (not drag) → emit NDC
      if (drag.current.moved < CLICK_THRESHOLD) {
        const rect = dom.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        emit('scene:click', { x, y });
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetDist.current = clamp(
        targetDist.current * (1 + e.deltaY * 0.001),
        DIST_MIN,
        DIST_MAX,
      );
      markInput();
    };

    const touchDist = (e: TouchEvent) => {
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinch.current.active = true;
        pinch.current.startDist = touchDist(e);
        pinch.current.startTarget = targetDist.current;
        markInput();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (pinch.current.active && e.touches.length === 2) {
        e.preventDefault();
        const ratio = pinch.current.startDist / Math.max(1, touchDist(e));
        targetDist.current = clamp(
          pinch.current.startTarget * ratio,
          DIST_MIN,
          DIST_MAX,
        );
        markInput();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current.active = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('touchstart', onTouchStart, { passive: false });
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
    };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const motion = reduced.current ? 0.25 : 1;
    const dt = dtRaw;
    const st = useSimStore.getState();
    const mode = st.viewMode;

    // consume a deep-linked camera restore once
    if (cameraState.restore) {
      yaw.current = cameraState.restore.yaw;
      pitch.current = cameraState.restore.pitch;
      targetDist.current = cameraState.restore.dist;
      dist.current = cameraState.restore.dist;
      cameraState.restore = null;
    }
    // photo mode: slow auto-dolly
    if (st.photoMode) yaw.current += dt * 0.008;

    // On entering inspect, snap the *desired* distance to the fly-in default so
    // (target lerp + distance damp) reads as a smooth zoom, never a cut.
    if (mode !== prevMode.current) {
      if (mode === 'inspect') targetDist.current = INSPECT_DIST;
      else if (mode === 'moon') targetDist.current = 100;
      else if (mode === 'mars') targetDist.current = 180;
      prevMode.current = mode;
    }

    if (mode === 'inspect') {
      const uist = useUiStore.getState();
      if (uist.inspectComponent && targetDist.current > 11.5) {
        // clear selected component on zoom out!
        uist.setInspectComponent(null);
      }
    }

    // desired target + min distance by mode
    let minDist = DIST_MIN_DEFAULT;
    if (mode === 'chase' || mode === 'inspect') {
      const i = st.chaseIdx;
      _desired.set(
        telemetry.satWorld[i * 3] ?? 0,
        telemetry.satWorld[i * 3 + 1] ?? 0,
        telemetry.satWorld[i * 3 + 2] ?? 0,
      );
      minDist = DIST_MIN_TRACK; // 4.2 for both chase and inspect
    } else if (mode === 'launch') {
      _desired.copy(launch.shipPos);
      minDist = DIST_MIN;
      targetDist.current = launch.camDist; // phase-driven (9 → 16 → 20)
    } else if (mode === 'moon') {
      _desired.set(
        telemetry.moonWorld[0] || 1450,
        telemetry.moonWorld[1] || 0,
        telemetry.moonWorld[2] || 0
      );
      minDist = 30;
    } else if (mode === 'mars') {
      _desired.set(
        telemetry.marsWorld[0] || 2600,
        telemetry.marsWorld[1] || 0,
        telemetry.marsWorld[2] || 0
      );
      minDist = 60;
    } else {
      _desired.set(0, 0, 0);
    }

    // idle auto-yaw drift (mode-aware; amplified into a dolly while touring)
    const touring = tour.active && mode !== 'launch';
    let drift = 0;
    if (mode === 'overview') drift = touring ? 0.1 : 0.02;
    else if (mode === 'inspect') drift = touring ? 0.14 : 0.06;
    const idle = performance.now() - lastInput.current > 1500 && !drag.current.active;
    if ((idle || touring) && !reduced.current) yaw.current += dt * drift;

    // tour drives the camera distance directly
    if (touring) targetDist.current = tour.camDist;

    // global reset: ease yaw/pitch/distance to the intro framing over ~1.2 s
    if (cameraReset.active) {
      cameraReset.t += dt;
      const k = 1 - Math.exp(-6 * dt);
      yaw.current += (cameraReset.yaw - yaw.current) * k;
      pitch.current += (cameraReset.pitch - pitch.current) * k;
      targetDist.current += (cameraReset.dist - targetDist.current) * k;
      if (cameraReset.t > 1.2) cameraReset.active = false;
    }

    // smooth target + distance (inspect lerps faster → snappy fly-in)
    const lambda = (mode === 'inspect' ? 5 : 4) * motion;
    target.current.x = damp(target.current.x, _desired.x, lambda, dt);
    target.current.y = damp(target.current.y, _desired.y, lambda, dt);
    target.current.z = damp(target.current.z, _desired.z, lambda, dt);

    targetDist.current = clamp(targetDist.current, minDist, DIST_MAX);
    dist.current = damp(dist.current, targetDist.current, 5 * motion, dt);
    dist.current = clamp(dist.current, minDist, DIST_MAX);

    // spherical → cartesian around target
    const cp = Math.cos(pitch.current);
    _pos.set(
      target.current.x + dist.current * cp * Math.sin(yaw.current),
      target.current.y + dist.current * Math.sin(pitch.current),
      target.current.z + dist.current * cp * Math.cos(yaw.current),
    );
    camera.position.copy(_pos);
    camera.lookAt(target.current);

    // publish spherical state for the permalink serializer
    cameraState.yaw = yaw.current;
    cameraState.pitch = pitch.current;
    cameraState.dist = dist.current;
  });

  return null;
}
