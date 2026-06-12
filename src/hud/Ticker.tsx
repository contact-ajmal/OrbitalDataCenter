const FACTS: string[] = [
  'FCC FILING: UP TO 1,000,000 SATELLITES',
  'TWO PROTOTYPES TARGETED EARLY 2027',
  'GIGASAT FACTORY · BASTROP TX · 11M SQ FT',
  '1 GW/YR SPACE COMPUTE BY LATE 2027',
  'STARSHIP THROUGHPUT TARGET 1M T/YR',
  'TERAFAB GOAL: 1 TW OF CHIPS PER YEAR',
  '$920M/MONTH GOOGLE COMPUTE DEAL',
  'ARCHITECTURE SIMPLER THAN STARLINK',
  'PAYLOAD: NVIDIA RUBIN / GB300 · TPU PLANNED',
  'TARGET: LOWEST-COST COMPUTE WITHIN 2–3 YEARS',
];

import { CREDITS } from '../lib/credits';
import { useUiStore } from '../state/ui';

function Row() {
  return (
    <div className="flex shrink-0 items-center">
      {FACTS.map((f) => (
        <span key={f} className="flex items-center">
          <span className="px-6 text-[9px] uppercase tracking-[.22em] text-dim">{f}</span>
          <span className="text-laser/60">◆</span>
        </span>
      ))}
    </div>
  );
}

export function Ticker() {
  const openInfo = useUiStore((s) => s.openInfo);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden border-t border-white/8 bg-black/55 py-1.5 backdrop-blur-sm">
      <div className="animate-marquee flex w-max">
        <Row />
        <Row />
      </div>
      {/* persistent author mark (opens the Credits tab) */}
      <button
        onClick={() => openInfo('credits')}
        className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 px-2 font-mono text-[8px] tracking-[.1em] text-faint hover:text-dim"
      >
        SIM BY {CREDITS.author.toUpperCase()} · {CREDITS.year}
      </button>
    </div>
  );
}
