import { useEffect } from 'react';
import { emit } from '../lib/bus';
import { useSimStore } from '../state/sim';
import { useUiStore } from '../state/ui';
import { startTour, stopTour, tour } from '../state/tour';
import { requestReset } from '../state/reset';

/** Single global keydown listener (returns null). Ignores form fields. */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;

      const st = useSimStore.getState();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          st.togglePaused();
          break;
        case 'r':
        case 'R':
          requestReset();
          break;
        case '1':
          st.setViewMode('overview');
          break;
        case '2':
          st.setViewMode('chase');
          break;
        case '3':
          st.setViewMode('inspect');
          break;
        case 'l':
        case 'L':
          emit('launch:request', 60);
          break;
        case 'j':
        case 'J':
          emit('job:run', 1);
          break;
        case 't':
        case 'T':
          if (tour.active) stopTour(true);
          else startTour();
          break;
        case 's':
        case 'S':
          emit('snapshot', Date.now());
          break;
        case 'v':
        case 'V':
          st.setVisionOn(!st.visionOn);
          break;
        case 'i':
        case 'I':
          useUiStore.getState().openInfo();
          break;
        case 'Escape': {
          (document.activeElement as HTMLElement | null)?.blur?.();
          const ui = useUiStore.getState();
          if (st.photoMode) st.setPhotoMode(false);
          else if (ui.infoOpen) ui.closeInfo();
          else if (st.selectedIdx >= 0) st.setSelectedIdx(-1);
          else if (tour.active) stopTour(true);
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
