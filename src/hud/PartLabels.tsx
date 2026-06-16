import { useEffect, useRef } from 'react';
import { useSimStore } from '../state/sim';
import { LABEL_KEYS, labelState, type LabelKey } from '../state/labels';
import { Label, Panel } from './ui';
import { useUiStore, type SystemKey } from '../state/ui';

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

const COMPONENT_DETAILS: Record<SystemKey, {
  title: string;
  subtitle: string;
  specs: { label: string; value: string }[];
  description: string;
  link: { text: string; url: string };
}> = {
  wing: {
    title: 'Solar Array Wing',
    subtitle: 'PHOTOVOLTAIC GENERATION SYSTEM',
    specs: [
      { label: 'Generation Peak', value: '150 kW @ 1 AU' },
      { label: 'Cell Technology', value: 'Multi-junction GaAs' },
      { label: 'Total Surface Area', value: '112 m² (deployed)' },
      { label: 'PDU Efficiency', value: '98.5% (MPPT regulated)' },
    ],
    description: 'Deploys dual solar array wings spanning 70 meters. Utilizes 3rd-generation multi-junction gallium arsenide cells to achieve over 32% conversion efficiency. Controlled by active dual-axis gimbals tracking the Sun vector, providing regulated 800V DC power to the main power bus.',
    link: { text: 'NASA Space Power Systems', url: 'https://www.nasa.gov/smallsat-institute/space-power' },
  },
  radiator: {
    title: 'Dual-Loop Radiator',
    subtitle: 'DIELECTRIC COOLING & REJECTION',
    specs: [
      { label: 'Thermal Capacity', value: '110 kW at 300K' },
      { label: 'Coolant Media', value: 'Galden HT-110 Fluid' },
      { label: 'Radiator Surface', value: '110 m² double-sided' },
      { label: 'MMOD Protection', value: 'Whipple Shield Bumper' },
    ],
    description: 'Rejects heat from the high-density compute payload. Low-viscosity Galden fluid is pumped through micro-channel cold plates mounted directly to the TPUs, transferring heat to the outer panels where it is radiated into the 3K vacuum of deep space.',
    link: { text: 'Wikipedia: Spacecraft Thermal Control', url: 'https://en.wikipedia.org/wiki/Spacecraft_thermal_control' },
  },
  compute: {
    title: 'AI Tensor Compute Node',
    subtitle: 'ORBITAL EXAFLOPS INFERENCE PAYLOAD',
    specs: [
      { label: 'Inference Capacity', value: '8.4 PetaFLOPS (INT8)' },
      { label: 'Operational Power', value: '120 kW (150 kW peak)' },
      { label: 'Optical Backplane', value: '800 Gbps DWDM ring' },
      { label: 'Junction Target', value: '<65°C under full load' },
    ],
    description: 'The primary compute engine hosting custom liquid-cooled Tensor Processing Units (TPUs). Runs real-time orbital mesh routing protocols, satellite swarm neural processing, and edge video intelligence. Optically interconnected with low latency.',
    link: { text: 'Google TPU Architecture Guide', url: 'https://cloud.google.com/tpu/docs/intro-to-tpu' },
  },
  bus: {
    title: 'Core Avionics & Bus',
    subtitle: 'SATELLITE COMMAND & ATTITUDE SYSTEM',
    specs: [
      { label: 'Attitude Accuracy', value: '<0.005° pointing' },
      { label: 'Battery Capacity', value: '45 kWh (Li-S chemistry)' },
      { label: 'ADCS Actuators', value: '4x Reaction Wheel Gimbals' },
      { label: 'Avionics Link', value: 'Dual-active SpaceWire' },
    ],
    description: 'The structural core of the spacecraft. Houses the Guidance, Navigation, and Control (GNC) flight computer, high-capacity Lithium-Sulfur batteries for eclipse operations, and reaction wheels/magnetorquers for 3-axis pointing control.',
    link: { text: 'Wikipedia: Spacecraft Bus', url: 'https://en.wikipedia.org/wiki/Spacecraft_bus' },
  },
  laser: {
    title: 'Coherent Laser Link',
    subtitle: 'INTER-SATELLITE MESH CONNECTIVITY',
    specs: [
      { label: 'Duplex Throughput', value: '100 Gbps per terminal' },
      { label: 'Operational Range', value: 'Up to 5,500 km' },
      { label: 'Acquisition Precision', value: '±2 microradians dynamic' },
      { label: 'Carrier Frequency', value: '1550 nm DWDM' },
    ],
    description: 'Establishes high-bandwidth optical inter-satellite links. Coarse gimbal drive and fast steering mirrors ensure precise dynamic lock with adjacent nodes, creating an orbital mesh network immune to RF jamming and spectrum constraints.',
    link: { text: 'Wikipedia: Laser Space Comm', url: 'https://en.wikipedia.org/wiki/Laser_communication_in_space' },
  },
};

const systemToLabelKey = (sys: SystemKey): LabelKey => {
  if (sys === 'wing') {
    return labelState.pts.portWing.vis ? 'portWing' : 'stbdWing';
  }
  if (sys === 'compute') return 'computeModule';
  if (sys === 'laser') return 'laserTerminal';
  return sys; // radiator, bus match
};

export function PartLabels() {
  const inspect = useSimStore((s) => s.viewMode === 'inspect');
  
  const hoveredComponent = useUiStore((s) => s.hoveredComponent);
  const inspectComponent = useUiStore((s) => s.inspectComponent);
  const setHoveredComponent = useUiStore((s) => s.setHoveredComponent);
  const setInspectComponent = useUiStore((s) => s.setInspectComponent);

  const chipRefs = useRef<Partial<Record<LabelKey, HTMLDivElement | null>>>({});
  const rowRefs = useRef<Partial<Record<SystemKey, HTMLDivElement | null>>>({});
  const lineRef = useRef<SVGLineElement>(null);
  const tickLRef = useRef<SVGLineElement>(null);
  const tickRRef = useRef<SVGLineElement>(null);
  const rulerPillRef = useRef<HTMLDivElement>(null);

  const detailCardRef = useRef<HTMLDivElement>(null);
  const leaderLinePathRef = useRef<SVGPathElement>(null);

  // Clear selections when exiting inspect mode
  useEffect(() => {
    if (!inspect) {
      setInspectComponent(null);
      setHoveredComponent(null);
    }
  }, [inspect, setInspectComponent, setHoveredComponent]);

  useEffect(() => {
    if (!inspect) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!labelState.active) return;

      // chips position projection
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

      // Dynamic Component detail card position & jointed leader line
      const detailCard = detailCardRef.current;
      const pathEl = leaderLinePathRef.current;
      const currentInspect = useUiStore.getState().inspectComponent;

      if (currentInspect && window.innerWidth >= 900) {
        const activeLabelKey = systemToLabelKey(currentInspect);
        const pt = labelState.pts[activeLabelKey];

        if (detailCard && pathEl && pt) {
          if (!pt.vis || pt.op < 0.1) {
            detailCard.style.opacity = '0';
            detailCard.style.visibility = 'hidden';
            pathEl.style.opacity = '0';
          } else {
            const cardWidth = 300;
            const isLeft = pt.x < window.innerWidth / 2;
            let targetX = pt.x + (isLeft ? 90 : -cardWidth - 90);
            let targetY = pt.y - 120;

            // clamp coordinates inside viewport margins
            targetX = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, targetX));
            targetY = Math.max(120, Math.min(window.innerHeight - 340 - 16, targetY));

            detailCard.style.visibility = 'visible';
            detailCard.style.opacity = pt.op.toFixed(3);
            detailCard.style.transform = `translate(${targetX}px, ${targetY}px)`;

            // Draw jointed laser dashed leader line from dot to card edge
            const startX = pt.x;
            const startY = pt.y;
            const midX = pt.x + (isLeft ? 30 : -30);
            const midY = pt.y - 20;
            const endX = isLeft ? targetX : targetX + cardWidth;
            const endY = targetY + 60;

            pathEl.setAttribute('d', `M ${startX} ${startY} L ${midX} ${midY} L ${endX} ${endY}`);
            pathEl.style.opacity = pt.op.toFixed(3);
          }
        }
      } else {
        // Reset styles for mobile positioning or when cleared
        if (detailCard) {
          detailCard.style.transform = '';
          detailCard.style.opacity = currentInspect ? '1' : '0';
          detailCard.style.visibility = currentInspect ? 'visible' : 'hidden';
        }
        if (pathEl) {
          pathEl.style.opacity = '0';
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inspect]);

  if (!inspect) return null;

  const activeDetail = inspectComponent ? COMPONENT_DETAILS[inspectComponent] : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* projected part chips */}
      {CHIPS.map((c) => (
        <div
          key={c.key}
          ref={(el) => {
            chipRefs.current[c.key] = el;
          }}
          className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center cursor-pointer group"
          style={{ visibility: 'hidden', opacity: 0, willChange: 'transform, opacity' }}
          onMouseEnter={() => setHoveredComponent(c.system)}
          onMouseLeave={() => setHoveredComponent(null)}
          onClick={(e) => {
            e.stopPropagation();
            setInspectComponent(inspectComponent === c.system ? null : c.system);
          }}
        >
          <div className={`whitespace-nowrap rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-[.18em] transition-all ${
            inspectComponent === c.system
              ? 'border-laser bg-laser/25 text-white shadow-[0_0_10px_rgba(82,215,255,0.4)]'
              : hoveredComponent === c.system
              ? 'border-laser/80 bg-laser/10 text-laser'
              : 'border-laser/40 bg-black/80 text-laser hover:border-laser hover:text-laser'
          }`}>
            {c.label}
          </div>
          <div className={`h-[13px] w-px transition-colors ${
            hoveredComponent === c.system || inspectComponent === c.system
              ? 'bg-laser'
              : 'bg-laser/60'
          }`} />
        </div>
      ))}

      {/* wingspan ruler & component leader line */}
      <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
        <line ref={lineRef} stroke="var(--color-ink)" strokeWidth={1} opacity={0} />
        <line ref={tickLRef} stroke="var(--color-ink)" strokeWidth={1} opacity={0} />
        <line ref={tickRRef} stroke="var(--color-ink)" strokeWidth={1} opacity={0} />
        {/* Jointed high-tech dynamic leader line */}
        <path
          ref={leaderLinePathRef}
          fill="none"
          stroke="var(--color-laser)"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          opacity={0}
          style={{ willChange: 'opacity, d' }}
        />
      </svg>
      <div
        ref={rulerPillRef}
        className="absolute left-0 top-0 whitespace-nowrap rounded-sm border border-white/20 bg-black/80 px-2.5 py-1 text-[9px] uppercase tracking-[.18em] text-ink"
        style={{ opacity: 0, willChange: 'transform' }}
      >
        70 m deployed span — wider than a 747-8 (68.4 m)
      </div>

      {/* systems panel */}
      <Panel className="absolute bottom-28 left-3 w-[268px] p-3 max-hud:bottom-[calc(16px+3rem)] max-hud:left-1/2 max-hud:-translate-x-1/2 max-hud:w-[92vw] max-hud:max-w-[480px]">
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
              onClick={() => setInspectComponent(inspectComponent === sys.key ? null : sys.key)}
              onMouseEnter={() => setHoveredComponent(sys.key)}
              onMouseLeave={() => setHoveredComponent(null)}
              className={
                'rounded border-l-2 pl-2 py-1 transition-all cursor-pointer ' +
                (inspectComponent === sys.key
                  ? 'border-laser bg-laser/10 text-white shadow-[inset_1px_0_10px_rgba(82,215,255,0.08)]'
                  : hoveredComponent === sys.key
                  ? 'border-laser/70 bg-white/5 text-ink'
                  : 'border-white/10 text-dim'
                )
              }
            >
              <div className="font-mono text-[10px] uppercase tracking-[.14em]">
                {sys.title}
              </div>
              <div className="text-[9px] leading-snug text-dim">{sys.desc}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Component detailed specification overlay */}
      {activeDetail && (
        <div
          ref={detailCardRef}
          className="pointer-events-auto absolute z-20 transition-opacity duration-300 max-hud:fixed max-hud:bottom-20 max-hud:left-1/2 max-hud:-translate-x-1/2 max-hud:w-[92vw] max-hud:max-w-[480px] max-hud:z-30"
          style={{ opacity: 0, visibility: 'hidden', willChange: 'transform, opacity' }}
        >
          <Panel className="w-[300px] flex flex-col p-3 border-laser/25 shadow-[0_4px_30px_rgba(82,215,255,0.15)] max-hud:w-[92vw] max-hud:max-w-[480px]">
            <div className="flex justify-between items-start border-b border-white/10 pb-1.5 mb-2">
              <div>
                <div className="font-mono text-[11px] font-bold text-laser tracking-wide uppercase">
                  {activeDetail.title}
                </div>
                <div className="text-[8px] text-dim tracking-[.15em] uppercase">
                  {activeDetail.subtitle}
                </div>
              </div>
              <button
                onClick={() => setInspectComponent(null)}
                className="text-dim hover:text-ink text-[12px] leading-none p-1 border border-white/10 hover:border-white/20 rounded cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1 mb-2.5">
              {activeDetail.specs.map((spec, i) => (
                <div key={i} className="flex justify-between items-baseline py-0.5 border-b border-white/5 font-mono text-[9px]">
                  <span className="text-dim uppercase tracking-wider">{spec.label}</span>
                  <span className="text-ink text-right">{spec.value}</span>
                </div>
              ))}
            </div>

            <div className="text-[9px] leading-relaxed text-dim mb-3">
              {activeDetail.description}
            </div>

            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <a
                href={activeDetail.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] uppercase tracking-wider text-laser hover:text-white flex items-center gap-1 font-mono transition-colors"
              >
                <span>🔗 Docs:</span>
                <span className="underline decoration-laser/30 hover:decoration-white">{activeDetail.link.text}</span>
              </a>
              <div className="w-1.5 h-1.5 rounded-full bg-laser animate-pulse-dot" style={{ backgroundColor: 'var(--color-laser)' }} />
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
