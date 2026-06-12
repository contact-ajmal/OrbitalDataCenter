import { useEffect, useRef, useState } from 'react';
import { SAT_KW_AVG, SAT_TONS } from '../lib/constants';
import { telemetry } from '../state/telemetry';
import { useSimStore } from '../state/sim';

/** Projected million-satellite figures shown in 10⁶ vision mode. */
const VISION_SATS = 1_000_000;

export type Snapshot = {
  count: number;
  sunlitFrac: number;
  computeKW: number;
  racks: number;
  tokensDisplay: number; // eased count-up value
  jobs: number;
  massT: number;
};

const TOKENS_PER_SAT = 1.45e6;

/** Instantaneous target throughput (tok/s) with organic sine jitter. */
export function tokenTarget(): number {
  const jitter = 0.92 + 0.08 * Math.sin(performance.now() * 0.0011);
  return telemetry.count * TOKENS_PER_SAT * telemetry.sunlitFrac * jitter;
}

function compute(prevTokens: number): Snapshot {
  const vision = useSimStore.getState().visionOn;
  const count = vision ? VISION_SATS : telemetry.count;
  const target = vision
    ? VISION_SATS * 1.45e6 * telemetry.sunlitFrac
    : tokenTarget();
  return {
    count,
    sunlitFrac: telemetry.sunlitFrac,
    computeKW: count * SAT_KW_AVG, // 1e6 × 120 kW = 120 GW in vision mode
    racks: count,
    tokensDisplay: prevTokens + (target - prevTokens) * 0.25, // ease toward target
    jobs: telemetry.jobsDone,
    massT: count * SAT_TONS, // ≈ 2.14 M t in vision mode
  };
}

/**
 * Poll the telemetry singleton at a fixed interval (default 250 ms = ~4 Hz) and
 * return a derived display snapshot. Deliberately NOT per-frame: the HUD must
 * re-render at ~4 Hz, not 60.
 */
export function useTelemetryPoll(intervalMs = 250): Snapshot {
  const tokRef = useRef(0);
  const [snap, setSnap] = useState<Snapshot>(() => compute(0));

  useEffect(() => {
    const id = setInterval(() => {
      const s = compute(tokRef.current);
      tokRef.current = s.tokensDisplay;
      setSnap(s);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return snap;
}
