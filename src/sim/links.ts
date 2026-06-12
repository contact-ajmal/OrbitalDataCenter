// Laser inter-satellite mesh topology + greedy geographic routing.
// Pure TS, unit-tested in links.test.ts.

import type { Sat, Vec3 } from './constellation';

export type Links = { pairs: [number, number][]; adj: number[][] };

/**
 * Build the laser mesh:
 *  - in-plane ring chains (each satellite links its slot neighbours, wrapping),
 *  - cross-plane ladder rungs every ~per/10 slots to the nearest-slot satellite
 *    in the next plane.
 */
export function buildLinks(sats: Sat[]): Links {
  const n = sats.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const pairs: [number, number][] = [];
  const seen = new Set<number>(); // de-dupe undirected edges via packed key

  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? a * n + b : b * n + a;
    if (seen.has(key)) return;
    seen.add(key);
    adj[a]!.push(b);
    adj[b]!.push(a);
    pairs.push([a, b]);
  };

  // group satellite indices by plane, sorted by slot
  const byPlane = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const plane = sats[i]!.plane;
    let arr = byPlane.get(plane);
    if (!arr) {
      arr = [];
      byPlane.set(plane, arr);
    }
    arr.push(i);
  }
  for (const arr of byPlane.values()) arr.sort((a, b) => sats[a]!.slot - sats[b]!.slot);

  // in-plane ring
  for (const arr of byPlane.values()) {
    const m = arr.length;
    for (let k = 0; k < m; k++) addEdge(arr[k]!, arr[(k + 1) % m]!);
  }

  // cross-plane ladder
  const planeKeys = [...byPlane.keys()].sort((a, b) => a - b);
  for (let pi = 0; pi < planeKeys.length; pi++) {
    const cur = byPlane.get(planeKeys[pi]!)!;
    const next = byPlane.get(planeKeys[(pi + 1) % planeKeys.length]!)!;
    if (next === cur) continue; // single-plane edge case
    const per = cur.length;
    const step = Math.max(1, Math.round(per / 10));
    for (let k = 0; k < per; k += step) {
      const a = cur[k]!;
      const slot = sats[a]!.slot;
      // nearest-slot satellite in the next plane
      let best = next[0]!;
      let bestD = Infinity;
      for (const j of next) {
        const d = Math.abs(sats[j]!.slot - slot);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      addEdge(a, best);
    }
  }

  return { pairs, adj };
}

/**
 * Greedy geographic route from startIdx toward a 3D target.
 * At each hop move to the unvisited neighbour nearest the target; stop when no
 * neighbour improves the distance, or maxHops is reached.
 * Every consecutive pair in the returned path is an edge in `adj`.
 */
export function greedyRoute(
  adj: number[][],
  posAccessor: (i: number) => Vec3,
  startIdx: number,
  target: Vec3,
  maxHops = 26,
): number[] {
  const d2 = (i: number) => {
    const p = posAccessor(i);
    const dx = p[0] - target[0];
    const dy = p[1] - target[1];
    const dz = p[2] - target[2];
    return dx * dx + dy * dy + dz * dz;
  };

  const path = [startIdx];
  const visited = new Set<number>([startIdx]);
  let cur = startIdx;
  let curD = d2(cur);

  for (let hop = 0; hop < maxHops; hop++) {
    let best = -1;
    let bestD = curD;
    for (const nb of adj[cur] ?? []) {
      if (visited.has(nb)) continue;
      const d = d2(nb);
      if (d < bestD) {
        bestD = d;
        best = nb;
      }
    }
    if (best === -1) break; // no improvement → done
    path.push(best);
    visited.add(best);
    cur = best;
    curD = bestD;
  }

  return path;
}
