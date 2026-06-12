import { useEffect, useRef, useState } from 'react';
import { useSimStore } from '../state/sim';
import { LABEL_KEYS, labelState, type LabelKey } from '../state/labels';
import { Label, Panel } from './ui';

type SystemKey = 'wing' | 'radiator' | 'compute' | 'bus' | 'laser';

const CHIPS: { key: LabelKey; label: string; system: SystemKey }[] = [
  { key: 'portWing', label: 'Solar Wing · Port', system: 'wing' },
  { key: 'stbdWing', label: 'Solar Wing · Stbd', system: 'wing' },
  { key: 'radiator', label: 'Liquid Radiator', system: 'radiator' },
  { key: 'computeModule', label: 'Compute Module', system: 'compute' },
  { key: 'bus', label: 'Bus / Avionics', system: 'bus' },
  { key: 'laserTerminal', label: 'Laser Terminal', system: 'laser' },
];

const SYSTEMS: { key: SystemKey; title: string; desc: string; chips: LabelKey[] }[] = [
  {
    key: 'wing',
    title: 'Solar Wing',
    desc: '~150 kW array · Starlink V3 cell heritage · ~250 W/m²',
    chips: ['portWing', 'stbdWing'],
  },
  {
    key: 'radiator',
    title: 'Liquid Radiator',
    desc: 'Up to 110 m² · redundant pump loops · micrometeoroid shielding',
    chips: ['radiator'],
  },
  {
    key: 'compute',
    title: 'Compute Module',
    desc: '120 kW avg / 150 kW peak · ≈ one GB300 rack · swappable payload',
    chips: ['computeModule'],
  },
  {
    key: 'bus',
    title: 'Bus / Avionics',
    desc: '70 kW/ton · ≈2.14 t/sat · 70 m deployed span',
    chips: ['bus'],
  },
  {
    key: 'laser',
    title: 'Laser Terminal',
    desc: 'Laser inter-satellite links · no RF mesh',
    chips: ['laserTerminal'],
  },
];

export function PartLabels() {
  const inspect = useSimStore((s) => s.viewMode === 'inspect');
  const [hover, setHover] = useState<SystemKey | null>(null);

  const chipRefs = useRef<Partial<Record<LabelKey, HTMLDivElement | null>>>({});
  const rowRefs = useRef<Partial<Record<SystemKey, HTMLDivElement | null>>>({});
  const lineRef = useRef<SVGLineElement>(null);
  const tickLRef = useRef<SVGLineElement>(null);
  const tickRRef = useRef<SVGLineElement>(null);
  const rulerPillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inspect) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!labelState.active) return;

      // chips
      for (const key of LABEL_KEYS) {
        const el = chipRefs.current[key];
        if (!el) continue;
        const p = labelState.pts[key];
        if (!p.vis) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.opacity = p.op.toFixed(3);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      }

      // systems rows dim when none of their chips are visible
      for (const sys of SYSTEMS) {
        const el = rowRefs.current[sys.key];
        if (!el) continue;
        const anyVis = sys.chips.some((k) => labelState.pts[k].vis);
        el.style.opacity = anyVis ? '1' : '0.4';
      }

      // wingspan ruler
      const L = labelState.tipL;
      const R = labelState.tipR;
      const show = L.vis && R.vis;
      const line = lineRef.current;
      const tl = tickLRef.current;
      const tr = tickRRef.current;
      const pill = rulerPillRef.current;
      if (line && tl && tr && pill) {
        if (!show) {
          line.style.opacity = '0';
          tl.style.opacity = '0';
          tr.style.opacity = '0';
          pill.style.opacity = '0';
        } else {
          const y = Math.max(L.y, R.y) + 46;
          line.setAttribute('x1', String(L.x));
          line.setAttribute('y1', String(y));
          line.setAttribute('x2', String(R.x));
          line.setAttribute('y2', String(y));
          line.style.opacity = '1';
          tl.setAttribute('x1', String(L.x));
          tl.setAttribute('y1', String(y - 6));
          tl.setAttribute('x2', String(L.x));
          tl.setAttribute('y2', String(y + 6));
          tl.style.opacity = '1';
          tr.setAttribute('x1', String(R.x));
          tr.setAttribute('y1', String(y - 6));
          tr.setAttribute('x2', String(R.x));
          tr.setAttribute('y2', String(y + 6));
          tr.style.opacity = '1';
          pill.style.transform = `translate(${(L.x + R.x) / 2}px, ${y}px) translate(-50%, -50%)`;
          pill.style.opacity = '1';
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inspect]);

  if (!inspect) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* projected part chips */}
      {CHIPS.map((c) => (
        <div
          key={c.key}
          ref={(el) => {
            chipRefs.current[c.key] = el;
          }}
          className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center"
          style={{ visibility: 'hidden', opacity: 0, willChange: 'transform, opacity' }}
          onMouseEnter={() => setHover(c.system)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="whitespace-nowrap rounded-sm border border-laser/40 bg-black/80 px-2 py-0.5 text-[9px] uppercase tracking-[.18em] text-laser">
            {c.label}
          </div>
          <div className="h-[13px] w-px bg-laser/60" />
        </div>
      ))}

      {/* wingspan ruler */}
      <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
        <line ref={lineRef} stroke="var(--color-ink)" strokeWidth={1} opacity={0} />
        <line ref={tickLRef} stroke="var(--color-ink)" strokeWidth={1} opacity={0} />
        <line ref={tickRRef} stroke="var(--color-ink)" strokeWidth={1} opacity={0} />
      </svg>
      <div
        ref={rulerPillRef}
        className="absolute left-0 top-0 whitespace-nowrap rounded-sm border border-white/20 bg-black/80 px-2.5 py-1 text-[9px] uppercase tracking-[.18em] text-ink"
        style={{ opacity: 0, willChange: 'transform' }}
      >
        70 m deployed span — wider than a 747-8 (68.4 m)
      </div>

      {/* systems panel */}
      <Panel className="absolute bottom-28 left-3 w-[268px] p-3">
        <div className="mb-2 border-b border-white/8 pb-2">
          <Label>AI1 // Systems</Label>
        </div>
        <div className="flex flex-col gap-2">
          {SYSTEMS.map((sys) => (
            <div
              key={sys.key}
              ref={(el) => {
                rowRefs.current[sys.key] = el;
              }}
              className={
                'rounded border-l-2 pl-2 transition-colors ' +
                (hover === sys.key ? 'border-laser bg-white/5' : 'border-white/10')
              }
            >
              <div className="font-mono text-[10px] uppercase tracking-[.14em] text-ink">
                {sys.title}
              </div>
              <div className="text-[9px] leading-snug text-dim">{sys.desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
