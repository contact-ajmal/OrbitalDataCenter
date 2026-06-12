import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  type LineSegments,
  LineBasicMaterial,
} from 'three';
import { SCENE, SCENE_COLORS } from '../lib/constants';
import { angleToPos } from '../sim/constellation';
import { network } from '../state/network';
import { useSimStore } from '../state/sim';

const SEGS = 128;
const MAX_PLANES = 64;
const CAP = MAX_PLANES * SEGS * 2 * 3;

export function OrbitRings() {
  const orbits = useSimStore((s) => s.toggles.orbits);
  const satCount = useSimStore((s) => s.satCount);
  const ringsRef = useRef<LineSegments>(null);

  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(CAP), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new LineBasicMaterial({
        color: SCENE_COLORS.orbitRing,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  );

  // Rebuild one ring per distinct orbital plane whenever the fleet changes.
  useEffect(() => {
    const arr = (geo.getAttribute('position') as BufferAttribute).array as Float32Array;
    const seen = new Map<number, { raan: number; inc: number }>();
    for (const s of network.sats) {
      if (!seen.has(s.plane)) seen.set(s.plane, { raan: s.raan, inc: s.inc });
    }
    const out: number[] = [0, 0, 0];
    let o = 0;
    let planes = 0;
    for (const { raan, inc } of seen.values()) {
      if (planes >= MAX_PLANES) break;
      planes++;
      let px = 0;
      let py = 0;
      let pz = 0;
      for (let k = 0; k <= SEGS; k++) {
        // representative orbit radius (un-jittered)
        angleToPos((k / SEGS) * 2 * Math.PI, raan, inc, SCENE.ORBIT_R, out);
        if (k > 0 && o + 6 <= CAP) {
          arr[o++] = px;
          arr[o++] = py;
          arr[o++] = pz;
          arr[o++] = out[0]!;
          arr[o++] = out[1]!;
          arr[o++] = out[2]!;
        }
        px = out[0]!;
        py = out[1]!;
        pz = out[2]!;
      }
    }
    (geo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    geo.setDrawRange(0, o / 3);
  }, [satCount, geo]);

  return <lineSegments ref={ringsRef} args={[geo, mat]} visible={orbits} frustumCulled={false} />;
}
