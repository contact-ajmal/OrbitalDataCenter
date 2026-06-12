import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { useSimStore } from '../state/sim';
import { useUiStore } from '../state/ui';

function utc(): string {
  return new Date().toISOString().slice(11, 19) + 'Z';
}

export function TopBar() {
  const [clock, setClock] = useState(utc);
  const paused = useSimStore((s) => s.paused);
  const openInfo = useUiStore((s) => s.openInfo);
  useEffect(() => {
    const id = setInterval(() => setClock(utc()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
      {/* Wordmark lockup: mark + AI1 + ORBITAL COMPUTE */}
      <div className="flex items-center gap-2.5">
        <Logo size={26} className={paused ? '' : 'animate-logo-pulse'} />
        <div className="flex flex-col leading-none">
          <span className="text-[13px] font-bold uppercase tracking-[.26em] text-ink hud:text-[15px]">
            AI1
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[.3em] text-dim">
            Orbital Compute
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => openInfo('mission')}
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-[11px] text-dim transition-colors hover:border-laser/60 hover:text-laser cursor-pointer"
          title="Mission info"
        >
          ⓘ
        </button>
        <div className="flex items-center gap-2">
          <span className="text-ok animate-pulse-dot inline-block h-[7px] w-[7px] rounded-full bg-ok" />
          <span className="hidden min-[400px]:inline-block text-[9px] uppercase tracking-[.22em] text-dim">Sim Active</span>
        </div>
        <span className="hidden min-[520px]:inline-block font-mono text-[11px] tabular-nums text-ink">{clock}</span>
      </div>
    </div>
  );
}
