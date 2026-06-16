import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, NoToneMapping } from 'three';
import { useSimStore } from '../state/sim';
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
import { AsatDebris } from './AsatDebris';
import { HeroSat } from './HeroSat';
import { Starship } from './Starship';
import { Picker } from './Picker';
import { StationLabelsProjector } from './StationLabelsProjector';
import { SnapshotHandler } from './SnapshotHandler';
import { TourController } from './TourController';
import { CameraRig } from './CameraRig';
import { TrafficPackets } from './TrafficPackets';
import { StormWind } from './StormWind';
import { HeatmapOverlay } from './HeatmapOverlay';
import { ReentryTrails } from './ReentryTrails';

/**
 * Root scene composition. The world (Sky/Sun/Moon/Earth), the fleet, the laser
 * mesh + downlink, and the mode-driven camera rig.
 */
export function Scene() {
  const gl = useThree((s) => s.gl);
  const lowGraphics = useSimStore((s) => s.lowGraphics);

  useEffect(() => {
    gl.toneMapping = lowGraphics ? ACESFilmicToneMapping : NoToneMapping;
  }, [gl, lowGraphics]);

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
      <AsatDebris />
      <VisionShell />
      <HeroSat />
      <Starship />
      <Picker />
      <StationLabelsProjector />
      <SnapshotHandler />
      <TourController />
      <CameraRig />
      
      {/* Advanced Constellation Overlay Features */}
      <TrafficPackets />
      <StormWind />
      <HeatmapOverlay />
      <ReentryTrails />
    </>
  );
}
