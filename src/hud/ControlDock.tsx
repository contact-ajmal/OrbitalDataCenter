import { useEffect, useState } from 'react';
import { Label, Panel, Seg, UtilBtn } from './ui';
import { emit, toast } from '../lib/bus';
import { useSimStore, type ViewMode } from '../state/sim';
import { storm, triggerStorm } from '../state/storm';
import { startTour, stopTour, tour } from '../state/tour';
import { requestReset } from '../state/reset';
import { startTraining } from '../sim/training';
import { useUiStore } from '../state/ui';
import { triggerConjunction } from '../state/conjunction';
import { telemetry } from '../state/telemetry';
import { isAudioOn, toggleAudio } from '../lib/audio';
import { currentShareUrl } from '../lib/permalink';
import { useRoadmapStore } from '../state/roadmap';

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="font-mono text-[10px] tabular-nums text-ink">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ai1-range pointer-events-auto h-1 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-[var(--color-laser)]"
      />
    </div>
  );
}

export function ControlDock() {
  const satCount = useSimStore((s) => s.satCount);
  const timeWarp = useSimStore((s) => s.timeWarp);
  const toggles = useSimStore((s) => s.toggles);
  const viewMode = useSimStore((s) => s.viewMode);
  const visionOn = useSimStore((s) => s.visionOn);
  const jobBusy = useSimStore((s) => s.jobBusy);
  const setJobBusy = useSimStore((s) => s.setJobBusy);
  const paused = useSimStore((s) => s.paused);
  const togglePaused = useSimStore((s) => s.togglePaused);
  const thermal = useSimStore((s) => s.thermal);
  const toggleThermal = useSimStore((s) => s.toggleThermal);
  const setPhotoMode = useSimStore((s) => s.setPhotoMode);
  const lowGraphics = useSimStore((s) => s.lowGraphics);
  const toggleLowGraphics = useSimStore((s) => s.toggleLowGraphics);
  const econOpen = useUiStore((s) => s.econOpen);
  const toggleEcon = useUiStore((s) => s.toggleEcon);
  const roadmapActive = useRoadmapStore((s) => s.active);
  const toggleRoadmap = useRoadmapStore((s) => s.toggle);

  // poll singletons (storm/tour) so glyph .on states stay in sync
  const [, tickUtil] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tickUtil((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const setSatCount = useSimStore((s) => s.setSatCount);
  const setTimeWarp = useSimStore((s) => s.setTimeWarp);
  const toggle = useSimStore((s) => s.toggle);
  const setViewMode = useSimStore((s) => s.setViewMode);
  const setVisionOn = useSimStore((s) => s.setVisionOn);
  const selectedIdx = useSimStore((s) => s.selectedIdx);
  const shieldActive = useSimStore((s) => s.shieldActive);
  const qkdActive = useSimStore((s) => s.qkdActive);
  const toggleShield = useSimStore((s) => s.toggleShield);
  const toggleQkd = useSimStore((s) => s.toggleQkd);

  const mobileTab = useUiStore((s) => s.mobileTab);
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const weatherSim = useUiStore((s) => s.weatherSim);
  const setWeatherSim = useUiStore((s) => s.setWeatherSim);
  const adcsActive = useUiStore((s) => s.adcsActive);
  const setAdcsActive = useUiStore((s) => s.setAdcsActive);
  
  const show = mobileTab === 'controls';
  const [expanded, setExpanded] = useState(false);

  const handleTabClick = (tab: typeof activeTab) => {
    if (activeTab === tab) {
      setExpanded(!expanded);
    } else {
      setActiveTab(tab);
      setExpanded(true);
    }
  };

  return (
    <Panel
      className={`absolute left-1/2 -translate-x-1/2 bottom-16 w-[92vw] max-w-[520px] transition-all duration-300 z-10 border-white/15 backdrop-blur-lg flex flex-col hud:bottom-9 hud:max-w-[640px] ${
        expanded ? 'p-3.5 gap-3.5 max-h-[60vh] overflow-y-auto hud:max-h-none hud:overflow-visible' : 'p-2 gap-0 overflow-hidden'
      } ${show ? 'flex' : 'hidden hud:flex'}`}
    >
      {/* 1. Tab Contents */}
      {expanded && (
        <div className="flex flex-wrap items-center justify-center gap-3 w-full min-h-[46px]">
        {activeTab === 'networks' && (
          <div className="flex flex-wrap items-center justify-between w-full gap-3">
            <div className="flex flex-col gap-1 shrink-0">
              <Label>Layers</Label>
              <div className="flex flex-wrap gap-1.5">
                {(['lasers', 'downlink', 'orbits', 'starlink', 'traffic', 'heatmap'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    title={
                      k === 'lasers'
                        ? 'Toggle inter-satellite laser communication links'
                        : k === 'downlink'
                          ? 'Toggle ground-station data transmission beams'
                          : k === 'orbits'
                            ? 'Toggle orbital plane rings'
                            : k === 'starlink'
                              ? 'Toggle background Starlink constellation overlay'
                              : k === 'traffic'
                                ? 'Toggle global network traffic flows'
                                : 'Toggle global AI workload demand overlay'
                    }
                    className={
                      'pointer-events-auto rounded border px-2 py-1 text-[9px] uppercase tracking-[.16em] transition-colors cursor-pointer ' +
                      (toggles[k]
                        ? 'border-laser/60 bg-laser/15 text-laser'
                        : 'border-white/10 text-faint hover:text-dim')
                    }
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <Label>Weather</Label>
              <button
                onClick={() => {
                  setWeatherSim(!weatherSim);
                  toast(
                    !weatherSim
                      ? 'WEATHER SIMULATION INITIATED — GROUND CLOUD COVER ACTIVE'
                      : 'WEATHER SIMULATION TERMINATED — SKY CONDITIONS NOMINAL'
                  );
                }}
                title="Simulate cloud weather interference on ground optical uplinks"
                className={
                  'pointer-events-auto rounded border px-2.5 py-1.5 text-[9px] uppercase tracking-[.16em] transition-colors cursor-pointer ' +
                  (weatherSim
                    ? 'border-orange-500/60 bg-orange-500/15 text-orange-400'
                    : 'border-white/10 text-faint hover:text-dim')
                }
              >
                ☁ Weather Sim
              </button>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <Label>Security</Label>
              <button
                onClick={() => {
                  toggleQkd();
                  toast(
                    !qkdActive
                      ? 'QKD ENCRYPTION ACTIVE — QUANTUM ENTANGLED LINKS SECURED'
                      : 'QKD SECURE MESH DEACTIVATED — STANDARD OPTICAL LINKS'
                  );
                }}
                title="Toggle Quantum Key Distribution (QKD) high-security laser mesh network"
                className={
                  'pointer-events-auto rounded border px-2.5 py-1.5 text-[9px] uppercase tracking-[.16em] transition-colors cursor-pointer ' +
                  (qkdActive
                    ? 'border-ok/60 bg-ok/15 text-ok'
                    : 'border-white/10 text-faint hover:text-dim')
                }
              >
                🔑 QKD Crypt
              </button>
            </div>
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="flex flex-wrap items-end gap-3.5 w-full justify-between">
            <div className="w-[120px] shrink-0">
              <Slider
                label="Satellites"
                min={60}
                max={2400}
                step={60}
                value={satCount}
                onChange={(v) => {
                  if (roadmapActive) useRoadmapStore.getState().exitManual();
                  setSatCount(v);
                }}
                display={satCount.toLocaleString('en-US')}
              />
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Label>View Mode</Label>
              <Seg<ViewMode>
                value={viewMode === 'launch' ? 'overview' : viewMode}
                onChange={setViewMode}
                options={[
                  { label: 'Overview', value: 'overview', title: 'Global constellation overview' },
                  { label: 'Chase', value: 'chase', title: 'Follow selected satellite in orbit' },
                  { label: 'Inspect', value: 'inspect', title: 'Detailed interactive satellite model inspector' },
                ]}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => emit('launch:request', 60)}
                title="Launch a Starship and deploy 60 new satellites into orbit"
                className="pointer-events-auto rounded border border-white/60 px-2.5 py-1 text-[9px] uppercase tracking-[.18em] text-ink transition-colors cursor-pointer hover:bg-white/10 h-7"
              >
                Launch +60
              </button>
              <button
                onClick={() => setVisionOn(!visionOn)}
                title="Toggle point-cloud representation of the 1,000,000 satellite fleet"
                className={
                  'pointer-events-auto rounded border px-2.5 py-1 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer h-7 ' +
                  (visionOn
                    ? 'border-laser bg-laser/20 text-laser'
                    : 'border-white/15 text-dim hover:text-ink')
                }
              >
                10⁶ Vision
              </button>
              <button
                onClick={() => {
                  setAdcsActive(!adcsActive);
                  toast(
                    !adcsActive
                      ? 'ACTIVE ADCS INITIATED — RCS PLUME SIMULATION ONLINE'
                      : 'ADCS PLUMES DEACTIVATED'
                  );
                }}
                title="Toggle active attitude determination & control gas thruster visual plumes"
                className={
                  'pointer-events-auto rounded border px-2.5 py-1 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer h-7 ' +
                  (adcsActive
                    ? 'border-laser/60 bg-laser/15 text-laser'
                    : 'border-white/15 text-dim hover:text-ink')
                }
              >
                🚀 ADCS Plumes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'compute' && (
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <button
              onClick={() => emit('job:run', 1)}
              disabled={jobBusy}
              title="Route a geographic compute packet across the live laser network"
              className={
                'pointer-events-auto rounded border px-4 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
                (jobBusy
                  ? 'border-white/15 text-faint'
                  : 'border-solar/70 text-solar hover:bg-solar/15')
              }
            >
              {jobBusy ? 'Busy…' : 'Run AI Job'}
            </button>
            <button
              onClick={() => {
                if (jobBusy) return;
                setJobBusy(true);
                startTraining();
              }}
              disabled={jobBusy}
              title="Simulate federated model training across the satellite constellation"
              className={
                'pointer-events-auto rounded border px-4 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
                (jobBusy
                  ? 'border-white/15 text-faint'
                  : 'border-laser/70 text-laser hover:bg-laser/15')
              }
            >
              Train Model (Consensus)
            </button>
          </div>
        )}

        {activeTab === 'hazards' && (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col gap-1 w-full">
              <Label>Constellation Hazards</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={triggerStorm}
                  className={
                    'pointer-events-auto rounded border px-3 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
                    (storm.active
                      ? 'border-solar bg-solar/20 text-solar'
                      : 'border-white/15 text-dim hover:text-ink')
                  }
                  title="Trigger a coronal mass ejection space storm event"
                >
                  ☀ Solar Storm
                </button>
                <button
                  onClick={() => triggerConjunction(telemetry.simT)}
                  className="pointer-events-auto rounded border border-white/15 px-3 py-1.5 text-[9px] uppercase tracking-[.18em] text-dim transition-colors cursor-pointer hover:bg-white/10 hover:text-ink"
                  title="Trigger a debris conjunction warning avoidance event"
                >
                  ⚠ Conjunction Warning
                </button>
                <button
                  onClick={() => {
                    if (selectedIdx >= 0) {
                      emit('asat:trigger', selectedIdx);
                    }
                  }}
                  disabled={selectedIdx < 0}
                  className={
                    'pointer-events-auto rounded border px-3 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
                    (selectedIdx >= 0
                      ? 'border-red-500/60 text-red-400 hover:bg-red-500/15'
                      : 'border-white/10 text-faint cursor-not-allowed')
                  }
                  title={selectedIdx >= 0 ? "Launch a kinetic ASAT missile to destroy the selected satellite" : "Select a satellite first to trigger ASAT strike"}
                >
                  💥 ASAT Kinetic Strike
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 w-full border-t border-white/5 pt-2">
              <Label>Constellation Defenses</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => {
                    toggleShield();
                    toast(
                      !shieldActive
                        ? 'SHIELD GENERATOR ONLINE — CONSTELLATION PROTECTED FROM SEU & STORM RADIATION'
                        : 'SHIELD GENERATOR DEACTIVATED — FLEET EXPOSED'
                    );
                  }}
                  className={
                    'pointer-events-auto rounded border px-3 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
                    (shieldActive
                      ? 'border-laser bg-laser/20 text-laser'
                      : 'border-white/15 text-dim hover:text-ink')
                  }
                  title="Activate magnetospheric deflector shields to protect constellation against space hazards"
                >
                  🛡 Deflector Shield
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="flex flex-wrap items-end gap-3.5 w-full justify-between">
            <div className="w-[100px] shrink-0">
              <Slider
                label="Time warp"
                min={1}
                max={600}
                step={1}
                value={timeWarp}
                onChange={setTimeWarp}
                display={`${timeWarp}×`}
              />
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <Label>System Utilities</Label>
              <div className="flex flex-wrap gap-1">
                <UtilBtn glyph="⟲" onClick={requestReset} title="Reset view (R)" />
                <UtilBtn
                  glyph={paused ? '▶' : '⏸'}
                  on={paused}
                  onClick={togglePaused}
                  title="Pause / resume"
                />
                <UtilBtn glyph="📷" onClick={() => emit('snapshot', Date.now())} title="Snapshot" />
                <UtilBtn glyph="$" on={econOpen} onClick={toggleEcon} title="Economics" />
                <UtilBtn glyph="🗓" on={roadmapActive} onClick={toggleRoadmap} title="Roadmap timeline" />
                <UtilBtn
                  glyph="🌡"
                  on={thermal}
                  onClick={() => {
                    if (!thermal) toast('THERMAL VIEW — RADIATOR EMISSION FALSE COLOR');
                    toggleThermal();
                  }}
                  title="Thermal / IR view"
                />
                <UtilBtn
                  glyph="🎬"
                  on={tour.active}
                  onClick={() => (tour.active ? stopTour(true) : startTour())}
                  title="Cinematic tour"
                />
                <UtilBtn glyph="🔊" on={isAudioOn()} onClick={toggleAudio} title="Soft Music" />
                <UtilBtn
                  glyph="⚡"
                  on={lowGraphics}
                  onClick={() => {
                    toggleLowGraphics();
                    toast(
                      !lowGraphics
                        ? 'PERFORMANCE MODE ACTIVE — 1X RESOLUTION, POST-PROCESSING BYPASSED'
                        : 'HIGH QUALITY ACTIVE — BLOOM & HDR ENABLED'
                    );
                  }}
                  title={lowGraphics ? 'Switch to High Quality Graphics' : 'Switch to High Performance Mode'}
                />
                <UtilBtn glyph="📸" onClick={() => setPhotoMode(true)} title="Photo mode" />
                <UtilBtn
                  glyph="🔗"
                  onClick={() => {
                    navigator.clipboard?.writeText(currentShareUrl()).then(
                      () => toast('LINK COPIED'),
                      () => toast('COPY FAILED — SELECT THE URL MANUALLY'),
                    );
                  }}
                  title="Share view"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 2. Category Tab Selector Bar */}
      <div className={`flex justify-between items-center w-full gap-2 ${expanded ? 'border-t border-white/8 pt-2' : ''}`}>
        {(['networks', 'fleet', 'compute', 'hazards', 'system'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`flex-1 text-center px-1.5 py-2 text-[10px] uppercase font-bold tracking-[.18em] transition-all cursor-pointer rounded border ${
              activeTab === tab && expanded
                ? 'text-laser border-laser/40 bg-laser/10'
                : activeTab === tab
                  ? 'text-dim border-white/20 bg-white/5'
                  : 'text-faint border-transparent hover:text-dim hover:bg-white/3'
            }`}
          >
            {tab} {activeTab === tab ? (expanded ? '▾' : '▴') : ''}
          </button>
        ))}
      </div>
    </Panel>
  );
}
