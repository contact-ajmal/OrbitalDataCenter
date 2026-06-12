import { create } from 'zustand';
import { ECON_DEFAULTS, type EconParams } from '../sim/economics';

type EconState = {
  params: EconParams;
  setParam: (k: keyof EconParams, v: number) => void;
};

export const useEconStore = create<EconState>((set) => ({
  params: { ...ECON_DEFAULTS },
  setParam: (k, v) => set((s) => ({ params: { ...s.params, [k]: v } })),
}));

/** Launches completed this session (drives the cost tally in the econ panel). */
export const launchTally = { count: 0 };
