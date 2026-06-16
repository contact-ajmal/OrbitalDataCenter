import { TopBar } from './TopBar';
import { TelemetryPanel } from './TelemetryPanel';
import { VehiclePanel } from './VehiclePanel';
import { ControlDock } from './ControlDock';

import { Toaster } from './Toaster';
import { IntroOverlay } from './IntroOverlay';
import { PartLabels } from './PartLabels';
import { MissionStrip } from './MissionStrip';
import { SatCard } from './SatCard';
import { AssetChip } from './AssetChip';
import { InfoModal } from './InfoModal';
import { BadgeRail } from './BadgeRail';
import { StationLabels } from './StationLabels';
import { Shortcuts } from './Shortcuts';
import { TrainingPanel } from './TrainingPanel';
import { EconPanel } from './EconPanel';
import { RoadmapBar } from './RoadmapBar';
import { ConjunctionBanner } from './ConjunctionBanner';
import { PhotoMode } from './PhotoMode';
import { PermalinkSync } from './PermalinkSync';
import { useSimStore } from '../state/sim';
import { useUiStore } from '../state/ui';
import { Panel } from './ui';

function MobileNav() {
  const mobileTab = useUiStore((s) => s.mobileTab);
  const setMobileTab = useUiStore((s) => s.setMobileTab);
  const selectedIdx = useSimStore((s) => s.selectedIdx);

  return (
    <Panel className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center justify-between gap-1 p-1 w-[92vw] max-w-[480px] z-20 shadow-[0_4px_20px_rgba(0,0,0,0.6)] border-white/15 backdrop-blur-lg hud:hidden">
      <button
        onClick={() => setMobileTab(mobileTab === 'telemetry' ? 'none' : 'telemetry')}
        className={`flex-1 py-2 text-center text-[10px] uppercase tracking-[.18em] rounded font-bold cursor-pointer transition-all ${
          mobileTab === 'telemetry'
            ? 'bg-laser/20 text-laser border border-laser/35'
            : 'text-dim hover:text-ink border border-transparent'
        }`}
      >
        📊 Telemetry
      </button>
      <button
        onClick={() => setMobileTab(mobileTab === 'controls' ? 'none' : 'controls')}
        className={`flex-1 py-2 text-center text-[10px] uppercase tracking-[.18em] rounded font-bold cursor-pointer transition-all ${
          mobileTab === 'controls'
            ? 'bg-laser/20 text-laser border border-laser/35'
            : 'text-dim hover:text-ink border border-transparent'
        }`}
      >
        🕹 Controls
      </button>
      <button
        onClick={() => setMobileTab(mobileTab === 'econ' ? 'none' : 'econ')}
        className={`flex-1 py-2 text-center text-[10px] uppercase tracking-[.18em] rounded font-bold cursor-pointer transition-all ${
          mobileTab === 'econ'
            ? 'bg-laser/20 text-laser border border-laser/35'
            : 'text-dim hover:text-ink border border-transparent'
        }`}
      >
        💰 Econ
      </button>
      {selectedIdx >= 0 && (
        <button
          onClick={() => setMobileTab('none')}
          className={`flex-1 py-2 text-center text-[10px] uppercase tracking-[.18em] rounded font-bold cursor-pointer border border-solar/40 bg-solar/15 text-solar animate-pulse`}
        >
          🛰 Satellite
        </button>
      )}
    </Panel>
  );
}

/**
 * DOM HUD overlay — sits above the Canvas. The container is pointer-events-none
 * so the scene stays interactive; individual panels re-enable pointer events.
 * Photo mode fades all chrome except the minimal photo strip.
 */
export function Hud() {
  const photoMode = useSimStore((s) => s.photoMode);
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-display text-ink">
      <Shortcuts />
      <PermalinkSync />
      <div
        className={
          'transition-opacity duration-500 ' +
          (photoMode ? 'pointer-events-none opacity-0' : 'opacity-100')
        }
      >
        <TopBar />
        <Toaster />
        <TelemetryPanel />
        <VehiclePanel />
        <EconPanel />
        <PartLabels />
        <StationLabels />
        <TrainingPanel />
        <SatCard />
        <MissionStrip />
        <ConjunctionBanner />
        <RoadmapBar />
        <ControlDock />
        <MobileNav />
        <BadgeRail />
        <AssetChip />
        <InfoModal />
        <IntroOverlay />
      </div>
      <PhotoMode />
    </div>
  );
}

