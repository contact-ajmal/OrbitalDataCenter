import type { ReactNode } from 'react';

/**
 * App-wide context providers wrapper. Currently a pass-through; will host
 * sim-clock, theme, and store providers as the app grows.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
