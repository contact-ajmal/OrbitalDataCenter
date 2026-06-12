import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyHash } from './lib/permalink';
import './styles/index.css';

// Temporary on-screen error logger for mobile debugging
if (typeof window !== 'undefined') {
  const showError = (msg: string) => {
    let errDiv = document.getElementById('debug-error-console');
    if (!errDiv) {
      errDiv = document.createElement('div');
      errDiv.id = 'debug-error-console';
      errDiv.setAttribute('style', 'position:fixed;top:10px;left:10px;right:10px;max-height:60vh;overflow-y:auto;background:rgba(220,38,38,0.95);color:#fff;font-family:monospace;font-size:11px;padding:12px;border-radius:6px;z-index:99999;word-break:break-all;white-space:pre-wrap;border:1px solid rgba(255,255,255,0.2);line-height:1.4;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);pointer-events:auto;');
      document.body.appendChild(errDiv);
    }
    errDiv.textContent += '\n• ' + msg;
  };
  window.addEventListener('error', (e) => {
    showError(`Error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
    showError(`Unhandled Rejection: ${msg}`);
  });
}

// Restore a shared view (if any) BEFORE the first render / the intro.
applyHash();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
