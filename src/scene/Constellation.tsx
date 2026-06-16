import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { NOMINAL_WARP, SCENE, SCENE_COLORS, SUN_DIR } from '../lib/constants';
import { angleToPos, buildWalkerConstellation, satAngle } from '../sim/constellation';
import { buildLinks } from '../sim/links';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';
import { network } from '../state/network';
import { storm } from '../state/storm';
import { toast } from '../lib/bus';
import { thermalColor } from './thermalPalette';

const MAX = SCENE.MAX_SATS;
const EARTH_R = SCENE.EARTH_R;
const SAT_SCALE = 0.62;

// ── Module-scope scratch (allocate NOTHING per frame) ──────────────────────
const _angle: number[] = [0, 0, 0];
const _pos = new Vector3();
const _sun = new Vector3(SUN_DIR[0], SUN_DIR[1], SUN_DIR[2]).normalize();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _base = new Matrix4();
const _part = new Matrix4();
const _scaleV = new Vector3();
const _white = new Color(1, 1, 1);
const _eclipseCol = new Color(SCENE_COLORS.satEclipse);
const _glintBright = new Color(0.55, 0.85, 1.0);
const _glintDim = new Color(0.12, 0.18, 0.26);
const _stormOrange = new Color('#7a3a14');
const _stormGlint = new Color();
const _wingCol = new Color();
const _irGlint = new Color();
const _radHot = new Color();
const _radEmis = new Color();
const thermalLag = new Float32Array(MAX); // per-sat temperature lag (re-heat ~2 s)

// Per-part local offsets (sat-local space; scale is folded into _base).
const OFF_BUS = new Matrix4();
const OFF_WL = new Matrix4().makeTranslation(0, 1.55, 0);
const OFF_WR = new Matrix4().makeTranslation(0, -1.55, 0);
const OFF_RF = new Matrix4()
  .makeTranslation(0, 0, 1.05)
  .multiply(new Matrix4().makeRotationY(Math.PI / 2));
const OFF_RB = new Matrix4()
  .makeTranslation(0, 0, -1.05)
  .multiply(new Matrix4().makeRotationY(Math.PI / 2));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function makeGlintTexture(): CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(180,230,255,0.8)');
  g.addColorStop(1.0, 'rgba(120,200,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}

export function Constellation() {
  const satCount = useSimStore((s) => s.satCount);

  const busRef = useRef<InstancedMesh>(null);
  const wingLRef = useRef<InstancedMesh>(null);
  const wingRRef = useRef<InstancedMesh>(null);
  const radFRef = useRef<InstancedMesh>(null);
  const radBRef = useRef<InstancedMesh>(null);
  const glintRef = useRef<Points>(null);

  // ── Geometry / materials (built once) ────────────────────────────────────
  const busGeo = useMemo(() => new BoxGeometry(0.55, 0.55, 1.0), []);
  const wingGeo = useMemo(() => new BoxGeometry(0.05, 2.2, 1.0), []);
  const radGeo = useMemo(() => new BoxGeometry(0.05, 1.5, 0.8), []);

  const busMat = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.satBus, metalness: 0.6, roughness: 0.45 }),
    [],
  );
  const wingMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: SCENE_COLORS.satWing,
        emissive: SCENE_COLORS.satWingEmissive,
        emissiveIntensity: 0.7,
        metalness: 0.2,
        roughness: 0.5,
      }),
    [],
  );
  const radMat = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.satRadiator, roughness: 0.85 }),
    [],
  );

  // ── Glint layer (also the Phase-5 raycast target) ────────────────────────
  const glint = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const posAttr = new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage);
    const colAttr = new BufferAttribute(col, 3).setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);
    const mat = new PointsMaterial({
      map: makeGlintTexture(),
      vertexColors: true,
      size: 2.6,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geo, mat, pos, col, posAttr, colAttr };
  }, []);

  // ── Rebuild fleet + links on satCount change ─────────────────────────────
  // network.sats is the live source of truth. We only regenerate the Walker
  // layout when the count actually differs (a launch grows network.sats to the
  // new count first, so syncing the slider afterward just rebuilds links —
  // preserving the freshly-deployed ring instead of popping it).
  useEffect(() => {
    if (network.sats.length !== satCount) {
      network.sats = buildWalkerConstellation(satCount).sats;
    }
    const n = network.sats.length;

    const { pairs, adj } = buildLinks(network.sats);
    network.count = n;
    network.pairs = pairs;
    network.adj = adj;
    telemetry.count = n;

    for (const m of [busRef, wingLRef, wingRRef, radFRef, radBRef]) {
      if (m.current) m.current.count = n;
    }
    glint.geo.setDrawRange(0, n);

    const st = useSimStore.getState();
    if (st.chaseIdx >= n) st.setChaseIdx(0);
    st.setSelectedIdx(-1);
  }, [satCount, glint]);

  // ── One-time: dynamic usage + pre-seed wing instanceColor ────────────────
  useEffect(() => {
    network.glintPoints = glintRef.current;
    network.wingMaterial = wingMat;
    for (const m of [busRef, wingLRef, wingRRef, radFRef, radBRef]) {
      m.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    }
    for (const ref of [wingLRef, wingRRef]) {
      const m = ref.current;
      if (!m) continue;
      for (let i = 0; i < MAX; i++) m.setColorAt(i, _white);
      if (m.instanceColor) {
        m.instanceColor.setUsage(DynamicDrawUsage);
        m.instanceColor.needsUpdate = true;
      }
    }
  }, []);

  // ── Per-frame simulation ─────────────────────────────────────────────────
  useFrame((_, dt) => {
    const sats = network.sats;
    const n = sats.length;
    const bus = busRef.current;
    const wl = wingLRef.current;
    const wr = wingRRef.current;
    const rf = radFRef.current;
    const rb = radBRef.current;
    if (!n || !bus || !wl || !wr || !rf || !rb) return;

    // counts can grow mid-flight as a launch appends sats to network.sats
    if (bus.count !== n) {
      bus.count = wl.count = wr.count = rf.count = rb.count = n;
      glint.geo.setDrawRange(0, n);
    }
    telemetry.count = n;

    const st = useSimStore.getState();
    const w = st.timeWarp / NOMINAL_WARP;
    const sdt = st.paused ? 0 : dt; // sim delta freezes under pause
    // In inspect mode the detailed hero replaces this index — shrink the
    // instanced twin to epsilon (keep buffer layout stable, restores next frame
    // automatically when leaving inspect).
    const hideIdx = st.viewMode === 'inspect' ? st.chaseIdx : -1;
    const thermal = st.thermal;
    telemetry.simT += sdt * w;
    const t = telemetry.simT;

    // radiators are the emission surface — hottest in IR, white radiator otherwise
    if (thermal) {
      const hot = thermalColor(0.97);
      _radHot.setRGB(hot[0], hot[1], hot[2]);
      const em = thermalColor(0.85);
      _radEmis.setRGB(em[0], em[1], em[2]);
      radMat.color.copy(_radHot);
      radMat.emissive.copy(_radEmis);
      radMat.emissiveIntensity = 0.9;
    } else if (radMat.emissiveIntensity !== 0) {
      radMat.color.set(SCENE_COLORS.satRadiator);
      radMat.emissive.setRGB(0, 0, 0);
      radMat.emissiveIntensity = 0;
    }

    // storm timer runs on REAL dt (expires even while paused)
    if (storm.active) {
      storm.t += dt;
      if (storm.t >= storm.dur) {
        storm.active = false;
        toast('CME PASSED — FLEET NOMINAL · COMPUTE RESTORED');
      }
    }
    const stormOn = storm.active;
    const sdx = storm.dir.x;
    const sdy = storm.dir.y;
    const sdz = storm.dir.z;

    const posArr = glint.pos;
    const colArr = glint.col;
    let sunlit = 0;

    for (let i = 0; i < n; i++) {
      const s = sats[i];
      if (!s) continue;

      // Deorbit physics decay
      if (s.deorbiting && !s.burned) {
        // Decay orbital radius towards Earth's surface (EARTH_R = 5.0)
        s.r -= sdt * w * 0.08;
        if (s.r <= EARTH_R + 0.1) {
          s.r = EARTH_R;
          s.burned = true;
          s.deorbiting = false;
          toast(`⚠ DEORBIT COMPLETE — SAT-${i} BURNED UP IN ATMOSPHERE`);
          
          // Sever connections
          const { pairs, adj } = buildLinks(sats);
          network.pairs = pairs;
          network.adj = adj;

          // Reset selection / chase view
          if (st.selectedIdx === i) {
            st.setSelectedIdx(-1);
            if (st.viewMode === 'chase' || st.viewMode === 'inspect') {
              st.setViewMode('overview');
            }
          }
        }
      }

      if (s.burned) {
        // Zero out coordinates/glints
        posArr[i * 3 + 0] = 0;
        posArr[i * 3 + 1] = 0;
        posArr[i * 3 + 2] = 0;
        colArr[i * 3 + 0] = 0;
        colArr[i * 3 + 1] = 0;
        colArr[i * 3 + 2] = 0;
        // Scale to 0 to hide instanced models
        _part.makeScale(0, 0, 0);
        bus.setMatrixAt(i, _part);
        wl.setMatrixAt(i, _part);
        wr.setMatrixAt(i, _part);
        rf.setMatrixAt(i, _part);
        rb.setMatrixAt(i, _part);
        continue;
      }

      angleToPos(satAngle(s, t), s.raan, s.inc, s.r, _angle);
      _pos.set(_angle[0]!, _angle[1]!, _angle[2]!);

      // deployment blend (dormant until Phase 4 sets deployT/deployFrom)
      let scaleMul = 1;
      if (s.deployT !== undefined && s.deployFrom) {
        s.deployT += sdt * w * 0.25;
        if (s.deployT >= 1) {
          s.deployT = undefined;
          s.deployFrom = undefined;
        } else {
          const e = easeCubic(s.deployT);
          _pos.set(
            lerp(s.deployFrom[0], _pos.x, e),
            lerp(s.deployFrom[1], _pos.y, e),
            lerp(s.deployFrom[2], _pos.z, e),
          );
          scaleMul = 0.25 + 0.75 * e;
        }
      }

      // telemetry world position
      telemetry.satWorld[i * 3 + 0] = _pos.x;
      telemetry.satWorld[i * 3 + 1] = _pos.y;
      telemetry.satWorld[i * 3 + 2] = _pos.z;

      // eclipse (inlined zero-alloc cylindrical test; matches sim/eclipse.ts)
      const lenSq = _pos.lengthSq();
      let ecl = false;
      const along = _pos.x * _sun.x + _pos.y * _sun.y + _pos.z * _sun.z;
      if (along < 0) {
        const perpSq = lenSq - along * along;
        ecl = perpSq < EARTH_R * EARTH_R;
      }
      // storm-hit: inside the CME-facing cone (dot(pos,dir)/|pos| > 0.45)
      let stormHit = false;
      if (stormOn) {
        const len = Math.sqrt(lenSq) || 1;
        stormHit = (_pos.x * sdx + _pos.y * sdy + _pos.z * sdz) / len > 0.45;
      }
      telemetry.eclipsed[i] = ecl ? 1 : 0;
      telemetry.stormHit[i] = stormHit ? 1 : 0;
      // either condition excludes from the sunlit count (no double-subtract)
      if (!ecl && !stormHit) sunlit++;

      // orientation basis: z = radial, x = sun projected onto tangent plane
      _z.copy(_pos).normalize();
      const d = _sun.dot(_z);
      _x.copy(_sun).addScaledVector(_z, -d);
      if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
      else _x.normalize();
      _y.copy(_z).cross(_x);

      if (i === hideIdx) scaleMul = 0.0001; // hide twin under the hero

      _base.makeBasis(_x, _y, _z);
      _scaleV.setScalar(SAT_SCALE * scaleMul);
      _base.scale(_scaleV);
      _base.setPosition(_pos);

      _part.multiplyMatrices(_base, OFF_BUS);
      bus.setMatrixAt(i, _part);
      _part.multiplyMatrices(_base, OFF_WL);
      wl.setMatrixAt(i, _part);
      _part.multiplyMatrices(_base, OFF_WR);
      wr.setMatrixAt(i, _part);
      _part.multiplyMatrices(_base, OFF_RF);
      rf.setMatrixAt(i, _part);
      _part.multiplyMatrices(_base, OFF_RB);
      rb.setMatrixAt(i, _part);

      // wing dimming + glint color (thermal > storm > eclipse > sunlit)
      let gc = _glintBright;
      if (thermal) {
        // temperature score with ~2 s thermal lag (re-heat on shadow exit)
        const load = stormHit ? 0.3 : ecl ? 0.07 : 1.0;
        const sun = ecl ? 0.05 : 1.0;
        const tT = 0.75 * load + 0.25 * sun;
        const prev = thermalLag[i]!;
        const cur = prev + (tT - prev) * (1 - Math.exp(-dt / 0.7));
        thermalLag[i] = cur;
        const c = thermalColor(cur);
        _wingCol.setRGB(c[0], c[1], c[2]);
        _irGlint.setRGB(Math.min(1, c[0] * 1.25), Math.min(1, c[1] * 1.25), Math.min(1, c[2] * 1.25));
        gc = _irGlint;
      } else if (stormHit) {
        // flicker wings slate↔burnt-orange; glint dim orange
        _wingCol.copy(Math.random() < 0.5 ? _eclipseCol : _stormOrange);
        const r = 0.2 + Math.random() * 0.5;
        _stormGlint.setRGB(r, r * 0.45, r * 0.2);
        gc = _stormGlint;
      } else if (ecl) {
        _wingCol.copy(_eclipseCol);
        gc = _glintDim;
      } else {
        _wingCol.copy(_white);
        gc = _glintBright;
      }
      wl.setColorAt(i, _wingCol);
      wr.setColorAt(i, _wingCol);

      posArr[i * 3 + 0] = _pos.x;
      posArr[i * 3 + 1] = _pos.y;
      posArr[i * 3 + 2] = _pos.z;
      colArr[i * 3 + 0] = gc.r;
      colArr[i * 3 + 1] = gc.g;
      colArr[i * 3 + 2] = gc.b;
    }

    bus.instanceMatrix.needsUpdate = true;
    wl.instanceMatrix.needsUpdate = true;
    wr.instanceMatrix.needsUpdate = true;
    rf.instanceMatrix.needsUpdate = true;
    rb.instanceMatrix.needsUpdate = true;
    if (wl.instanceColor) wl.instanceColor.needsUpdate = true;
    if (wr.instanceColor) wr.instanceColor.needsUpdate = true;
    glint.posAttr.needsUpdate = true;
    glint.colAttr.needsUpdate = true;

    telemetry.sunlitFrac = n > 0 ? sunlit / n : 1;
  });

  return (
    <group>
      <instancedMesh ref={busRef} args={[busGeo, busMat, MAX]} frustumCulled={false} />
      <instancedMesh ref={wingLRef} args={[wingGeo, wingMat, MAX]} frustumCulled={false} />
      <instancedMesh ref={wingRRef} args={[wingGeo, wingMat, MAX]} frustumCulled={false} />
      <instancedMesh ref={radFRef} args={[radGeo, radMat, MAX]} frustumCulled={false} />
      <instancedMesh ref={radBRef} args={[radGeo, radMat, MAX]} frustumCulled={false} />
      <points ref={glintRef} args={[glint.geo, glint.mat]} frustumCulled={false} />
    </group>
  );
}
