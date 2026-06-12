// Typed content for the Info modal. NO JSX here — pure data. Every physical
// number is derived from constants.ts (never hardcoded).

import {
  EARTH_RADIUS_KM,
  INCLINATION_DEG,
  ORBITAL_V_KMS,
  ORBIT_ALT_KM,
  PERIOD_MIN,
  PROGRAM_FACTS,
  RADIATOR_M2,
  SAT_KW_AVG,
  SAT_KW_PEAK,
  SAT_TONS,
  SOLAR_KW,
  STACK_HEIGHT_M,
  WINGSPAN_M,
} from './constants';

export const INFO_FOOTER =
  'Hobby project — an unofficial, fan-made imagining of the future. Details are gathered from public social-media announcements and may be inaccurate. Not affiliated with, endorsed by, or representing SpaceX or xAI; all names and marks belong to their owners.';

export const DISCLAIMER =
  'Just a fun project picturing how the future might look. Specs are pulled from social-media posts and could be wrong.';

export const MISSION_PARAS: string[] = [
  'AI1 is SpaceX’s planned constellation of orbital data-center satellites — solar-powered GPU racks in sun-synchronous orbit, meshed by laser inter-satellite links and running xAI compute. This is an interactive, real-time visualization of how such a system might look and behave.',
  `The simulation models the real physics faithfully: sun-synchronous orbital mechanics at ${INCLINATION_DEG}° inclination, cylindrical-shadow eclipse transitions, the Starship ascent and Pez deployment profile, and laser-mesh routing between satellites.`,
  `Some figures are illustrative rather than measured: inference token throughput, per-satellite compute-load percentages, and the on-screen satellite scale (exaggerated so a ${WINGSPAN_M} m spacecraft is visible against a planet ${EARTH_RADIUS_KM.toLocaleString('en-US')} km in radius).`,
];

export type Spec = { label: string; value: string };

export const VEHICLE_SPECS: Spec[] = [
  { label: 'Deployed wingspan', value: `${WINGSPAN_M} m` },
  { label: 'Compute payload', value: `${SAT_KW_AVG} / ${SAT_KW_PEAK} kW (avg / peak)` },
  { label: 'Power density', value: `${Math.round(SAT_KW_PEAK / SAT_TONS)} kW/ton` },
  { label: 'Mass per satellite', value: `≈ ${SAT_TONS.toFixed(2)} t` },
  { label: 'Solar array', value: `~${SOLAR_KW} kW` },
  { label: 'Radiators', value: `up to ${RADIATOR_M2} m²` },
  { label: 'Orbit altitude', value: `~${ORBIT_ALT_KM} km` },
  { label: 'Inclination', value: `${INCLINATION_DEG}° (retrograde SSO)` },
  { label: 'Orbital velocity', value: `${ORBITAL_V_KMS} km/s` },
  { label: 'Orbital period', value: `${PERIOD_MIN} min` },
  { label: 'Backhaul', value: 'Laser inter-satellite links' },
  { label: 'Payload', value: 'Swappable · GB300 / Rubin' },
  { label: 'Launch vehicle', value: `Starship V3 · ${STACK_HEIGHT_M} m stack` },
];

export const PROGRAM: readonly string[] = PROGRAM_FACTS;

export type Explainer = { title: string; body: string };

export const HOW_IT_WORKS: Explainer[] = [
  {
    title: 'Why dawn–dusk sun-synchronous orbit',
    body: 'A sun-synchronous orbit crossing the terminator keeps the satellites in near-continuous sunlight, so the solar arrays generate power almost all the time. That minimizes battery mass and maximizes the duty cycle of the compute payload — critical when the whole point is running GPUs.',
  },
  {
    title: 'Why such large radiators',
    body: `In vacuum there is no air or water to carry heat away — the only path is infrared radiation to deep space. Rejecting ${SAT_KW_AVG}+ kW of GPU heat that way needs a lot of area, hence liquid-cooled radiator panels up to ${RADIATOR_M2} m² with redundant pump loops.`,
  },
  {
    title: 'Why laser inter-satellite links',
    body: 'Optical links need no spectrum licensing, do not interfere with ground users, and carry terabits per second per link. A mesh of them lets the constellation route jobs and results around the globe without depending on a dense network of ground stations.',
  },
  {
    title: 'Why Pez-style deployment',
    body: 'Starship’s payload bay dispenses flat-packed satellites one after another like a Pez dispenser, the same mechanism used for Starlink. Each satellite is released into the same orbital plane and then fans out to its slot.',
  },
];

export type DataSource = { asset: string; res: string; source: string };

export const DATA_SOURCES: DataSource[] = [
  { asset: 'Day surface (Blue Marble albedo)', res: '8K', source: 'NASA-derived · franky-adl/threejs-earth' },
  { asset: 'Night city lights', res: '16K', source: 'NASA-derived · franky-adl/threejs-earth' },
  { asset: 'Topography (bump)', res: '10K', source: 'NASA-derived · franky-adl/threejs-earth' },
  { asset: 'Cloud + ocean masks', res: '4K', source: 'franky-adl/threejs-earth' },
  { asset: 'All-sky Milky Way', res: '8K', source: 'ESA Gaia DR3' },
  { asset: 'Moon map', res: '4K', source: 'CoryG89/MoonDemo' },
  { asset: 'Live Starlink orbital elements', res: 'TLE', source: 'CelesTrak (fetched at build time)' },
];

export const DATA_NOTE =
  'All imagery is fetched at build time into /textures and cached; the app also renders with procedural fallbacks if assets are unavailable.';
