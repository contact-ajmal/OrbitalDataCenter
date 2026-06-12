import { useEffect, useRef, useState } from 'react';
import { Label, Panel } from './ui';
import { SAT_KW_AVG } from '../lib/constants';
import { telemetry } from '../state/telemetry';
import { RUN_STEPS, training } from '../sim/training';
import { useUiStore } from '../state/ui';

const SPARK_W = 200;
const SPARK_H = 34;

function LossSpark() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = SPARK_W * dpr;
    c.height = SPARK_H * dpr;
    ctx.scale(dpr, dpr);
    const draw = () => {
      const data = training.lossHistory;
      ctx.clearRect(0, 0, SPARK_W, SPARK_H);
      if (data.length < 2) return;
      const max = Math.max(...data);
      const min = Math.min(...data);
      const span = Math.max(0.01, max - min);
      const xs = SPARK_W / (RUN_STEPS - 1);
      const yOf = (v: number) => SPARK_H - 2 - ((v - min) / span) * (SPARK_H - 4);
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * xs;
        const y = yOf(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(255,181,84,0.95)';
      ctx.lineWidth = 1.25;
      ctx.stroke();
    };
    const id = setInterval(draw, 150);
    return () => clearInterval(id);
  }, []);
  return <canvas ref={ref} style={{ width: SPARK_W, height: SPARK_H }} className="mt-1 w-full" />;
}

export function TrainingPanel() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 120);
    return () => clearInterval(id);
  }, []);

  const mobileTab = useUiStore((s) => s.mobileTab);
  const show = mobileTab === 'telemetry';

  if (!training.active) return null;
  const effGW = (telemetry.sunlitFrac * telemetry.count * SAT_KW_AVG) / 1e6;

  return (
    <Panel
      className={`absolute left-1/2 -translate-x-1/2 bottom-[330px] w-[92vw] max-w-[340px] p-3 transition-all duration-300 border-white/15 backdrop-blur-lg hud:left-3 hud:translate-x-0 hud:top-[420px] hud:bottom-auto hud:w-[248px] ${
        show ? 'block' : 'hidden hud:block'
      }`}
    >
      <div className="mb-2 flex items-center justify-between border-b border-white/8 pb-2">
        <Label>Distributed Training</Label>
        <span
          className={
            'rounded px-1.5 py-0.5 text-[8px] uppercase tracking-[.14em] ' +
            (training.phase === 'allreduce'
              ? 'bg-laser/20 text-laser'
              : 'bg-white/10 text-dim')
          }
        >
          {training.phase === 'allreduce' ? 'All-Reduce' : 'Compute'}
        </span>
      </div>

      <div className="font-mono text-[12px] tracking-[.06em] text-ink">AI1-FOUNDATION-1</div>
      <div className="mt-1 flex items-baseline justify-between">
        <Label>Step</Label>
        <span className="font-mono text-[12px] tabular-nums text-laser">
          {training.step}/{RUN_STEPS}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <Label>Epoch</Label>
        <span className="font-mono text-[11px] tabular-nums text-ink">{training.epoch}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <Label>Loss</Label>
        <span className="font-mono text-[12px] tabular-nums text-solar">
          {training.loss.toFixed(3)}
        </span>
      </div>
      <LossSpark />
      <div className="mt-2 flex items-baseline justify-between border-t border-white/8 pt-2">
        <Label>Effective compute</Label>
        <span className="font-mono text-[11px] tabular-nums text-ink">{effGW.toFixed(2)} GW</span>
      </div>
    </Panel>
  );
}
