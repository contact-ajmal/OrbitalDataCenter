# AI1 Orbital Sim — Working Agreements

- Stack: Vite + React 19 + TS, R3F v9, drei, @react-three/postprocessing, zustand, Tailwind v4.
- `src/sim` is PURE TypeScript (no React, no three imports except math types from three).
  All orbital math, eclipse tests, routing live here and are unit-testable.
  (Enforced by an eslint `no-restricted-imports` rule on `src/sim/**`.)
- Per-frame mutation happens in `useFrame` via refs and preallocated `Float32Array`s.
  NEVER `setState` inside `useFrame`. Zustand stores hold config/UI state only;
  high-frequency telemetry flows through a mutable singleton (`src/state/telemetry.ts`).
- All colors/typography come from Tailwind `@theme` tokens. No hex literals in TSX.
- GLSL lives in `src/scene/shaders/*.ts` as exported template strings.
- Textures load from `/textures/*` (local, fetched by `scripts/fetch-assets.mjs`).
  Loading is progressive: app must render with zero textures (procedural fallback).
- Real numbers come ONLY from `src/lib/constants.ts`. Never inline magic numbers
  for physical quantities.
- Definition of done for every task: `npm run build` passes; no console errors;
  60 fps with 2,400 satellites on a mid-range GPU (use Chrome FPS meter).

---

## Real data sheet (single source of truth)

### AI1 satellite (SpaceX, unveiled 2026-06-08)

| Spec | Value | Notes |
| --- | --- | --- |
| Deployed wingspan | 70 m | Wider than a 747-8's 68.4 m |
| Compute payload | 120 kW average / 150 kW peak | Power density 70 kW/ton (≈2.14 t/sat) |
| Solar array | ~150 kW at ~250 W/m² | Starlink V3 cell heritage; no phased arrays |
| Thermal | Liquid radiators up to 110 m² | Redundant pump loops, micrometeoroid shielding |
| Orbit | ~600 km sun-synchronous (97.6° retrograde) | v = 7.56 km/s, period 96.7 min |
| Links | Laser inter-satellite links only | No RF mesh |
| Compute payload (chips) | Interchangeable chip payload | NVIDIA Rubin/GB300 ref, TPU planned; ≈ one GB300 rack per satellite |

### Program facts

| Fact | Value |
| --- | --- |
| FCC filing | Up to 1,000,000 satellites |
| Prototypes | Two prototypes early 2027 |
| Factory | Gigasat factory, Bastrop TX (11M sq ft) |
| Space-compute target | 1 GW/yr by late 2027 |
| Terafab goal | 1 TW chips/yr |
| Customer deal | $920M/month Google compute deal |

### Starship V3 (launch)

| Spec | Value |
| --- | --- |
| Stack height | 124 m |
| Booster | 33-Raptor Super Heavy, hot-staging |
| Launch site | Starbase TX (25.997° N, −97.155° W) |

### Derived scene constants (`src/lib/constants.ts`)

| Constant | Value |
| --- | --- |
| `EARTH_RADIUS_KM` | 6371 |
| `ORBIT_ALT_KM` | 600 |
| `INCLINATION_DEG` | 97.6 |
| `SAT_KW_AVG` / `SAT_KW_PEAK` | 120 / 150 |
| `SAT_TONS` | 150 / 70 ≈ 2.14 |
| `WINGSPAN_M` | 70 |
| `SOLAR_KW` | 150 |
| `RADIATOR_M2` | 110 |
| `ORBITAL_V_KMS` | 7.56 |
| `PERIOD_MIN` | 96.7 |
| `STARBASE` | { lat: 25.997, lon: −97.155 } |
| `STACK_HEIGHT_M` | 124 |
| `SCENE.EARTH_R` | 100 |
| `SCENE.ORBIT_R` | 100 × (6371 + 600) / 6371 ≈ 109.42 |
| `SCENE.MAX_SATS` | 2400 |

---

## Verified real-imagery URLs (CORS-enabled, pixel-checked)

| Asset | Resolution | URL |
| --- | --- | --- |
| Day albedo (NASA-derived) | 8192×4096 | https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Albedo.jpg |
| Night city lights | 16384×8192 | https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/night_lights_modified.png |
| Topography bump | 10800×5400 | https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Bump.jpg |
| Cloud map | 4096×2048 | https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Clouds.png |
| Ocean specular mask | 4096×2048 | https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Ocean.png |
| Gaia DR3 Milky Way sky | 8000×4000 | https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Gaia_EDR3_darkened.png |
| Moon | 4096×2048 | https://raw.githubusercontent.com/CoryG89/MoonDemo/master/img/maps/moon.jpg |
| Fallback day (4K) | 4096×2048 | https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg |
| Fallback night (4K) | 4096×2048 | https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-night.jpg |
