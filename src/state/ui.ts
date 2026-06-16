import { create } from 'zustand';

export type InfoTab = 'mission' | 'vehicle' | 'how' | 'data' | 'controls' | 'credits';
export type MobileTab = 'none' | 'telemetry' | 'controls' | 'econ';
export type SystemKey = 'wing' | 'radiator' | 'compute' | 'bus' | 'laser';

/** HUD UI state: the Info modal (open + active tab). */
type UiState = {
  infoOpen: boolean;
  infoTab: InfoTab;
  openInfo: (tab?: InfoTab) => void;
  closeInfo: () => void;
  setInfoTab: (t: InfoTab) => void;
  econOpen: boolean;
  toggleEcon: () => void;
  mobileTab: MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  inspectComponent: SystemKey | null;
  hoveredComponent: SystemKey | null;
  setInspectComponent: (c: SystemKey | null) => void;
  setHoveredComponent: (c: SystemKey | null) => void;
  
  // Category tabs & weather/ADCS states
  activeTab: 'networks' | 'fleet' | 'compute' | 'hazards' | 'system' | 'help';
  weatherSim: boolean;
  adcsActive: boolean;
  weatherStates: ('clear' | 'cloudy')[];
  setActiveTab: (t: 'networks' | 'fleet' | 'compute' | 'hazards' | 'system' | 'help') => void;
  setWeatherSim: (v: boolean) => void;
  setAdcsActive: (v: boolean) => void;
  setWeatherStates: (s: ('clear' | 'cloudy')[]) => void;
};

export const useUiStore = create<UiState>((set) => ({
  infoOpen: false,
  infoTab: 'mission',
  openInfo: (tab) => set(tab ? { infoOpen: true, infoTab: tab } : { infoOpen: true }),
  closeInfo: () => set({ infoOpen: false }),
  setInfoTab: (infoTab) => set({ infoTab }),
  econOpen: false,
  toggleEcon: () => set((s) => ({ econOpen: !s.econOpen })),
  mobileTab: 'none',
  setMobileTab: (mobileTab) => set({ mobileTab }),
  inspectComponent: null,
  hoveredComponent: null,
  setInspectComponent: (inspectComponent) => set({ inspectComponent }),
  setHoveredComponent: (hoveredComponent) => set({ hoveredComponent }),

  activeTab: 'networks',
  weatherSim: false,
  adcsActive: false,
  weatherStates: ['clear', 'clear', 'clear', 'clear'],
  setActiveTab: (activeTab) => set({ activeTab }),
  setWeatherSim: (weatherSim) => set({ weatherSim }),
  setAdcsActive: (adcsActive) => set({ adcsActive }),
  setWeatherStates: (weatherStates) => set({ weatherStates }),
}));

