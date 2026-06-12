// Minimal typed event bus for cross-cutting UI events (toasts, etc.).
// Decouples scene code from the HUD without threading props/state through.

export type BusEvents = {
  toast: string;
  /** A click (not a drag) on the scene, in normalized device coords (-1..1). */
  'scene:click': { x: number; y: number };
  /** Request to run an AI job (Phase 5 subscribes). */
  'job:run': number;
  /** Request to launch a Starship carrying N satellites (Phase 4 subscribes). */
  'launch:request': number;
  /** A texture asset finished loading (label for the loading chip). */
  'asset:loaded': string;
  /** Request a PNG snapshot of the canvas (payload = timestamp). */
  snapshot: number;
};

type Handler<E extends keyof BusEvents> = (payload: BusEvents[E]) => void;

const listeners = new Map<keyof BusEvents, Set<Handler<keyof BusEvents>>>();

/** Subscribe to an event. Returns an unsubscribe function. */
export function on<E extends keyof BusEvents>(event: E, handler: Handler<E>): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(handler as Handler<keyof BusEvents>);
  return () => {
    set?.delete(handler as Handler<keyof BusEvents>);
  };
}

/** Emit an event to all subscribers. */
export function emit<E extends keyof BusEvents>(event: E, payload: BusEvents[E]): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const h of set) h(payload);
}

/** Convenience: fire a HUD toast. */
export function toast(message: string): void {
  emit('toast', message);
}
