// AI1 Orbital Sim — real-asset pipeline.
// Node 20+, zero dependencies (uses global fetch + node:fs/node:path).
//
// Downloads verified high-resolution imagery into public/textures and writes a
// manifest. Idempotent: existing files > 100 KB are skipped. Network failures
// are non-fatal — the app has procedural fallbacks, so we warn and exit 0.

import { mkdir, stat, writeFile, rename, unlink, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'textures');
const MANIFEST = join(OUT_DIR, 'manifest.json');

const SKIP_BYTES = 100 * 1024; // 100 KB
const RETRIES = 2; // attempts per URL before moving to fallback

/** @typedef {{ name:string, file:string, urls:string[] }} Asset */

/** @type {Asset[]} */
const ASSETS = [
  {
    name: 'earth-day',
    file: 'earth-day.jpg',
    urls: [
      'https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Albedo.jpg',
      'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-blue-marble.jpg',
    ],
  },
  {
    name: 'earth-night',
    file: 'earth-night.png',
    urls: [
      'https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/night_lights_modified.png',
      'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-night.jpg',
    ],
  },
  {
    name: 'earth-bump',
    file: 'earth-bump.jpg',
    urls: [
      'https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Bump.jpg',
    ],
  },
  {
    name: 'earth-clouds',
    file: 'earth-clouds.png',
    urls: [
      'https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Clouds.png',
    ],
  },
  {
    name: 'earth-ocean',
    file: 'earth-ocean.png',
    urls: [
      'https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Ocean.png',
    ],
  },
  {
    name: 'sky-gaia',
    file: 'sky-gaia.png',
    urls: [
      'https://raw.githubusercontent.com/franky-adl/threejs-earth/main/src/assets/Gaia_EDR3_darkened.png',
    ],
  },
  {
    name: 'moon',
    file: 'moon.jpg',
    urls: ['https://raw.githubusercontent.com/CoryG89/MoonDemo/master/img/maps/moon.jpg'],
  },
];

const fmtMB = (b) => `${(b / 1048576).toFixed(2)} MB`;

/** @returns {Promise<number>} file size in bytes, or 0 if missing. */
async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

/**
 * Download one URL to a temp file, atomically rename on success.
 * @returns {Promise<number>} bytes written
 */
async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  const bytes = await sizeOf(tmp);
  if (bytes <= SKIP_BYTES) {
    await unlink(tmp).catch(() => {});
    throw new Error(`too small (${bytes} bytes)`);
  }
  await rename(tmp, dest);
  return bytes;
}

/**
 * Try each URL (with retries) until one succeeds.
 * @returns {Promise<{bytes:number, source:string}|null>}
 */
async function fetchAsset(asset, dest) {
  for (const url of asset.urls) {
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        const bytes = await download(url, dest);
        return { bytes, source: url };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const tag = url === asset.urls[0] ? 'primary' : 'fallback';
        console.warn(`  ! ${asset.name} ${tag} attempt ${attempt}/${RETRIES}: ${msg}`);
      }
    }
  }
  return null;
}

/** Load the previous manifest so cached files keep their original source URL. */
async function loadPrevManifest() {
  try {
    /** @type {{name:string,source:string}[]} */
    const prev = JSON.parse(await readFile(MANIFEST, 'utf8'));
    return new Map(prev.map((m) => [m.name, m.source]));
  } catch {
    return new Map();
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`AI1 asset pipeline → ${OUT_DIR}\n`);

  const prevSources = await loadPrevManifest();

  /** @type {{name:string,file:string,bytes:number,source:string}[]} */
  const manifest = [];
  let downloaded = 0;
  let failed = 0;

  for (const asset of ASSETS) {
    const dest = join(OUT_DIR, asset.file);
    const existing = await sizeOf(dest);

    if (existing > SKIP_BYTES) {
      console.log(`= ${asset.name.padEnd(13)} skip (${fmtMB(existing)} on disk)`);
      manifest.push({
        name: asset.name,
        file: asset.file,
        bytes: existing,
        source: prevSources.get(asset.name) ?? 'cached',
      });
      continue;
    }

    process.stdout.write(`↓ ${asset.name.padEnd(13)} fetching...\n`);
    const result = await fetchAsset(asset, dest);
    if (result) {
      downloaded++;
      const tag = result.source === asset.urls[0] ? 'primary' : 'fallback';
      console.log(`✓ ${asset.name.padEnd(13)} ${fmtMB(result.bytes)} (${tag})`);
      manifest.push({
        name: asset.name,
        file: asset.file,
        bytes: result.bytes,
        source: result.source,
      });
    } else {
      failed++;
      console.warn(`✗ ${asset.name.padEnd(13)} all sources failed — procedural fallback`);
    }
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  const total = manifest.reduce((s, m) => s + m.bytes, 0);
  console.log(
    `\nManifest: ${manifest.length} assets, ${fmtMB(total)} total` +
      ` (${downloaded} downloaded, ${failed} failed)`,
  );
  // Non-fatal even on failure: app has procedural fallbacks.
  process.exit(0);
}

main().catch((err) => {
  console.warn('asset pipeline error (non-fatal):', err);
  process.exit(0);
});
