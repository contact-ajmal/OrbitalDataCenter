import {
  TextureLoader,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { useSimStore } from '../state/sim';

/**
 * Texture asset registry — maps logical names to files in /public/textures.
 * Files are fetched by scripts/fetch-assets.mjs. Loading is progressive: any
 * missing file resolves to null so the scene can fall back to procedural maps.
 */
export type TextureName =
  | 'earth-day'
  | 'earth-night'
  | 'earth-bump'
  | 'earth-clouds'
  | 'earth-ocean'
  | 'sky-gaia'
  | 'moon'
  | 'mars';

const FILES: Record<TextureName, string> = {
  'earth-day': 'earth-day.jpg',
  'earth-night': 'earth-night.png',
  'earth-bump': 'earth-bump.jpg',
  'earth-clouds': 'earth-clouds.png',
  'earth-ocean': 'earth-ocean.png',
  'sky-gaia': 'sky-gaia.png',
  moon: 'moon.jpg',
  mars: 'mars.jpg',
};

const loader = new TextureLoader();

// Anisotropy cap is a renderer capability; seed it once from the R3F gl
// instance (see initTextureSystem) so every loaded texture gets max sharpness
// at grazing angles. Defaults to 1 until initialized.
let maxAnisotropy = 1;

/**
 * Initialize the texture system from the live R3F renderer. Call once, e.g.
 * inside a scene component via `useThree((s) => s.gl)`.
 */
export function initTextureSystem(gl: WebGLRenderer): void {
  maxAnisotropy = gl.capabilities.getMaxAnisotropy();
}

/**
 * Load a texture by logical name. Never throws — resolves to null when the
 * file is missing (e.g. assets not yet fetched), letting callers fall back to
 * procedural maps.
 *
 * @param name  logical texture name
 * @param opts.srgb  treat as color data (SRGBColorSpace); omit for data maps
 *                   like bump/ocean masks which stay linear.
 */
export async function loadTexture(
  name: TextureName,
  opts: { srgb?: boolean } = {},
): Promise<Texture | null> {
  const low = useSimStore.getState().lowGraphics;
  const fileName = FILES[name];
  const finalFile = low
    ? fileName.replace(/\.(jpg|png)$/, '-low.$1')
    : fileName;
  const url = `${import.meta.env.BASE_URL}textures/${finalFile}`;
  try {
    const tex = await loader.loadAsync(url);
    tex.anisotropy = maxAnisotropy;
    tex.colorSpace = opts.srgb ? SRGBColorSpace : LinearSRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch {
    // Missing or failed — progressive fallback, never fatal.
    return null;
  }
}
