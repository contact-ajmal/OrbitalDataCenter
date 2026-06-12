import { useEffect, useRef, useState } from 'react';
import { Label, Panel } from './ui';
import { telemetry } from '../state/telemetry';
import { useUiStore } from '../state/ui';
import { useEconStore, launchTally } from '../state/econ';
import {
  crossoverLaunchCost,
  fleetRevenuePerMonth,
  launchCost,
  orbitalCost,
  terrestrialCost,
} from '../sim/economics';

const CW = 240;
const CH = 90;

function Stepper({
  label,
  value,
  step,
  min,
  max,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center justify-between py-0.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(clamp(value - step))}
          title={`Decrease ${label}`}
          className="pointer-events-auto h-4 w-4 rounded border border-white/15 text-[10px] leading-none text-dim hover:text-ink"
        >
          −
        </button>
        <span className="w-16 text-right font-mono text-[10px] tabular-nums text-ink">
          {fmt(value)}
        </span>
        <button
          onClick={() => onChange(clamp(value + step))}
          title={`Increase ${label}`}
          className="pointer-events-auto h-4 w-4 rounded border border-white/15 text-[10px] leading-none text-dim hover:text-ink"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function EconPanel() {
  const econOpen = useUiStore((s) => s.econOpen);
  const params = useEconStore((s) => s.params);
  const setParam = useEconStore((s) => s.setParam);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);

  // poll telemetry for uptime + tally
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const uptime = Math.max(0.05, telemetry.sunlitFrac);
  const orbital = orbitalCost(params, uptime);
  const terrestrial = terrestrialCost(params);
  const crossover = crossoverLaunchCost(params, uptime);
  const revenue = fleetRevenuePerMonth(telemetry.count);
  const tallyCost = launchTally.count * launchCost(params);

  // chart: $/GPU-hr vs launch $/kg
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = CW * dpr;
    c.height = CH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);

    const maxLaunch = 1500;
    const maxCost = Math.max(terrestrial, orbitalCost({ ...params, launchCostPerKg: maxLaunch }, uptime)) * 1.1;
    const x = (l: number) => (l / maxLaunch) * CW;
    const y = (cost: number) => CH - 4 - (cost / maxCost) * (CH - 12);

    // terrestrial flat line
    ctx.strokeStyle = 'rgba(255,181,84,0.85)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, y(terrestrial));
    ctx.lineTo(CW, y(terrestrial));
    ctx.stroke();

    // orbital curve
    ctx.strokeStyle = 'rgba(82,215,255,0.95)';
    ctx.beginPath();
    for (let l = 0; l <= maxLaunch; l += 30) {
      const cost = orbitalCost({ ...params, launchCostPerKg: l }, uptime);
      const px = x(l);
      const py = y(cost);
      if (l === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // crossover marker
    if (crossover > 0 && crossover < maxLaunch) {
      ctx.strokeStyle = 'rgba(93,255,176,0.8)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x(crossover), 0);
      ctx.lineTo(x(crossover), CH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // TODAY marker
    ctx.fillStyle = 'rgba(232,241,248,0.9)';
    ctx.font = '7px monospace';
    ctx.fillText('TODAY', Math.min(CW - 30, x(params.launchCostPerKg) + 2), 9);
    ctx.fillStyle = 'rgba(82,215,255,1)';
    ctx.beginPath();
    ctx.arc(x(params.launchCostPerKg), y(orbital), 2.5, 0, Math.PI * 2);
    ctx.fill();
    // STARSHIP TARGET annotation
    ctx.fillStyle = 'rgba(110,130,150,0.9)';
    ctx.fillText('STARSHIP →', 2, CH - 2);
  }, [params, uptime, orbital, terrestrial, crossover]);

  const fmtUsd = (v: number) => `$${v.toFixed(2)}`;

  const mobileTab = useUiStore((s) => s.mobileTab);
  const show = mobileTab === 'econ';

  if (!econOpen && !show) return null;

  const displayClass = show
    ? 'flex flex-col'
    : econOpen
      ? 'hidden hud:flex hud:flex-col'
      : 'hidden';

  return (
    <Panel
      className={`absolute left-1/2 -translate-x-1/2 bottom-16 w-[92vw] max-w-[340px] max-h-[60vh] overflow-y-auto p-3 transition-all duration-300 border-white/15 backdrop-blur-lg hud:left-auto hud:right-3 hud:translate-x-0 hud:top-12 hud:bottom-auto hud:w-[256px] hud:max-h-none ${displayClass}`}
    >
      <div className="mb-2 border-b border-white/8 pb-2">
        <Label>Compute Economics</Label>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex-1 rounded border border-laser/30 bg-laser/5 p-2">
          <div className="text-[8px] uppercase tracking-[.18em] text-laser">Orbital</div>
          <div className="font-mono text-[16px] tabular-nums text-laser">{fmtUsd(orbital)}</div>
          <div className="text-[8px] text-dim">/GPU-hr</div>
        </div>
        <div className="flex-1 rounded border border-solar/30 bg-solar/5 p-2">
          <div className="text-[8px] uppercase tracking-[.18em] text-solar">Terrestrial</div>
          <div className="font-mono text-[16px] tabular-nums text-solar">{fmtUsd(terrestrial)}</div>
          <div className="text-[8px] text-dim">/GPU-hr</div>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: CW, height: CH }} className="mt-2 w-full" />

      <div className="mt-1 flex items-baseline justify-between">
        <Label>Crossover</Label>
        <span className="font-mono text-[10px] tabular-nums text-ok">
          ${Math.round(crossover)}/kg
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <Label>Revenue @ fleet</Label>
        <span className="font-mono text-[10px] tabular-nums text-ink">
          ${(revenue / 1e6).toFixed(0)}M/mo
        </span>
      </div>

      <div className="mt-2 border-t border-white/8 pt-2">
        <Stepper
          label="Launch $/kg"
          value={params.launchCostPerKg}
          step={50}
          min={100}
          max={1500}
          fmt={(v) => `$${v}`}
          onChange={(v) => setParam('launchCostPerKg', v)}
        />
        <Stepper
          label="DC capex $/kW"
          value={params.dcCapexPerKW}
          step={1000}
          min={4000}
          max={20000}
          fmt={(v) => `$${(v / 1000).toFixed(0)}k`}
          onChange={(v) => setParam('dcCapexPerKW', v)}
        />
        <Stepper
          label="Power $/kWh"
          value={params.powerPerKWh}
          step={0.01}
          min={0.02}
          max={0.3}
          fmt={(v) => `$${v.toFixed(2)}`}
          onChange={(v) => setParam('powerPerKWh', Number(v.toFixed(2)))}
        />
      </div>

      <div className="mt-2 border-t border-white/8 pt-2">
        <div className="text-[9px] uppercase tracking-[.14em] text-dim">
          Launches this session: {launchTally.count} · ${(tallyCost / 1e6).toFixed(0)}M @ $
          {params.launchCostPerKg}/kg
        </div>
      </div>

      <p className="mt-2 text-[8px] leading-relaxed text-faint">
        Illustrative model — assumptions adjustable above. Revenue anchored to the reported
        $920M/mo Google compute agreement.
      </p>
    </Panel>
  );
}
