// Fetch the current Starlink TLE set from CelesTrak at build time.
// Etiquette: 24 h cache, keep the stale file on failure, never fail the build.
// Writes public/data/starlink.tle + starlink.meta.json. Run from `npm run assets`.

import { mkdir, stat, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'public', 'data');
const TLE = join(DATA, 'starlink.tle');
const META = join(DATA, 'starlink.meta.json');
const URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function ageOf(path) {
  try {
    return Date.now() - (await stat(path)).mtimeMs;
  } catch {
    return Infinity;
  }
}

async function main() {
  await mkdir(DATA, { recursive: true });

  if ((await ageOf(TLE)) < MAX_AGE_MS) {
    console.log('starlink TLE: fresh (<24 h), skipping');
    return;
  }

  try {
    const res = await fetch(URL, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const objects = Math.floor(text.split(/\r?\n/).filter((l) => l.startsWith('1 ')).length);
    if (objects < 100) throw new Error(`suspicious object count ${objects}`);
    await writeFile(TLE, text);
    await writeFile(
      META,
      JSON.stringify({ fetched: new Date().toISOString(), objects, source: 'CelesTrak' }, null, 2),
    );
    console.log(`starlink TLE: ${objects} objects fetched`);
  } catch (err) {
    const have = (await ageOf(TLE)) !== Infinity;
    console.warn(
      `starlink TLE fetch failed (${err instanceof Error ? err.message : err}) — ` +
        (have ? 'keeping stale file' : 'no cached file, overlay will be empty'),
    );
    // ensure a meta file exists so the app can read an age honestly
    try {
      await readFile(META);
    } catch {
      if (have) {
        const m = await ageOf(TLE);
        await writeFile(
          META,
          JSON.stringify(
            { fetched: new Date(Date.now() - m).toISOString(), objects: 0, source: 'CelesTrak (stale)' },
            null,
            2,
          ),
        );
      }
    }
  }
}

main().catch((e) => {
  console.warn('fetch-tle (non-fatal):', e);
  process.exit(0);
});
