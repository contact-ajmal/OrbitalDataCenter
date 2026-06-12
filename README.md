# AI1 Orbital Compute — Constellation Simulator

A production-grade, client-side WebGL simulator of the **SpaceX AI1 orbital
data-center constellation**: laser-linked compute satellites in sun-synchronous
orbit, real NASA-derived imagery, HDR post-processing, a Starship V3 launch &
Pez-deployment sequence, AI job routing, and a 10⁶ "vision" mode.

> Pure Vite static build — deploys anywhere (Cloudflare Pages, GitHub Pages, a
> plain nginx box). No server, no Next.js.

<!-- Add a hero screenshot here, e.g.:
![AI1 Orbital Compute](docs/hero.png)
-->

---

## Features

- **8K / 16K Earth** — custom day/night ShaderMaterial: bump-mapped mountain
  relief along the terminator, drifting cloud shadows, ocean-only sun glint,
  16K city lights, warm terminator band, blue atmospheric fresnel rim.
- **Walker constellation** — up to 2,400 satellites in five instanced meshes,
  sun-tracking solar wings, real cylindrical-shadow eclipse dimming.
- **Laser mesh + downlink** — inter-satellite ring/ladder links with streaming
  data pulses; ground-station beams that hand off as the planet rotates.
- **Inspect mode** — high-detail hero satellite with projected, always-readable
  part labels and a 70 m wingspan ruler.
- **Starship V3 launch** — real-proportion vehicle, hot-staging with a tumbling
  free-body booster, then a 60-satellite Pez deployment that fans into a new
  orbital plane and knits into the mesh.
- **AI job routing** — greedy geographic routing over the live laser adjacency;
  the path bends in real time as satellites move; reports hops, distance, and
  light-speed latency.
- **10⁶ vision mode** — a 60,000-point million-satellite shell; the HUD swaps to
  projected fleet figures (1,000,000 sats · 120 GW · ~2.14 M t).
- **HDR post** — Bloom, ACESFilmic tone mapping, vignette, film noise.
- **SpaceX-webcast HUD** — letterspaced telemetry, throughput sparkline,
  mission strip, satellite cards, marquee ticker.

---

## Real data sheet

### AI1 satellite (SpaceX, unveiled 2026-06-08)

| Spec | Value |
| --- | --- |
| Deployed wingspan | 70 m (wider than a 747-8's 68.4 m) |
| Compute payload | 120 kW avg / 150 kW peak · 70 kW/ton (≈2.14 t/sat) |
| Solar array | ~150 kW at ~250 W/m² (Starlink V3 cell heritage) |
| Thermal | Liquid radiators up to 110 m², redundant pump loops |
| Orbit | ~600 km sun-synchronous (97.6° retrograde) · 7.56 km/s · 96.7 min |
| Links | Laser inter-satellite links only |
| Payload | Interchangeable chip payload (NVIDIA Rubin/GB300, TPU planned) — ≈ one GB300 rack/sat |

### Program facts

| Fact | Value |
| --- | --- |
| FCC filing | Up to 1,000,000 satellites |
| Prototypes | Two targeted early 2027 |
| Factory | Gigasat, Bastrop TX (11M sq ft) |
| Space-compute target | 1 GW/yr by late 2027 |
| Terafab goal | 1 TW of chips/yr |
| Customer | $920M/month Google compute deal |

### Starship V3

| Spec | Value |
| --- | --- |
| Stack height | 124 m |
| Booster | 33-Raptor Super Heavy, hot-staging |
| Launch site | Starbase TX (25.997° N, −97.155° W) |

---

## Architecture

```
src/
  sim/      Pure TypeScript simulation — NO React, no scene objects.
            Orbital mechanics, eclipse tests, laser-mesh routing, launch
            sequencing. Unit-tested with vitest. (eslint forbids React here.)
  scene/    React-Three-Fiber components — the visual layer. Earth, Sky,
            SunMoon, Constellation, Lasers, Downlink, HeroSat, Starship,
            JobRouter, VisionShell, OrbitRings, Picker, CameraRig, Post.
            shaders/  GLSL as exported template strings.
  hud/      DOM overlay (Tailwind v4) — telemetry, controls, mission strip,
            satellite card, ticker, toasts. Reads telemetry at ~4 Hz.
  state/    zustand stores (config/UI) + mutable singletons (per-frame
            telemetry, network topology, launch, labels).
  lib/      Constants (the real data sheet), texture loader, event bus,
            geo + station helpers.
scripts/    fetch-assets.mjs — the texture pipeline.
```

**Data-flow rules** (see `CLAUDE.md`): per-frame mutation happens in `useFrame`
via refs and preallocated typed arrays — never `setState` in the loop. zustand
holds config/UI state; high-frequency telemetry flows through the
`state/telemetry.ts` singleton, polled by the HUD at 4 Hz.

---

## Asset pipeline

`npm run assets` (also run automatically by `predev` / `prebuild`) downloads
~25 MB of verified, CORS-enabled, high-resolution imagery into
`public/textures/` and writes a `manifest.json`. It is idempotent (skips files
already > 100 KB), retries with fallbacks, and is non-fatal — the app renders
with procedural fallbacks if assets are missing.

Filenames are stable, so `/textures/*` can be cached `immutable` for a year.

### Attribution

- **Day surface, night lights, bump, clouds, ocean mask, Gaia sky** — NASA-derived
  imagery via [franky-adl/threejs-earth](https://github.com/franky-adl/threejs-earth).
- **Milky Way sky** — ESA **Gaia DR3** (darkened panorama).
- **Moon map** — [CoryG89/MoonDemo](https://github.com/CoryG89/MoonDemo).
- **Fallback Blue Marble / night** — vasturiano/three-globe.

---

## Commands

```bash
npm install          # install deps
npm run assets       # download textures (idempotent; auto-runs on dev/build)
npm run dev          # Vite dev server with HMR
npm run check        # tsc -b (type-check) + vitest run
npm run test         # unit tests only
npm run build        # production build to dist/
npm run preview      # serve the built dist/ locally
npm run lint         # eslint
```

**Stack:** Vite 6 · React 19 · TypeScript 5 (strict) · three + @react-three/fiber
v9 + drei + @react-three/postprocessing · zustand · Tailwind CSS v4.

---

## Deploy

`dist/` is a static bundle — drop it on Cloudflare Pages, GitHub Pages, or a
static host. Because texture filenames are stable, serve them with a long
immutable cache. Example nginx block:

```nginx
location /textures/ {
    root /var/www/ai1;
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
    try_files $uri =404;
}

location / {
    root /var/www/ai1/dist;
    try_files $uri /index.html;
}
```

---

## License / use

Educational simulation built from publicly announced figures. Imagery belongs to
its respective sources (see Attribution). Not affiliated with SpaceX.

---

## Credits

**Ajmal Baba** — United Kingdom

[LinkedIn](https://www.linkedin.com/in/ajmalnazirbaba/) ·
[Portfolio](https://ajmalbaba-portfolio.pages.dev/projects)

Designed & built with Claude Code · 2026
