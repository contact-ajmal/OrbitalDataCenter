import { useEffect, type ReactNode } from 'react';
import { useUiStore, type InfoTab } from '../state/ui';
import {
  DATA_NOTE,
  DATA_SOURCES,
  DISCLAIMER,
  HOW_IT_WORKS,
  INFO_FOOTER,
  MISSION_PARAS,
  PROGRAM,
  VEHICLE_SPECS,
} from '../lib/projectInfo';
import { SHORTCUTS } from '../lib/shortcuts';
import { CreditsTab } from './CreditsTab';

const TABS: { key: InfoTab; label: string }[] = [
  { key: 'mission', label: 'Mission' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'how', label: 'How it works' },
  { key: 'data', label: 'Data & imagery' },
  { key: 'controls', label: 'Controls' },
  { key: 'credits', label: 'Credits' },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] uppercase tracking-[.24em] text-laser">{children}</h3>
  );
}

function Content({ tab }: { tab: InfoTab }) {
  switch (tab) {
    case 'mission':
      return (
        <div className="space-y-3">
          {MISSION_PARAS.map((p, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-dim">
              {p}
            </p>
          ))}
        </div>
      );
    case 'vehicle':
      return (
        <div className="space-y-4">
          <div>
            <SectionTitle>AI1 satellite</SectionTitle>
            <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-6">
              {VEHICLE_SPECS.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1">
                  <span className="text-[10px] uppercase tracking-[.16em] text-dim">{s.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-ink">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle>Program</SectionTitle>
            <ul className="space-y-1">
              {PROGRAM.map((f) => (
                <li key={f} className="text-[11px] leading-relaxed text-dim">
                  <span className="text-laser/70">›</span> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case 'how':
      return (
        <div className="space-y-4">
          {HOW_IT_WORKS.map((e) => (
            <div key={e.title}>
              <SectionTitle>{e.title}</SectionTitle>
              <p className="text-[12px] leading-relaxed text-dim">{e.body}</p>
            </div>
          ))}
        </div>
      );
    case 'data':
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded border border-white/8">
            {DATA_SOURCES.map((d, i) => (
              <div
                key={d.asset}
                className={'flex items-baseline justify-between gap-3 px-3 py-2 ' + (i % 2 ? 'bg-white/3' : '')}
              >
                <span className="text-[11px] text-ink">{d.asset}</span>
                <span className="shrink-0 font-mono text-[10px] text-dim">
                  {d.res} · {d.source}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-faint">{DATA_NOTE}</p>
        </div>
      );
    case 'controls':
      return (
        <div className="overflow-hidden rounded border border-white/8">
          {SHORTCUTS.map((s, i) => (
            <div
              key={s.keys}
              className={'flex items-baseline justify-between gap-3 px-3 py-1.5 ' + (i % 2 ? 'bg-white/3' : '')}
            >
              <span className="font-mono text-[11px] text-laser">{s.keys}</span>
              <span className="text-[11px] text-dim">{s.action}</span>
            </div>
          ))}
        </div>
      );
    case 'credits':
      return <CreditsTab />;
    default:
      return null;
  }
}

export function InfoModal() {
  const open = useUiStore((s) => s.infoOpen);
  const tab = useUiStore((s) => s.infoTab);
  const setTab = useUiStore((s) => s.setInfoTab);
  const close = useUiStore((s) => s.closeInfo);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex justify-end bg-black/55 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* right-side drawer (full height) */}
      <div
        className="flex h-full w-full max-w-[460px] flex-col overflow-hidden border-l border-white/12 bg-black/90 shadow-[0_0_60px_rgba(0,0,0,0.7)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* header + tabs */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 pt-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'text-[10px] uppercase tracking-[.2em] transition-colors ' +
                  (t.key === tab ? 'text-laser' : 'text-dim hover:text-ink')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={close}
            className="mb-1 ml-2 text-[15px] leading-none text-dim hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 rounded border border-solar/30 bg-solar/5 px-3 py-2">
            <p className="text-[9px] leading-relaxed tracking-[.04em] text-solar/90">
              ⚠ {DISCLAIMER}
            </p>
          </div>
          <Content tab={tab} />
        </div>

        {/* footer */}
        <div className="border-t border-white/8 px-5 py-2.5">
          <p className="text-[9px] leading-relaxed text-faint">{INFO_FOOTER}</p>
        </div>
      </div>
    </div>
  );
}
