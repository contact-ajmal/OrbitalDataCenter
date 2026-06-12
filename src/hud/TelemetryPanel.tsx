import { useEffect, useRef } from 'react';
import { Bar, Label, Panel, Stat } from './ui';
import { fmtInt, fmtPower, fmtTokens } from './format';
import { tokenTarget, useTelemetryPoll } from './useTelemetryPoll';
import { useSimStore } from '../state/sim';
import { starlink } from '../state/starlink';
import { conjunction } from '../state/conjunction';
import { useUiStore } from '../state/ui';

const SPARK_W = 208;
const SPARK_H = 34;
const SPARK_N = 64;

/** Cyan sparkline of throughput, sampled 5×/s and drawn imperatively. */
function Sparkline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buf = useRef<number[]>(new Array(SPARK_N).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SPARK_W * dpr;
    canvas.height = SPARK_H * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const data = buf.current;
      data.push(tokenTarget());
      if (data.length > SPARK_N) data.shift();

      const max = Math.max(1, ...data);
      ctx.clearRect(0, 0, SPARK_W, SPARK_H);

      const xStep = SPARK_W / (SPARK_N - 1);
      const yOf = (v: number) => SPARK_H - 2 - (v / max) * (SPARK_H - 4);

      // gradient fill
      ctx.beginPath();
      ctx.moveTo(0, SPARK_H);
      data.forEach((v, i) => ctx.lineTo(i * xStep, yOf(v)));
      ctx.lineTo((data.length - 1) * xStep, SPARK_H);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, SPARK_H);
      grad.addColorStop(0, 'rgba(82,215,255,0.32)');
      grad.addColorStop(1, 'rgba(82,215,255,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // stroke
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * xStep;
        const y = yOf(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(82,215,255,0.9)';
      ctx.lineWidth = 1.25;
      ctx.stroke();
    };

    const id = setInterval(draw, 200); // 5×/s
    return () => clearInterval(id);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: SPARK_W, height: SPARK_H }}
      className="mt-1 w-full"
    />
  );
}

export function TelemetryPanel() {
  const s = useTelemetryPoll();
  const starlinkOn = useSimStore((st) => st.toggles.starlink);
  const thermal = useSimStore((st) => st.thermal);
  const power = fmtPower(s.computeKW);
  const tok = fmtTokens(s.tokensDisplay);
  const heat = 0.45 + 0.5 * s.sunlitFrac;
  const mobileTab = useUiStore((st) => st.mobileTab);
  const show = mobileTab === 'telemetry';

  return (
    <Panel
      className={`absolute left-1/2 -translate-x-1/2 bottom-16 w-[92vw] max-w-[340px] max-h-[60vh] overflow-y-auto p-3 transition-all duration-300 border-white/15 backdrop-blur-lg hud:left-3 hud:translate-x-0 hud:top-12 hud:bottom-auto hud:w-[248px] hud:max-h-none ${
        show ? 'flex flex-col' : 'hidden hud:flex hud:flex-col'
      }`}
    >
      <div className="mb-2 border-b border-white/8 pb-2">
        <Label>{thermal ? 'Thermal Telemetry' : 'Constellation Telemetry'}</Label>
      </div>

      {thermal && (
        <div className="mb-2 rounded border border-solar/30 bg-solar/5 p-2">
          <Bar label="Heat rejection" value={heat} color="var(--color-solar)" />
        </div>
      )}
      <Stat label="Satellites" value={fmtInt(s.count)} accent="text-laser" />
      <Stat label="Compute" value={power.val} unit={power.unit} />
      <Stat label="GB300-rack equiv" value={fmtInt(s.racks)} />

      <div className="mt-2 border-t border-white/8 pt-2">
        <Stat
          label="Inference"
          value={tok.val}
          unit={`${tok.unit} tok/s`}
          accent="text-laser"
        />
        <Sparkline />
      </div>

      <div className="mt-2 border-t border-white/8 pt-2">
        <Stat
          label="Sunlit fleet"
          value={(s.sunlitFrac * 100).toFixed(0)}
          unit="%"
          accent="text-solar"
        />
        <Stat label="Jobs routed" value={fmtInt(s.jobs)} />
        <Stat label="Avoidance maneuvers" value={fmtInt(conjunction.maneuvers)} />
        <Stat label="Mass on orbit" value={fmtInt(s.massT)} unit="t" />
        {starlinkOn && starlink.loaded && (
          <div className="mt-1 border-t border-white/8 pt-1">
            <Stat label="Starlink (live)" value={fmtInt(starlink.count)} accent="text-ink/80" />
            <div className="text-right text-[8px] uppercase tracking-[.18em] text-faint">
              Elements: {Math.round(starlink.ageHours)} h old
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-white/8 pt-2">
        <Bar label="Solar capture" value={s.sunlitFrac} color="var(--color-solar)" />
        <Bar label="Heat rejection" value={heat} color="var(--color-ok)" />
      </div>
    </Panel>
  );
}
