import { Vector3 } from 'three';
import { SCENE } from './constants';
import { latLonToVec } from './geo';
import { earthGroupRef } from '../state/world';

/** Ground stations (shared by Downlink and JobRouter). */
export const STATIONS = [
  { name: 'BASTROP', lat: 30, lon: -97 },
  { name: 'YORK', lat: 53.9, lon: -1.1 },
  { name: 'SYD', lat: -33.9, lon: 151.2 },
  { name: 'TYO', lat: 35.7, lon: 139.7 },
] as const;

export const STATION_COUNT = STATIONS.length;
const STATION_R = SCENE.EARTH_R * 1.005;
const locals = STATIONS.map((s) => latLonToVec(s.lat, s.lon, STATION_R));

/** World position of station i (rotates with the Earth group). */
export function stationWorld(i: number, out: Vector3): Vector3 {
  out.copy(locals[i]!);
  const earth = earthGroupRef.current;
  if (earth) earth.localToWorld(out);
  return out;
}
