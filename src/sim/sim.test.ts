import { describe, it, expect } from 'vitest';
import {
  buildWalkerConstellation,
  angleToPos,
  satAngle,
  planeRaanOverPoint,
  type Vec3,
} from './constellation';
import { isEclipsed } from './eclipse';
import { buildLinks, greedyRoute } from './links';
import { INCLINATION_DEG, SCENE } from '../lib/constants';

const INC = (INCLINATION_DEG * Math.PI) / 180;
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

describe('constellation geometry', () => {
  it('positions stay on the sphere of radius r (±1e-9)', () => {
    const out: number[] = [0, 0, 0];
    for (let i = 0; i < 500; i++) {
      const r = rand(80, 130);
      const a = rand(-10, 10);
      const raan = rand(0, 2 * Math.PI);
      angleToPos(a, raan, INC, r, out);
      const len = Math.hypot(out[0]!, out[1]!, out[2]!);
      expect(Math.abs(len - r)).toBeLessThan(1e-9);
    }
  });

  it('max |y|/r over an orbit ≈ sin(82.4°) within 1%', () => {
    const out: number[] = [0, 0, 0];
    const r = SCENE.ORBIT_R;
    const raan = 1.234;
    let maxYr = 0;
    for (let k = 0; k < 4000; k++) {
      const a = (k / 4000) * 2 * Math.PI;
      angleToPos(a, raan, INC, r, out);
      maxYr = Math.max(maxYr, Math.abs(out[1]!) / r);
    }
    const expected = Math.sin((82.4 * Math.PI) / 180); // = sin(97.6°)
    expect(Math.abs(maxYr - expected) / expected).toBeLessThan(0.01);
  });

  it('builds a sane Walker constellation (plane count + radius jitter)', () => {
    const { sats, planes } = buildWalkerConstellation(2400);
    expect(planes).toBeGreaterThanOrEqual(6);
    expect(planes).toBeLessThanOrEqual(24);
    expect(sats).toHaveLength(2400);
    for (const s of sats) {
      expect(Math.abs(s.r - SCENE.ORBIT_R)).toBeLessThanOrEqual(0.25 + 1e-9);
      expect(s.inc).toBeCloseTo(INC, 9);
    }
  });

  it('satAngle advances at ANGULAR_RATE', () => {
    const { sats } = buildWalkerConstellation(300);
    const s = sats[0]!;
    expect(satAngle(s, 0)).toBeCloseTo(s.phase, 12);
    expect(satAngle(s, 10) - satAngle(s, 0)).toBeCloseTo(1.0, 12); // 10 * 0.10
  });
});

describe('planeRaanOverPoint', () => {
  it('returns a plane that passes through random surface points (|lat|<80°)', () => {
    const r = SCENE.ORBIT_R;
    for (let i = 0; i < 20; i++) {
      // random direction with bounded latitude
      const lat = rand(-80, 80) * (Math.PI / 180);
      const lon = rand(0, 2 * Math.PI);
      const P: Vec3 = [
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon),
      ];
      const raan = planeRaanOverPoint(P, INC);
      // reconstruct plane normal n = (sinI sinθ, cosI, sinI cosθ)
      const n: Vec3 = [
        Math.sin(INC) * Math.sin(raan),
        Math.cos(INC),
        Math.sin(INC) * Math.cos(raan),
      ];
      const dot = n[0] * P[0] + n[1] * P[1] + n[2] * P[2];
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    }
  });
});

describe('isEclipsed (cylindrical shadow)', () => {
  const earthR = SCENE.EARTH_R;
  const sun: Vec3 = [1, 0.18, 0.35];

  it('point directly behind Earth is eclipsed', () => {
    const sl = Math.hypot(sun[0], sun[1], sun[2]);
    const behind: Vec3 = [(-sun[0] / sl) * 110, (-sun[1] / sl) * 110, (-sun[2] / sl) * 110];
    expect(isEclipsed(behind, sun, earthR)).toBe(true);
  });

  it('sunward point is not eclipsed', () => {
    const sl = Math.hypot(sun[0], sun[1], sun[2]);
    const front: Vec3 = [(sun[0] / sl) * 110, (sun[1] / sl) * 110, (sun[2] / sl) * 110];
    expect(isEclipsed(front, sun, earthR)).toBe(false);
  });

  it('behind but outside the cylinder radius is not eclipsed', () => {
    // start behind, then offset perpendicular to the sun by > earthR
    const sl = Math.hypot(sun[0], sun[1], sun[2]);
    const sHat: Vec3 = [sun[0] / sl, sun[1] / sl, sun[2] / sl];
    // a vector perpendicular to sHat
    const perp: Vec3 = [-sHat[1], sHat[0], 0];
    const pl = Math.hypot(perp[0], perp[1], perp[2]);
    const off = earthR * 1.5;
    const p: Vec3 = [
      -sHat[0] * 110 + (perp[0] / pl) * off,
      -sHat[1] * 110 + (perp[1] / pl) * off,
      -sHat[2] * 110 + (perp[2] / pl) * off,
    ];
    expect(isEclipsed(p, sun, earthR)).toBe(false);
  });
});

describe('links + routing', () => {
  it('greedyRoute returns a connected path (each pair ∈ adj)', () => {
    const { sats } = buildWalkerConstellation(1200);
    const { adj } = buildLinks(sats);

    // position accessor at a fixed time
    const t = 3.7;
    const tmp: number[] = [0, 0, 0];
    const posAccessor = (i: number): Vec3 => {
      const s = sats[i]!;
      angleToPos(satAngle(s, t), s.raan, s.inc, s.r, tmp);
      return [tmp[0]!, tmp[1]!, tmp[2]!];
    };

    // target = somewhere on the far side of the shell
    const target: Vec3 = [-SCENE.ORBIT_R, 20, SCENE.ORBIT_R * 0.3];
    const start = 0;
    const path = greedyRoute(adj, posAccessor, start, target, 26);

    expect(path[0]).toBe(start);
    expect(path.length).toBeGreaterThan(1); // it should move at least once
    for (let k = 0; k + 1 < path.length; k++) {
      const a = path[k]!;
      const b = path[k + 1]!;
      expect(adj[a]!).toContain(b);
    }
  });

  it('mesh is symmetric (undirected adjacency)', () => {
    const { sats } = buildWalkerConstellation(600);
    const { adj, pairs } = buildLinks(sats);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, b] of pairs) {
      expect(adj[a]!).toContain(b);
      expect(adj[b]!).toContain(a);
    }
  });
});
