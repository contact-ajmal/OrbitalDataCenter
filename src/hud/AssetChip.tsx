import { useEffect, useState } from 'react';
import { on } from '../lib/bus';

const ORDER = ['8K SURFACE', '16K LIGHTS', 'CLOUDS', 'GAIA', 'MOON'];

/** Bottom-right chip showing progressive texture loads; fades once complete. */
export function AssetChip() {
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    return on('asset:loaded', (name) => {
      setLoaded((prev) => {
        const next = new Set(prev);
        next.add(name);
        if (next.size >= ORDER.length) setTimeout(() => setHidden(true), 3500);
        return next;
      });
    });
  }, []);

  if (hidden || loaded.size === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-16 right-3 rounded border border-white/10 bg-black/65 px-2.5 py-1.5 backdrop-blur-md transition-all duration-300 hud:bottom-9 hud:right-3">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {ORDER.map((name) => {
          const done = loaded.has(name);
          return (
            <span
              key={name}
              className={
                'text-[8px] uppercase tracking-[.16em] ' +
                (done ? 'text-ok' : 'text-faint')
              }
            >
              {name} {done ? '✓' : '…'}
            </span>
          );
        })}
      </div>
    </div>
  );
}
