import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { SCENE_COLORS } from '../lib/constants';
import { radialTexture } from '../lib/glow';
import { stationWorld, STATION_COUNT } from '../lib/stations';
import { greedyRoute } from '../sim/links';
import type { Vec3 } from '../sim/constellation';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { on, toast } from '../lib/bus';
import { useSimStore } from '../state/sim';

const KM_PER_UNIT = 63.71; // 1 scene unit = 63.71 km
const C_KM_S = 299792; // speed of light, km/s
const SEG_DUR = 0.2; // seconds per hop
const MAX_NODES = 64;

type Node = { station: number } | { sat: number };
type Job = {
  nodes: Node[];
  satCount: number; // # of sat nodes (for laser-hop count)
  elapsed: number;
  done: boolean;
  fade: number; // 1 → 0 after completion
  n: number;
};

const _a = new Vector3();
const _b = new Vector3();
let jobCounter = 0;

function nodeWorld(node: Node, out: Vector3) {
  if ('station' in node) {
    stationWorld(node.station, out);
  } else {
    const sw = telemetry.satWorld;
    const i = node.sat;
    out.set(sw[i * 3] ?? 0, sw[i * 3 + 1] ?? 0, sw[i * 3 + 2] ?? 0);
  }
}

export function JobRouter() {
  const jobRef = useRef<Job | null>(null);
  const setJobBusy = useSimStore((s) => s.setJobBusy);

  const line = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(MAX_NODES * 3), 3));
    geo.setDrawRange(0, 0);
    const mat = new LineBasicMaterial({
      color: SCENE_COLORS.downlink,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return new Line(geo, mat);
  }, []);

  const glow = useMemo(() => {
    const s = new Sprite(
      new SpriteMaterial({
        map: radialTexture([
          [0, 'rgba(255,250,230,1)'],
          [0.4, 'rgba(255,190,90,0.8)'],
          [1, 'rgba(255,180,80,0)'],
        ]),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    s.scale.setScalar(6);
    s.visible = false;
    return s;
  }, []);

  // ── start a job ──
  useEffect(() => {
    return on('job:run', () => {
      const st = useSimStore.getState();
      if (st.jobBusy) return;
      const count = telemetry.count;
      if (count < 2 || network.adj.length < count) return;

      // two distinct random stations
      const a = (Math.random() * STATION_COUNT) | 0;
      let b = (Math.random() * STATION_COUNT) | 0;
      if (b === a) b = (b + 1) % STATION_COUNT;
      stationWorld(a, _a);
      stationWorld(b, _b);

      // nearest sat to A
      const sw = telemetry.satWorld;
      let start = 0;
      let bestD = Infinity;
      for (let i = 0; i < count; i++) {
        const dx = sw[i * 3]! - _a.x;
        const dy = sw[i * 3 + 1]! - _a.y;
        const dz = sw[i * 3 + 2]! - _a.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) {
          bestD = d;
          start = i;
        }
      }

      const target: Vec3 = [_b.x, _b.y, _b.z];
      const acc = (i: number): Vec3 => [sw[i * 3]!, sw[i * 3 + 1]!, sw[i * 3 + 2]!];
      const route = greedyRoute(network.adj, acc, start, target, 26);

      const nodes: Node[] = [{ station: a }, ...route.map((s) => ({ sat: s })), { station: b }];
      jobRef.current = {
        nodes: nodes.slice(0, MAX_NODES),
        satCount: route.length,
        elapsed: 0,
        done: false,
        fade: 1,
        n: ++jobCounter,
      };
      setJobBusy(true);
      glow.visible = true;
    });
  }, [setJobBusy, glow]);

  useFrame((_, dt) => {
    const job = jobRef.current;
    const posAttr = line.geometry.getAttribute('position') as BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const st = useSimStore.getState();
    if (!st.jobBusy && job) {
      jobRef.current = null;
      glow.visible = false;
      (line.material as LineBasicMaterial).opacity = 0;
      line.geometry.setDrawRange(0, 0);
      return;
    }

    if (!job) {
      if ((line.material as LineBasicMaterial).opacity > 0) {
        (line.material as LineBasicMaterial).opacity = 0;
        line.geometry.setDrawRange(0, 0);
      }
      return;
    }

    const nodes = job.nodes;
    const segs = nodes.length - 1;

    // redraw the whole path from LIVE positions (bends as sats move)
    for (let i = 0; i < nodes.length; i++) {
      nodeWorld(nodes[i]!, _a);
      arr[i * 3 + 0] = _a.x;
      arr[i * 3 + 1] = _a.y;
      arr[i * 3 + 2] = _a.z;
    }
    posAttr.needsUpdate = true;
    line.geometry.setDrawRange(0, nodes.length);

    const sdt = useSimStore.getState().paused ? 0 : dt;
    if (!job.done) {
      job.elapsed += sdt;
      const seg = Math.floor(job.elapsed / SEG_DUR);
      (line.material as LineBasicMaterial).opacity = 0.75;

      if (seg >= segs) {
        // arrived → measure + report
        let km = 0;
        for (let i = 0; i < segs; i++) {
          nodeWorld(nodes[i]!, _a);
          nodeWorld(nodes[i + 1]!, _b);
          km += _a.distanceTo(_b) * KM_PER_UNIT;
        }
        const hops = Math.max(0, job.satCount - 1);
        const latency = (km / C_KM_S) * 1000 + 0.5 * segs;
        toast(
          `JOB #${job.n} COMPLETE — ${hops} LASER HOPS · ${Math.round(km).toLocaleString('en-US')} KM · ~${latency.toFixed(0)} MS`,
        );
        telemetry.jobsDone++;
        job.done = true;
        glow.visible = false;
      } else {
        // advance glow along the active segment
        const local = (job.elapsed % SEG_DUR) / SEG_DUR;
        nodeWorld(nodes[seg]!, _a);
        nodeWorld(nodes[seg + 1]!, _b);
        glow.position.lerpVectors(_a, _b, local);
        glow.visible = true;
      }
    } else {
      // fade out over ~1.2 s
      job.fade -= sdt / 1.2;
      (line.material as LineBasicMaterial).opacity = Math.max(0, 0.75 * job.fade);
      if (job.fade <= 0) {
        jobRef.current = null;
        useSimStore.getState().setJobBusy(false);
        line.geometry.setDrawRange(0, 0);
      }
    }
  });

  return (
    <>
      <primitive object={line} frustumCulled={false} />
      <primitive object={glow} />
    </>
  );
}
