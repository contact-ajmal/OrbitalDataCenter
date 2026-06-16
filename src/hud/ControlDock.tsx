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

  const mobileTab = useUiStore((s) => s.mobileTab);
  const show = mobileTab === 'controls';

  return (
    <Panel
      className={`absolute left-1/2 -translate-x-1/2 bottom-16 w-[92vw] max-w-[420px] max-h-[60vh] overflow-y-auto p-4 flex flex-col gap-4 border-white/15 backdrop-blur-lg transition-all duration-300 z-10 hud:bottom-9 hud:w-auto hud:max-w-none hud:max-h-none hud:overflow-visible hud:flex-row hud:flex-nowrap hud:items-center hud:justify-center hud:gap-x-5 hud:gap-y-3 ${
        show ? 'flex' : 'hidden hud:flex'
      }`}
    >
      <div className="w-full hud:w-[150px] shrink-0">
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
      <div className="w-full hud:w-[130px] shrink-0">
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
        <Label>Layers</Label>
        <div className="flex flex-wrap gap-1.5 hud:flex-nowrap">
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
        <Label>View</Label>
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

      <div className="flex flex-wrap items-center gap-2 w-full shrink-0 hud:w-auto hud:flex-nowrap hud:items-end">
        <button
          onClick={() => emit('job:run', 1)}
          disabled={jobBusy}
          title="Route a geographic compute packet across the live laser network"
          className={
            'pointer-events-auto rounded border px-3 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
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
            'pointer-events-auto rounded border px-3 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
            (jobBusy
              ? 'border-white/15 text-faint'
              : 'border-laser/70 text-laser hover:bg-laser/15')
          }
        >
          Train Model
        </button>
        <button
          onClick={() => emit('launch:request', 60)}
          title="Launch a Starship and deploy 60 new satellites into orbit"
          className="pointer-events-auto rounded border border-white/60 px-3 py-1.5 text-[9px] uppercase tracking-[.18em] text-ink transition-colors cursor-pointer hover:bg-white/10"
        >
          Launch +60
        </button>
        <button
          onClick={() => setVisionOn(!visionOn)}
          title="Toggle point-cloud representation of the 1,000,000 satellite fleet"
          className={
            'pointer-events-auto rounded border px-3 py-1.5 text-[9px] uppercase tracking-[.18em] transition-colors cursor-pointer ' +
            (visionOn
              ? 'border-laser bg-laser/20 text-laser'
              : 'border-white/15 text-dim hover:text-ink')
          }
        >
          10⁶ Vision
        </button>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <Label>Utility</Label>
        <div className="flex flex-wrap gap-1.5 hud:flex-nowrap">
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
          <UtilBtn glyph="☀" on={storm.active} onClick={triggerStorm} title="Solar storm" />
          <UtilBtn
            glyph="⚠"
            onClick={() => triggerConjunction(telemetry.simT)}
            title="Conjunction event"
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
    </Panel>
  );
}
