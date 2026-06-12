import { Vector3 } from 'three';

/** Latitude/longitude (degrees) → a position on a sphere of radius r.
 * Earth axis = +Y, equator = x–z plane (matches the orbital convention). */
export function latLonToVec(lat: number, lon: number, r: number): Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new Vector3(
    r * Math.cos(la) * Math.cos(lo),
    r * Math.sin(la),
    -r * Math.cos(la) * Math.sin(lo),
  );
}
