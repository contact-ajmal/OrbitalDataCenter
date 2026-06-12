import { CREDITS } from '../lib/credits';

/** CREDITS tab content for the Info modal. */
export function CreditsTab() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[16px] font-bold tracking-[.04em] text-ink">{CREDITS.author}</div>
        <div className="text-[11px] uppercase tracking-[.18em] text-dim">{CREDITS.location}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CREDITS.links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer noopener"
            title={`Open developer's ${l.label} (opens in a new tab)`}
            className="inline-flex items-center gap-1 rounded border border-laser/50 px-3 py-1.5 text-[9px] uppercase tracking-[.18em] text-laser transition-colors hover:bg-laser/15"
          >
            ↗ {l.label}
          </a>
        ))}
      </div>

      <div className="border-t border-white/8 pt-3">
        <p className="text-[10px] uppercase tracking-[.18em] text-dim">
          {CREDITS.built} · {CREDITS.year}
        </p>
      </div>
    </div>
  );
}
