import { DataTexture, RGBAFormat, type Texture } from 'three';

// Classic "ironbow" thermal LUT: black → purple → red → orange → yellow → white.
const STOPS: [number, [number, number, number]][] = [
  [0.0, [0, 0, 0]],
  [0.15, [30, 0, 60]],
  [0.35, [120, 0, 80]],
  [0.55, [210, 40, 20]],
  [0.75, [250, 150, 10]],
  [0.9, [255, 230, 90]],
  [1.0, [255, 255, 255]],
];

/** Ironbow color for t in [0,1] → [r,g,b] in 0..1. */
export function thermalColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i + 1 < STOPS.length; i++) {
    const [a, ca] = STOPS[i]!;
    const [b, cb] = STOPS[i + 1]!;
    if (x >= a && x <= b) {
      const f = (x - a) / (b - a);
      return [
        (ca[0] + (cb[0] - ca[0]) * f) / 255,
        (ca[1] + (cb[1] - ca[1]) * f) / 255,
        (ca[2] + (cb[2] - ca[2]) * f) / 255,
      ];
    }
  }
  return [1, 1, 1];
}

/** CSS rgb() string for a thermal value (for the SatCard LUT chip). */
export function thermalCss(t: number): string {
  const [r, g, b] = thermalColor(t);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

/** 256×1 ironbow DataTexture. */
export function makeIronbowTexture(): Texture {
  const w = 256;
  const data = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const [r, g, b] = thermalColor(i / (w - 1));
    data[i * 4 + 0] = r * 255;
    data[i * 4 + 1] = g * 255;
    data[i * 4 + 2] = b * 255;
    data[i * 4 + 3] = 255;
  }
  const tex = new DataTexture(data, w, 1, RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}
