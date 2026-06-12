import type { Group } from 'three';

/**
 * Shared mutable ref to the Earth's rotating group. Satellites and ground
 * stations read this every frame to convert Earth-fixed coordinates to world
 * space, so it lives as a plain mutable singleton (NOT zustand state) to avoid
 * per-frame re-renders. Earth.tsx assigns it on mount.
 *
 * (Time-warp config lives in state/sim.ts.)
 */
export const earthGroupRef: { current: Group | null } = { current: null };
