// Generate a 1200×630 OpenGraph placeholder — zero deps. Writes:
//   public/og.svg  — full wordmark (vector, text)
//   public/og.png  — a hand-encoded raster motif (black bg + cyan ring + amber
//                    diamond), since most scrapers need a raster image.
// Idempotent: skips if both already exist. Run from `npm run assets`.

import { writeFile, stat } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = join(__dirname, '..', 'public');
const W = 1200;
const H = 630;

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

// ── PNG encoder (truecolor RGB, no deps) ────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  // rows: each prefixed with filter byte 0
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawMotif() {
  const rgb = Buffer.alloc(W * H * 3); // black
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  };
  const cx = W / 2;
  const cy = H / 2 - 10;

  // tilted orbital ellipse (cyan)
  const rx = 360;
  const ry = 130;
  const inc = (97.6 * Math.PI) / 180;
  for (let t = 0; t < Math.PI * 2; t += 0.0009) {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    const x = cx + ex * Math.cos(inc) - ey * Math.sin(inc);
    const y = cy + ex * Math.sin(inc) + ey * Math.cos(inc);
    for (let w = -2; w <= 2; w++) {
      set(Math.round(x) + w, Math.round(y), 82, 215, 255);
      set(Math.round(x), Math.round(y) + w, 82, 215, 255);
    }
  }
  // Earth core (dark blue disc)
  for (let y = -90; y <= 90; y++) {
    for (let x = -90; x <= 90; x++) {
      if (x * x + y * y <= 90 * 90) set(cx + x, cy + y, x > 0 ? 27 : 14, x > 0 ? 59 : 29, x > 0 ? 99 : 51);
    }
  }
  // amber satellite diamond on the ring
  const t0 = (-50 * Math.PI) / 180;
  const ex = rx * Math.cos(t0);
  const ey = ry * Math.sin(t0);
  const sx = Math.round(cx + ex * Math.cos(inc) - ey * Math.sin(inc));
  const sy = Math.round(cy + ex * Math.sin(inc) + ey * Math.cos(inc));
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      if (Math.abs(x) + Math.abs(y) <= 10) set(sx + x, sy + y, 255, 181, 84);
    }
  }
  return encodePNG(W, H, rgb);
}

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#000"/>
  <ellipse cx="600" cy="300" rx="360" ry="130" fill="none" stroke="#52d7ff" stroke-width="4" transform="rotate(97.6 600 300)"/>
  <circle cx="600" cy="300" r="90" fill="#0e1d33"/>
  <text x="600" y="500" fill="#e8f1f8" font-family="Helvetica,Arial,sans-serif" font-size="84" font-weight="700" letter-spacing="18" text-anchor="middle">AI1</text>
  <text x="600" y="552" fill="#6e8296" font-family="Helvetica,Arial,sans-serif" font-size="26" letter-spacing="14" text-anchor="middle">ORBITAL COMPUTE CONSTELLATION</text>
</svg>`;

async function main() {
  const png = join(PUB, 'og.png');
  const svg = join(PUB, 'og.svg');
  if ((await exists(png)) && (await exists(svg))) {
    console.log('og: already present, skipping');
    return;
  }
  await writeFile(svg, ogSvg);
  await writeFile(png, drawMotif());
  console.log('og: wrote og.svg + og.png');
}

main().catch((e) => {
  console.warn('make-og (non-fatal):', e);
  process.exit(0);
});
