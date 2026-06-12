import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { toast } from '../lib/bus';
import { CREDITS } from '../lib/credits';
import { DISCLAIMER } from '../lib/projectInfo';
import { permalinkState } from '../lib/permalink';

export function IntroOverlay() {
  // deep-linked visits skip the intro and confirm the restore
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(permalinkState.sharedRestored);

  useEffect(() => {
    if (permalinkState.sharedRestored) {
      setTimeout(() => toast('SHARED VIEW RESTORED'), 400);
    }
  }, []);

  if (gone) return null;

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => setGone(true), 700);
    // one-time shortcut hint after the intro
    setTimeout(() => toast('PRESS I FOR INFO · R TO RESET VIEW'), 1200);
  };

  return (
    <div
      className={
        'pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center ' +
        'bg-black transition-opacity duration-700 ' +
        (leaving ? 'opacity-0' : 'opacity-100')
      }
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <Logo size={64} />
        <span className="text-[9px] uppercase tracking-[.4em] text-dim">
          SpaceX · xAI · Orbital Datacenter Program
        </span>
        <h1 className="text-3xl font-bold uppercase tracking-[.28em] text-ink hud:text-5xl">
          AI1 Orbital Compute
        </h1>
        <p className="max-w-md text-[11px] leading-relaxed tracking-[.08em] text-dim">
          A constellation of laser-linked compute satellites in sun-synchronous orbit —
          120 kW of GPU per spacecraft, scaling toward one million nodes.
        </p>
        <button
          onClick={dismiss}
          title="Enter the simulation and load UI HUD overlays"
          className="mt-2 rounded border border-laser/70 px-6 py-2.5 text-[10px] uppercase tracking-[.26em] text-laser transition-colors hover:bg-laser/15"
        >
          Initiate Deployment
        </button>
        <span className="text-[9px] uppercase tracking-[.3em] text-faint">
          SIM v1.0 · Unofficial Visualization
        </span>
        <p className="max-w-sm text-[9px] leading-relaxed tracking-[.04em] text-faint">
          {DISCLAIMER}
        </p>
        <span className="text-[9px] tracking-[.12em] text-faint">
          {CREDITS.author} · {CREDITS.location} · {CREDITS.year}
        </span>
      </div>
    </div>
  );
}
