import { useEffect, useState } from 'react';
import { useSimStore } from '../state/sim';
import { conjunction, conjunctionTiming } from '../state/conjunction';

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `00:${s.toString().padStart(2, '0')}`;
}

export function ConjunctionBanner() {
  const [, force] = useState(0);
  const chaseIdx = useSimStore((s) => s.chaseIdx);
  const viewMode = useSimStore((s) => s.viewMode);
  const setChaseIdx = useSimStore((s) => s.setChaseIdx);
  const setViewMode = useSimStore((s) => s.setViewMode);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 120);
    return () => clearInterval(id);
  }, []);

  if (!conjunction.active) return null;
  const resolved = conjunction.phase === 'resolved';
  const tca = conjunctionTiming.TCA - conjunction.t;
  const watching = chaseIdx === conjunction.satIdx && (viewMode === 'chase' || viewMode === 'inspect');

  const accent = resolved ? 'border-ok/60 text-ok' : 'border-solar/60 text-solar';

  return (
    <div
      className={
        'pointer-events-auto absolute left-1/2 top-28 -translate-x-1/2 rounded border bg-black/80 px-4 py-2 backdrop-blur-md ' +
        accent
      }
    >
      <div className="flex items-center gap-3">
        <span className="text-[11px]">{resolved ? '✓' : '⚠'}</span>
        {resolved ? (
          <span className="text-[10px] uppercase tracking-[.18em]">
            MISS CONFIRMED — {conjunction.satId} · Δv 0.4 M/S · NEW ALT +2.2 KM
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-[.18em]">
            CONJUNCTION ALERT — {conjunction.satId} · TCA{' '}
            <span className="font-mono tabular-nums">{fmt(tca)}</span> · Pc {conjunction.pc}
          </span>
        )}
        {!resolved && !watching && (
          <button
            onClick={() => {
              setChaseIdx(conjunction.satIdx);
              setViewMode('chase');
            }}
            title="Focus camera and follow the endangered satellite"
            className="pointer-events-auto rounded border border-solar/60 px-2 py-0.5 text-[8px] uppercase tracking-[.16em] text-solar hover:bg-solar/15"
          >
            Watch
          </button>
        )}
      </div>
    </div>
  );
}
