import { useEffect, useState } from 'react';
import { Label, Panel, Stat } from './ui';
import { ORBITAL_V_KMS, PERIOD_MIN, SCENE } from '../lib/constants';
import { telemetry } from '../state/telemetry';
import { network } from '../state/network';
import { useSimStore } from '../state/sim';
import { thermalCss } from '../scene/thermalPalette';
import { buildLinks } from '../sim/links';
import { emit, toast } from '../lib/bus';
import { STATIONS } from '../lib/stations';
import { useUiStore } from '../state/ui';

const KM_PER_UNIT = 63.71;

type Card = {
  plane: number;
  slot: number;
  altKm: number;
  eclipsed: boolean;
  stormHit: boolean;
  load: number;
  temp: number;
  links: number;
  deorbiting: boolean;
  burned: boolean;
  downlinkStation: number;
  stationWeather: 'clear' | 'cloudy' | null;
  lunarRelay: boolean;
  radiationZone: boolean;
};

function read(i: number): Card | null {
  if (i < 0 || i >= telemetry.count) return null;
  const x = telemetry.satWorld[i * 3] ?? 0;
  const y = telemetry.satWorld[i * 3 + 1] ?? 0;
  const z = telemetry.satWorld[i * 3 + 2] ?? 0;
  const radius = Math.hypot(x, y, z);
  const eclipsed = telemetry.eclipsed[i] === 1;
  const stormHit = telemetry.stormHit[i] === 1;
  const sat = network.sats[i];

  const downlinkStation = telemetry.satDownlinkStation[i] ?? -1;
  let stationWeather: 'clear' | 'cloudy' | null = null;
  if (downlinkStation >= 0) {
    const weatherSim = useUiStore.getState().weatherSim;
    const isCloudy = weatherSim && (Math.sin(telemetry.simT * 0.2 + downlinkStation * 1.5) > 0.0);
    stationWeather = isCloudy ? 'cloudy' : 'clear';
  }

  const lunarRelay = telemetry.lunarRelayIdx === i;
  const radiationZone = telemetry.satRadiation[i] === 1;

  return {
    plane: sat?.plane ?? 0,
    slot: sat?.slot ?? 0,
    altKm: (radius - SCENE.EARTH_R) * KM_PER_UNIT,
    eclipsed,
    stormHit,
    load: stormHit ? 2 + (i % 3) : eclipsed ? 4 + (i % 4) : 88 + (i % 10),
    temp: stormHit ? -12 : eclipsed ? -41 : 58,
    links: network.adj[i]?.length ?? 0,
    deorbiting: !!sat?.deorbiting,
    burned: !!sat?.burned,
    downlinkStation,
    stationWeather,
    lunarRelay,
    radiationZone,
  };
}

/** Static top-view schematic of the AI1 (pure SVG, themed with tokens). */
function SatSchematic() {
  const gridX = [14, 22, 30, 38, 46, 54, 62, 70, 78];
  const gridY = [30, 38, 46];
  const wing = (x0: number) => (
    <g>
      <rect x={x0} y={26} width={76} height={26} fill="#16306e" rx={1.5} />
      {gridX.map((gx) => (
        <line
          key={`v${x0}-${gx}`}
          x1={x0 + (gx - 6)}
          y1={26}
          x2={x0 + (gx - 6)}
          y2={52}
          stroke="rgba(140,180,255,0.35)"
          strokeWidth={0.5}
        />
      ))}
      {gridY.map((gy) => (
        <line
          key={`h${x0}-${gy}`}
          x1={x0}
          y1={gy}
          x2={x0 + 76}
          y2={gy}
          stroke="rgba(140,180,255,0.35)"
          strokeWidth={0.5}
        />
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 220 78" className="mb-2 w-full" style={{ display: 'block' }}>
      {/* solar wings */}
      {wing(4)}
      {wing(140)}
      {/* yoke arms */}
      <line x1={80} y1={39} x2={92} y2={39} stroke="var(--color-dim)" strokeWidth={1.5} />
      <line x1={128} y1={39} x2={140} y2={39} stroke="var(--color-dim)" strokeWidth={1.5} />
      {/* radiator panels (crossing vertically) */}
      <rect x={100} y={4} width={20} height={22} fill="#e6edf2" opacity={0.9} rx={1} />
      <rect x={100} y={52} width={20} height={22} fill="#e6edf2" opacity={0.9} rx={1} />
      {/* central bus */}
      <rect x={92} y={24} width={36} height={30} fill="var(--color-faint)" rx={2} />
      {/* compute module slot outline */}
      <rect
        x={98}
        y={33}
        width={24}
        height={12}
        fill="none"
        stroke="var(--color-laser)"
        strokeWidth={1}
        rx={1}
      />
      {/* laser terminal dots */}
      <circle cx={95} cy={28} r={2} fill="var(--color-laser)" />
      <circle cx={125} cy={28} r={2} fill="var(--color-laser)" />
      {/* annotations */}
      <g fontFamily="var(--font-mono)" fontSize={6.5} fill="var(--color-dim)">
        <text x={4} y={16}>SOLAR 150 kW</text>
        <text x={84} y={73} textAnchor="middle">70 m SPAN</text>
        <text x={216} y={16} textAnchor="end">RADIATORS 110 m²</text>
      </g>
    </svg>
  );
}

export function SatCard() {
  const i = useSimStore((s) => s.selectedIdx);
  const thermal = useSimStore((s) => s.thermal);
  const setChaseIdx = useSimStore((s) => s.setChaseIdx);
  const setViewMode = useSimStore((s) => s.setViewMode);
  const setSelectedIdx = useSimStore((s) => s.setSelectedIdx);

  const [card, setCard] = useState<Card | null>(() => read(i));

  useEffect(() => {
    if (i < 0) return;
    const id = setInterval(() => setCard(read(i)), 250);
    setCard(read(i));
    return () => clearInterval(id);
  }, [i]);

  if (i < 0 || !card) return null;
  const id = `AI1-${String(i).padStart(4, '0')}`;
  // real altitude for AI1 is ~600 km; show the live value
  return (
    <Panel className="absolute left-1/2 -translate-x-1/2 bottom-16 w-[92vw] max-w-[340px] max-h-[60vh] overflow-y-auto p-3 transition-all duration-300 border-white/15 backdrop-blur-lg hud:left-auto hud:right-3 hud:translate-x-0 hud:bottom-9 hud:w-[230px] hud:max-h-none z-10">
      <div className="mb-2 flex items-center justify-between border-b border-white/8 pb-2">
        <span className="font-mono text-[12px] tracking-[.12em] text-laser">{id}</span>
        <button
          onClick={() => setSelectedIdx(-1)}
          title="Deselect satellite"
          className="pointer-events-auto flex items-center justify-center h-7 w-7 text-[14px] leading-none text-dim hover:text-ink cursor-pointer rounded-full hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <SatSchematic />

      <Stat label="Plane / Slot" value={`${card.plane} / ${card.slot}`} />
      <Stat label="Altitude" value={card.altKm.toFixed(0)} unit="km" />
      <Stat label="Velocity" value={ORBITAL_V_KMS.toFixed(2)} unit="km/s" />
      <Stat label="Period" value={PERIOD_MIN.toFixed(1)} unit="min" />
      <Stat
        label="Status"
        value={card.burned ? 'BURNED UP' : card.deorbiting ? 'DEORBITING' : card.stormHit ? 'SAFE MODE' : card.eclipsed ? 'IN ECLIPSE' : 'SUNLIT'}
        accent={card.burned ? 'text-red-500' : card.deorbiting ? 'text-orange-400' : card.stormHit ? 'text-solar' : card.eclipsed ? 'text-dim' : 'text-solar'}
      />
      <Stat label="Compute load" value={card.load} unit="%" accent="text-laser" />
      <div className="flex items-baseline justify-between gap-3 py-[3px]">
        <Label>Radiator</Label>
        <span className="flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-ink">
          {thermal && (
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor: thermalCss(card.stormHit ? 0.3 : card.eclipsed ? 0.1 : 0.9),
              }}
            />
          )}
          {card.temp > 0 ? '+' : ''}
          {card.temp}
          <span className="text-[9px] text-dim">°C</span>
        </span>
      </div>
      <Stat label="ISL links" value={card.links} />
      {card.lunarRelay && (
        <Stat
          label="Deep-Space Relay"
          value="ACTIVE"
          accent="text-violet-400 font-bold"
        />
      )}
      {card.radiationZone && (
        <Stat
          label="Radiation Belt"
          value="DANGEROUS (ECC Active)"
          accent="text-fuchsia-400 font-bold animate-pulse"
        />
      )}
      {card.downlinkStation >= 0 && (
        <Stat
          label={card.stationWeather === 'cloudy' ? 'Uplink (Cloudy)' : 'Uplink (Clear)'}
          value={`${STATIONS[card.downlinkStation]?.name} @ ${
            card.stationWeather === 'cloudy' ? '100 Mbps RF' : '10 Gbps Laser'
          }`}
          accent={card.stationWeather === 'cloudy' ? 'text-orange-400' : 'text-laser'}
        />
      )}

      <button
        onClick={() => {
          setChaseIdx(i);
          setViewMode('chase');
        }}
        title="Follow this satellite in orbit (Chase View)"
        className="pointer-events-auto mt-3 w-full rounded border border-laser/60 py-1.5 text-[9px] uppercase tracking-[.2em] text-laser transition-colors hover:bg-laser/15"
      >
        ◉ Track This Satellite
      </button>

      {card.burned ? (
        <button
          disabled
          className="pointer-events-auto mt-2 w-full rounded border border-red-500/35 bg-red-500/10 py-1.5 text-[9px] uppercase tracking-[.2em] text-red-400 font-mono"
        >
          ☠ Burned Up
        </button>
      ) : card.deorbiting ? (
        <button
          disabled
          className="pointer-events-auto mt-2 w-full rounded border border-orange-500/35 bg-orange-500/10 py-1.5 text-[9px] uppercase tracking-[.2em] text-orange-400 font-mono"
        >
          ☄ Deorbiting...
        </button>
      ) : (
        <>
          <button
            onClick={() => {
              const sat = network.sats[i];
              if (sat) {
                sat.deorbiting = true;
                toast(`☄ DEORBIT SEQUENCE INITIATED FOR SAT-${i}`);
                const { pairs, adj } = buildLinks(network.sats);
                network.pairs = pairs;
                network.adj = adj;
                setCard((prev) => prev ? { ...prev, deorbiting: true } : null);
              }
            }}
            title="Deorbit this satellite (decays altitude and burns up)"
            className="pointer-events-auto mt-2 w-full rounded border border-orange-500/60 py-1.5 text-[9px] uppercase tracking-[.2em] text-orange-400 transition-colors hover:bg-orange-500/15 cursor-pointer"
          >
            ☄ Deorbit Satellite
          </button>
          
          <button
            onClick={() => {
              emit('asat:trigger', i);
            }}
            title="Launch a kinetic ASAT missile to destroy this satellite"
            className="pointer-events-auto mt-2 w-full rounded border border-red-500/60 py-1.5 text-[9px] uppercase tracking-[.2em] text-red-400 transition-colors hover:bg-red-500/15 cursor-pointer"
          >
            💥 ASAT Kinetic Strike
          </button>
        </>
      )}
    </Panel>
  );
}
