import { useEffect } from 'react';
import { useSimStore } from '../state/sim';
import { scheduleHashUpdate } from '../lib/permalink';

/** Writes the shareable URL hash (debounced) whenever serialized state changes. */
export function PermalinkSync() {
  useEffect(() => {
    // store changes (satCount/timeWarp/view/toggles/vision/thermal/chase)
    const unsub = useSimStore.subscribe(() => scheduleHashUpdate());
    // camera drifts continuously — sample it on a gentle interval (debounced anyway)
    const id = setInterval(() => scheduleHashUpdate(), 1500);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, []);
  return null;
}
