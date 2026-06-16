import { create } from 'zustand';

export type ViewMode = 'overview' | 'chase' | 'inspect' | 'launch' | 'moon' | 'mars';

export type Toggles = {
  lasers: boolean;
  downlink: boolean;
  orbits: boolean;
  starlink: boolean;
  traffic: boolean;
  heatmap: boolean;
};

/**
 * Simulation CONFIG / UI state (low-frequency, drives renders). High-frequency
 * per-frame telemetry lives in state/telemetry.ts, NOT here.
 */
type SimState = {
  satCount: number;
  timeWarp: number;
  toggles: Toggles;
  viewMode: ViewMode;
  chaseIdx: number;
  selectedIdx: number;
  visionOn: boolean;
  jobBusy: boolean;
  paused: boolean;
  thermal: boolean;
  photoMode: boolean;
  lowGraphics: boolean;
  shieldActive: boolean;
  qkdActive: boolean;

  setSatCount: (n: number) => void;
  setTimeWarp: (n: number) => void;
  toggle: (key: keyof Toggles) => void;
  setViewMode: (m: ViewMode) => void;
  setChaseIdx: (i: number) => void;
  setSelectedIdx: (i: number) => void;
  setVisionOn: (v: boolean) => void;
  setJobBusy: (v: boolean) => void;
  togglePaused: () => void;
  toggleThermal: () => void;
  setPhotoMode: (v: boolean) => void;
  toggleLowGraphics: () => void;
  toggleShield: () => void;
  toggleQkd: () => void;
  /** Select a satellite AND fly to it: sets selectedIdx + chaseIdx + inspect. */
  selectSat: (i: number) => void;
};

export const useSimStore = create<SimState>((set) => ({
  satCount: 480,
  timeWarp: 60,
  toggles: { lasers: true, downlink: true, orbits: false, starlink: false, traffic: false, heatmap: false },
  viewMode: 'overview',
  chaseIdx: 0,
  selectedIdx: -1,
  visionOn: false,
  jobBusy: false,
  paused: false,
  thermal: false,
  photoMode: false,
  lowGraphics: (() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('ai1-low-graphics');
      if (saved === 'true') return true;
      if (saved === 'false') return false;
      return window.innerWidth < 900;
    } catch {
      return window.innerWidth < 900;
    }
  })(),

  shieldActive: false,
  qkdActive: false,

  setSatCount: (satCount) => set({ satCount }),
  setTimeWarp: (timeWarp) => set({ timeWarp }),
  toggle: (key) =>
    set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } })),
  setViewMode: (viewMode) => set({ viewMode }),
  setChaseIdx: (chaseIdx) => set({ chaseIdx }),
  setSelectedIdx: (selectedIdx) => set({ selectedIdx }),
  setVisionOn: (visionOn) => set({ visionOn }),
  setJobBusy: (jobBusy) => set({ jobBusy }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  toggleThermal: () => set((s) => ({ thermal: !s.thermal })),
  setPhotoMode: (photoMode) => set({ photoMode }),
  toggleLowGraphics: () =>
    set((s) => {
      const next = !s.lowGraphics;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ai1-low-graphics', String(next));
        } catch {
          /* ignore */
        }
      }
      return { lowGraphics: next };
    }),
  toggleShield: () => set((s) => ({ shieldActive: !s.shieldActive })),
  toggleQkd: () => set((s) => ({ qkdActive: !s.qkdActive })),
  selectSat: (i) => set({ selectedIdx: i, chaseIdx: i, viewMode: 'inspect' }),
}));
