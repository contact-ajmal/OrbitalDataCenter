// Single source for the controls reference shown in the Info modal.
// Mouse rows + keyboard rows (the keyboard handler in hud/Shortcuts.tsx
// implements these; edit here to change the displayed reference).

export type ShortcutRow = { keys: string; action: string };

export const SHORTCUTS: ShortcutRow[] = [
  { keys: 'Drag', action: 'Orbit the camera' },
  { keys: 'Scroll / Pinch', action: 'Zoom in / out' },
  { keys: 'Click satellite', action: 'Inspect & open card' },
  { keys: 'Space', action: 'Pause / resume' },
  { keys: 'R', action: 'Reset view' },
  { keys: '1 / 2 / 3', action: 'Overview / Chase / Inspect' },
  { keys: 'L', action: 'Launch Starship (+60)' },
  { keys: 'J', action: 'Run AI job' },
  { keys: 'T', action: 'Cinematic tour' },
  { keys: 'S', action: 'Snapshot' },
  { keys: 'V', action: '10⁶ vision toggle' },
  { keys: 'I', action: 'Open info' },
  { keys: 'Esc', action: 'Close modal / card · cancel tour' },
];
