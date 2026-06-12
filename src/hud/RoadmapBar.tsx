import { useEffect, useRef } from 'react';
import { Panel } from './ui';
import { useSimStore } from '../state/sim';
import { useRoadmapStore } from '../state/roadmap';
import { useEconStore } from '../state/econ';
import {
  MILESTONES,
  YEAR_MAX,
  YEAR_MIN,
  VISION_YEAR,
  eraAt,
  fleetAt,
  launchCostAt,
} from '../lib/roadmap';

const SPAN = YEAR_MAX - YEAR_MIN;
const TICKS = [2027, 2028, 2029, 2030, 2031, 2032];

export function RoadmapBar() {
  const active = useRoadmapStore((s) => s.active);
  const year = useRoadmapStore((s) => s.year);
  const playing = useRoadmapStore((s) => s.playing);
  const setYear = useRoadmapStore((s) => s.setYear);
  const togglePlay = useRoadmapStore((s) => s.togglePlay);

  const setParam = useEconStore((s) => s.setParam);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // year → economics (immediate) + satCount/vision (debounced 300 ms)
  useEffect(() => {
    if (!active) return;
    setParam('launchCostPerKg', launchCostAt(year));
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const st = useSimStore.getState();
      const fleet = fleetAt(year);
      if (fleet === 'vision') {
        if (!st.visionOn) st.setVisionOn(true);
      } else {
        if (st.visionOn) st.setVisionOn(false);
        if (st.satCount !== fleet) st.setSatCount(fleet);
      }
    }, 300);
  }, [year, active, setParam]);

  // play: advance one year per 6 s on real time
  useEffect(() => {
    if (!active || !playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const next = useRoadmapStore.getState().year + dt / 6;
      if (next >= YEAR_MAX) {
        setYear(YEAR_MAX);
        useRoadmapStore.getState().togglePlay();
      } else {
        setYear(next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing, setYear]);

  if (!active) return null;

  const era = eraAt(year);
  const yearToPct = (y: number) => ((y - YEAR_MIN) / SPAN) * 100;
  const visionEngaged = year >= VISION_YEAR;

  const pointerToYear = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return year;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return YEAR_MIN + t * SPAN;
  };

  return (
    <Panel className="absolute bottom-32 left-1/2 w-[min(680px,92vw)] -translate-x-1/2 px-4 py-2.5">
      <div className="mb-2 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded border border-laser/50 text-[11px] text-laser hover:bg-laser/15"
          title={playing ? 'Pause roadmap timeline animation' : 'Play roadmap timeline animation'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="text-[10px] uppercase tracking-[.2em] text-laser">
          ERA: {Math.floor(year)} — {era.label}
        </span>
        {visionEngaged && (
          <span className="rounded bg-laser/20 px-1.5 py-0.5 text-[8px] uppercase tracking-[.16em] text-laser">
            10⁶ Vision
          </span>
        )}
        {era.note && <span className="ml-auto text-[9px] text-dim">{era.note}</span>}
      </div>

      {/* track */}
      <div
        ref={trackRef}
        className="pointer-events-auto relative h-6 cursor-pointer select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setYear(pointerToYear(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) setYear(pointerToYear(e.clientX));
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
      >
        {/* baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
        {/* progress */}
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-laser/60"
          style={{ width: `${yearToPct(year)}%` }}
        />
        {/* milestone diamonds */}
        {MILESTONES.map((m) => (
          <div
            key={m.year}
            className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${yearToPct(m.year)}%` }}
          >
            <div className="h-2 w-2 rotate-45 border border-solar/70 bg-black" />
            <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-1.5 py-0.5 text-[8px] uppercase tracking-[.14em] text-solar group-hover:block">
              {m.label}
            </div>
          </div>
        ))}
        {/* playhead */}
        <div
          className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded bg-laser"
          style={{ left: `${yearToPct(year)}%` }}
        />
      </div>

      {/* year ticks */}
      <div className="mt-1 flex justify-between font-mono text-[8px] tabular-nums text-faint">
        {TICKS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </Panel>
  );
}
