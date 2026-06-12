import { useEffect, useState } from 'react';
import { on } from '../lib/bus';

type Toast = { id: number; msg: string };
let nextId = 1;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return on('toast', (msg) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, msg }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
    });
  }, []);

  return (
    <div className="pointer-events-none absolute left-1/2 top-36 flex -translate-x-1/2 flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded border border-laser/30 bg-black/75 px-3 py-1.5 text-[9px] uppercase tracking-[.22em] text-laser backdrop-blur-md"
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
