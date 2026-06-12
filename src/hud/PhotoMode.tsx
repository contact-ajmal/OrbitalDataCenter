import { useState } from 'react';
import { emit } from '../lib/bus';
import { useSimStore } from '../state/sim';

/** Chrome-free photo mode: optional thirds grid + 2.39:1 letterbox + capture. */
export function PhotoMode() {
  const photoMode = useSimStore((s) => s.photoMode);
  const setPhotoMode = useSimStore((s) => s.setPhotoMode);
  const [grid, setGrid] = useState(false);
  const [letterbox, setLetterbox] = useState(false);

  if (!photoMode) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 2.39:1 letterbox bars */}
      {letterbox && (
        <>
          <div
            className="absolute inset-x-0 top-0 bg-black"
            style={{ height: 'max(0px, calc((100vh - 100vw / 2.39) / 2))' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-black"
            style={{ height: 'max(0px, calc((100vh - 100vw / 2.39) / 2))' }}
          />
        </>
      )}

      {/* rule-of-thirds grid */}
      {grid && (
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
          <line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="rgba(255,255,255,0.25)" />
          <line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="rgba(255,255,255,0.25)" />
          <line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="rgba(255,255,255,0.25)" />
          <line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="rgba(255,255,255,0.25)" />
        </svg>
      )}

      {/* minimal bottom strip */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-md">
        <button
          onClick={() => setGrid((g) => !g)}
          className={
            'rounded border px-2.5 py-1 text-[9px] uppercase tracking-[.16em] transition-colors ' +
            (grid ? 'border-laser bg-laser/20 text-laser' : 'border-white/15 text-dim hover:text-ink')
          }
        >
          Grid
        </button>
        <button
          onClick={() => setLetterbox((l) => !l)}
          className={
            'rounded border px-2.5 py-1 text-[9px] uppercase tracking-[.16em] transition-colors ' +
            (letterbox ? 'border-laser bg-laser/20 text-laser' : 'border-white/15 text-dim hover:text-ink')
          }
        >
          2.39:1
        </button>
        <button
          onClick={() => emit('snapshot', Date.now())}
          className="rounded border border-laser/70 px-3 py-1 text-[9px] uppercase tracking-[.18em] text-laser hover:bg-laser/15"
        >
          Capture
        </button>
        <button
          onClick={() => setPhotoMode(false)}
          className="rounded border border-white/20 px-2.5 py-1 text-[9px] uppercase tracking-[.16em] text-dim hover:text-ink"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
