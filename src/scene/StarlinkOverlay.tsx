import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Points,
  PointsMaterial,
} from 'three';
import type { SatRec } from 'satellite.js';
import { parseTle, propagateChunk, TLE_CAP } from '../sim/tle';
import { toast } from '../lib/bus';
import { earthGroupRef } from '../state/world';
import { useSimStore } from '../state/sim';
import { starlink } from '../state/starlink';

const CHUNK = 500; // sats propagated per frame (round-robin) — keeps the frame budget

export function StarlinkOverlay() {
  const on = useSimStore((s) => s.toggles.starlink);
  const pointsRef = useRef<Points>(null);
  const recsRef = useRef<SatRec[]>([]);
  const cursor = useRef(0);
  const announced = useRef(false);

  const geom = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(TLE_CAP * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new PointsMaterial({
        color: '#cfd6dc',
        size: 1.4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  // load TLE + meta once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tleRes, metaRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/starlink.tle`),
          fetch(`${import.meta.env.BASE_URL}data/starlink.meta.json`),
        ]);
        if (!alive || !tleRes.ok) return;
        const recs = parseTle(await tleRes.text());
        recsRef.current = recs;
        starlink.loaded = true;
        starlink.count = recs.length;
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { fetched?: string };
          if (meta.fetched) {
            starlink.ageHours = Math.max(0, (Date.now() - Date.parse(meta.fetched)) / 3.6e6);
          }
        }
        geom.setDrawRange(0, recs.length);
      } catch {
        /* overlay stays empty */
      }
    })();
    return () => {
      alive = false;
    };
  }, [geom]);

  useFrame(() => {
    if (!useSimStore.getState().toggles.starlink) return;
    const recs = recsRef.current;
    if (!recs.length) return;

    if (!announced.current) {
      announced.current = true;
      toast(`LIVE STARLINK ELEMENTS — ${recs.length} OBJECTS · CELESTRAK`);
    }

    const pts = pointsRef.current;
    if (!pts) return;
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const yaw = earthGroupRef.current?.rotation.y ?? 0;
    // round-robin propagate a chunk per frame into the persistent buffer
    cursor.current = propagateChunk(recs, new Date(), arr, cursor.current, CHUNK, yaw);
    attr.needsUpdate = true;
  });

  return <points ref={pointsRef} args={[geom, mat]} visible={on} frustumCulled={false} />;
}
