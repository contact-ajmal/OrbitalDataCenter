import { TopBar } from './TopBar';
import { TelemetryPanel } from './TelemetryPanel';
import { VehiclePanel } from './VehiclePanel';
import { ControlDock } from './ControlDock';
import { Ticker } from './Ticker';
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
        <BadgeRail />
        <Ticker />
        <AssetChip />
        <InfoModal />
        <IntroOverlay />
      </div>
      <PhotoMode />
    </div>
  );
}
