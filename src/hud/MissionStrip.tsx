import { useEffect, useState } from 'react';
import { Panel } from './ui';
import { launch } from '../state/launch';

const PHASES = [
  'COUNTDOWN',
  'IGNITION',
  'LIFTOFF',
  'MAX-Q',
  'HOT-STAGE',
  'STAGE SEP',
  'BOOSTER CATCH',
  'SES-1',
  'SECO',
  'DEPLOY',
  'DEORBIT',
  'OPERATIONAL',
];

function stepIndex(label: string): number {
  if (label.includes('BOOSTER CAUGHT')) return 6;
  if (label.startsWith('T-MINUS')) return 0;
  if (label.startsWith('IGNITION')) return 1;
  if (label.startsWith('LIFTOFF')) return 2;
  if (label.startsWith('MAX-Q')) return 3;
  if (label.startsWith('MECO')) return 4;
  if (label.startsWith('STAGE')) return 5;
  if (label.startsWith('SES')) return 7;
  if (label.startsWith('SECO')) return 8;
  if (label.startsWith('PAYLOAD')) return 9;
  if (label.startsWith('DEORBIT')) return 10;
  if (label.startsWith('PLANE')) return 11;
  return 0;
}

/** Negative missionT = live countdown seconds; positive = elapsed × 32. */
function fmtClock(missionT: number): string {
  if (missionT < 0) {
    const s = Math.ceil(-missionT);
    return `T- 00:${s.toString().padStart(2, '0')}`;
  }
  const s = Math.floor(missionT);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `T+ ${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export function MissionStrip() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  if (!launch.active) return null;
  const label = launch.phaseLabel;
  const activeIdx = stepIndex(label);

  return (
    <Panel className="absolute left-1/2 top-14 max-w-[92vw] -translate-x-1/2 px-4 py-2">
      {/* clock block · divider · current phase */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-start leading-none">
          <span className="text-[8px] uppercase tracking-[.24em] text-dim">
            Mission Elapsed
          </span>
          <span className="mt-0.5 font-mono text-[17px] tabular-nums text-laser">
            {fmtClock(launch.missionT)}
          </span>
        </div>
        <div className="h-8 w-px bg-white/12" />
        <span className="text-[11px] uppercase tracking-[.2em] text-ink">{label}</span>
      </div>

      {/* phase stepper (wide screens only — keeps the strip short on mobile) */}
      <div className="mt-1.5 hidden flex-wrap items-center justify-center gap-1 hud:flex">
        {PHASES.map((p, i) => (
          <span
            key={p}
            className={
              'text-[8px] uppercase tracking-[.14em] ' +
              (i === activeIdx ? 'text-laser' : i < activeIdx ? 'text-dim' : 'text-faint')
            }
          >
            {p}
            {i < PHASES.length - 1 && <span className="px-1 text-faint">›</span>}
          </span>
        ))}
      </div>
    </Panel>
  );
}
