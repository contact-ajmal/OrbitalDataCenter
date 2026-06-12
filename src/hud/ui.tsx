import type { ReactNode } from 'react';

/** Glass panel chrome shared across HUD panels. */
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        'pointer-events-auto rounded-md border border-white/10 bg-black/65 ' +
        'backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)] ' +
        className
      }
    >
      {children}
    </div>
  );
}

/** 9px letterspaced uppercase micro-label. */
export function Label({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        'text-[9px] uppercase tracking-[.22em] text-dim ' + className
      }
    >
      {children}
    </span>
  );
}

/** A label / value telemetry row with tabular numerals. */
export function Stat({
  label,
  value,
  unit,
  accent = 'text-ink',
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <Label>{label}</Label>
      <span className={'font-mono text-[12px] tabular-nums ' + accent}>
        {value}
        {unit && <span className="ml-1 text-[9px] text-dim">{unit}</span>}
      </span>
    </div>
  );
}

/** Labeled progress bar (value 0..1). */
export function Bar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="py-[3px]">
      <div className="mb-1 flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-[9px] tabular-nums text-dim">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Square glyph utility button (pause, snapshot, storm, tour). */
export function UtilBtn({
  glyph,
  on = false,
  onClick,
  title,
}: {
  glyph: string;
  on?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'pointer-events-auto flex h-7 w-7 items-center justify-center rounded border text-[13px] leading-none transition-colors ' +
        (on ? 'border-laser bg-laser/20 text-laser' : 'border-white/15 text-dim hover:text-ink')
      }
    >
      {glyph}
    </button>
  );
}

/** A segmented control. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  accent = 'var(--color-laser)',
}: {
  options: { label: string; value: T; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}) {
  return (
    <div className="pointer-events-auto flex overflow-hidden rounded border border-white/10">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            title={o.title}
            className={
              'px-2.5 py-1 text-[9px] uppercase tracking-[.18em] transition-colors ' +
              (active ? 'text-black' : 'text-dim hover:text-ink')
            }
            style={active ? { backgroundColor: accent } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
