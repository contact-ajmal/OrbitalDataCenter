import { useEffect, useRef } from 'react';
import { stationLabels } from '../state/stationLabels';

/** DOM ground-station name chips, positioned each frame via rAF (no setState). */
export function StationLabels() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (let i = 0; i < stationLabels.pts.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const p = stationLabels.pts[i]!;
        if (!p.vis) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -150%)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      {stationLabels.names.map((name, i) => (
        <div
          key={name}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute left-0 top-0 whitespace-nowrap rounded-sm border border-solar/40 bg-black/70 px-1.5 py-0.5 text-[8px] uppercase tracking-[.18em] text-solar"
          style={{ visibility: 'hidden', opacity: 0, willChange: 'transform' }}
        >
          {name}
        </div>
      ))}
    </div>
  );
}
