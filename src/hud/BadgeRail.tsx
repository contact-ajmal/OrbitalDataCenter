import { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';
import { useUiStore } from '../state/ui';

type Accent = 'laser' | 'solar' | 'ok' | 'dim';
const VAR: Record<Accent, string> = {
  laser: 'var(--color-laser)',
  solar: 'var(--color-solar)',
  ok: 'var(--color-ok)',
  dim: 'var(--color-dim)',
};

// Original typographic badges (names only — no third-party logo artwork).
const BADGES: { prefix: string; accent: string; color: Accent }[] = [
  { prefix: 'OPERATOR · ', accent: 'SPACEX', color: 'solar' },
  { prefix: 'AI COMPUTE · ', accent: 'xAI', color: 'laser' },
  { prefix: 'PAYLOAD REF · ', accent: 'NVIDIA GB300 / RUBIN', color: 'laser' },
  { prefix: 'TPU-CLASS VARIANT · ', accent: 'PLANNED', color: 'laser' },
  { prefix: 'SOLAR HERITAGE · ', accent: 'STARLINK V3', color: 'solar' },
  { prefix: 'LAUNCH · ', accent: 'STARSHIP V3 — 124 M', color: 'solar' },
  { prefix: 'FACTORY · ', accent: 'GIGASAT BASTROP TX', color: 'dim' },
  { prefix: 'ORBIT · ', accent: '600 KM SSO 97.6°', color: 'dim' },
  { prefix: 'ANCHOR CUSTOMER · ', accent: '$920M/MO', color: 'ok' },
];

export function BadgeRail() {
  const openInfo = useUiStore((s) => s.openInfo);
  const [active, setActive] = useState(0);
  const frozen = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!frozen.current) setActive((n) => (n + 1) % BADGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-7 hidden items-center gap-2 overflow-x-auto px-3 hud:flex"
      onMouseEnter={() => (frozen.current = true)}
      onMouseLeave={() => (frozen.current = false)}
    >
      <Logo size={14} className="shrink-0 opacity-80" />
      {BADGES.map((b, i) => {
        const hot = i === active;
        return (
          <button
            key={b.accent}
            onClick={() => openInfo('vehicle')}
            className="flex shrink-0 items-center gap-1.5 rounded border bg-black/50 px-2 py-1 text-[9px] uppercase tracking-[.2em] transition-colors"
            style={{ borderColor: hot ? VAR[b.color] : 'rgba(255,255,255,0.1)' }}
          >
            <span className="h-2.5 w-[2px] rounded" style={{ backgroundColor: VAR[b.color] }} />
            <span className="text-dim">{b.prefix}</span>
            <span style={{ color: VAR[b.color] }}>{b.accent}</span>
          </button>
        );
      })}
    </div>
  );
}
