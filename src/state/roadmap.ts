import { create } from 'zustand';
import { YEAR_MIN } from '../lib/roadmap';

type RoadmapState = {
  active: boolean;
  year: number;
  playing: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setYear: (y: number) => void;
  togglePlay: () => void;
  /** Called when the user touches the manual satCount slider. */
  exitManual: () => void;
};

export const useRoadmapStore = create<RoadmapState>((set) => ({
  active: false,
  year: YEAR_MIN,
  playing: false,
  open: () => set({ active: true }),
  close: () => set({ active: false, playing: false }),
  toggle: () => set((s) => ({ active: !s.active, playing: false })),
  setYear: (year) => set({ year }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  exitManual: () => set({ active: false, playing: false }),
}));
