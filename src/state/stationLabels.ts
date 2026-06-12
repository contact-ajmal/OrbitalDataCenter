import { STATIONS } from '../lib/stations';

/** Screen-space placement of ground-station name labels (projector → DOM). */
export const stationLabels = {
  names: STATIONS.map((s) => s.name),
  pts: STATIONS.map(() => ({ x: 0, y: 0, vis: false })),
};
