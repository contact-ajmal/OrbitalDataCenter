import { Earth } from './Earth';
import { Sky } from './Sky';
import { SunMoon } from './SunMoon';
import { Constellation } from './Constellation';
import { OrbitRings } from './OrbitRings';
import { Lasers } from './Lasers';
import { Downlink } from './Downlink';
import { JobRouter } from './JobRouter';
import { VisionShell } from './VisionShell';
import { StarlinkOverlay } from './StarlinkOverlay';
import { TrainingViz } from './TrainingViz';
import { DebrisEvent } from './DebrisEvent';
import { HeroSat } from './HeroSat';
import { Starship } from './Starship';
import { Picker } from './Picker';
import { StationLabelsProjector } from './StationLabelsProjector';
import { SnapshotHandler } from './SnapshotHandler';
import { TourController } from './TourController';
import { CameraRig } from './CameraRig';

/**
 * Root scene composition. The world (Sky/Sun/Moon/Earth), the fleet, the laser
 * mesh + downlink, and the mode-driven camera rig.
 */
export function Scene() {
  return (
    <>
      <Sky />
      <SunMoon />
      <Earth />
      <Constellation />
      <OrbitRings />
      <Lasers />
      <Downlink />
      <StarlinkOverlay />
      <JobRouter />
      <TrainingViz />
      <DebrisEvent />
      <VisionShell />
      <HeroSat />
      <Starship />
      <Picker />
      <StationLabelsProjector />
      <SnapshotHandler />
      <TourController />
      <CameraRig />
    </>
  );
}
