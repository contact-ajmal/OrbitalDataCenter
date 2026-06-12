// Fully-synthesized audio (zero assets). One AudioContext, built lazily inside
// the first user gesture (the 🔊 toggle) to satisfy autoplay policy. Default OFF,
// persisted. All sound routes through one master gain so the toggle is instant.

import { on } from './bus';
import { launch } from '../state/launch';
import { storm } from '../state/storm';

const KEY = 'ai1-audio';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;

let ambient: (() => void) | null = null;
let stormVoice: (() => void) | null = null;
let launchVoice: { stop: () => void; sep: () => void } | null = null;
let pollId: number | null = null;
let unsubToast: (() => void) | null = null;
let clickHandler: ((e: MouseEvent) => void) | null = null;

export function audioPreference(): boolean {
  try {
    const val = localStorage.getItem(KEY);
    return val === null ? true : val === '1';
  } catch {
    return true;
  }
}
export function isAudioOn(): boolean {
  return enabled;
}

function noiseBuffer(c: AudioContext, brown = false): AudioBufferSourceNode {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else {
      // pink-ish
      last = 0.97 * last + 0.03 * white;
      d[i] = last * 2;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function startAmbient() {
  if (ambient || !ctx || !master) return;
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 55.5;
  const g = ctx.createGain();
  g.gain.value = 0.1;
  o1.connect(g);
  o2.connect(g);
  const noise = noiseBuffer(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 480;
  const ng = ctx.createGain();
  ng.gain.value = 0.016; // ≈ −36 dB
  noise.connect(lp);
  lp.connect(ng);
  g.connect(master);
  ng.connect(master);
  o1.start();
  o2.start();
  noise.start();
  ambient = () => {
    try {
      o1.stop();
      o2.stop();
      noise.stop();
    } catch {
      /* ignore */
    }
  };
}

function blip(freq = 1200, dur = 0.12, type: OscillatorType = 'sine', vol = 0.2) {
  if (!enabled || !ctx || !master) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(now + dur + 0.02);
}

function arp() {
  [660, 880, 1320].forEach((f, i) => setTimeout(() => blip(f, 0.16), i * 110));
}

function clank() {
  blip(320, 0.18, 'square', 0.25);
  setTimeout(() => blip(520, 0.12, 'square', 0.16), 8);
}

function startStorm() {
  if (stormVoice || !ctx || !master) return;
  const noise = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600;
  bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain);
  lfoGain.connect(bp.frequency);
  noise.connect(bp);
  bp.connect(g);
  g.connect(master);
  noise.start();
  lfo.start();
  stormVoice = () => {
    try {
      noise.stop();
      lfo.stop();
    } catch {
      /* ignore */
    }
  };
}
function stopStorm() {
  if (stormVoice) {
    stormVoice();
    stormVoice = null;
  }
}

function startLaunch() {
  if (launchVoice || !ctx || !master) return;
  const noise = noiseBuffer(ctx, true);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 120;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  const now = ctx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.18, now + 3);
  lp.frequency.exponentialRampToValueAtTime(600, now + 7);
  noise.connect(lp);
  lp.connect(g);
  g.connect(master);
  noise.start();
  launchVoice = {
    stop: () => {
      try {
        const t = ctx!.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        noise.stop(t + 0.7);
      } catch {
        /* ignore */
      }
    },
    sep: () => {
      // doppler-style pitch fall
      const t = ctx!.currentTime;
      lp.frequency.cancelScheduledValues(t);
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(150, t + 0.8);
    },
  };
}
function stopLaunch() {
  if (launchVoice) {
    launchVoice.stop();
    launchVoice = null;
  }
}

function startPoll() {
  if (pollId) return;
  let lastLaunchT = -99;
  pollId = window.setInterval(() => {
    if (!enabled) return;
    if (launch.active && !launchVoice) startLaunch();
    else if (!launch.active && launchVoice) stopLaunch();
    // detect stage separation (≈ t 7.5) for the doppler dip
    if (launchVoice && launch.missionT / 32 >= 7.5 && lastLaunchT < 7.5) launchVoice.sep();
    lastLaunchT = launch.missionT / 32;
    if (storm.active && !stormVoice) startStorm();
    else if (!storm.active && stormVoice) stopStorm();
  }, 150);
}

export function enableAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
  }
  void ctx.resume();
  enabled = true;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
  const now = ctx.currentTime;
  master!.gain.cancelScheduledValues(now);
  master!.gain.linearRampToValueAtTime(0.7, now + 0.3);
  startAmbient();
  startPoll();
  if (!unsubToast) {
    unsubToast = on('toast', (msg) => {
      if (!enabled) return;
      if (/MECHAZILLA CATCH/i.test(msg)) clank();
      else if (/COMPLETE/i.test(msg)) arp();
      else blip();
    });
  }
  if (!clickHandler) {
    clickHandler = (e) => {
      if (!enabled) return;
      if ((e.target as HTMLElement)?.closest('button')) blip(880, 0.05, 'sine', 0.1);
    };
    window.addEventListener('click', clickHandler);
  }
}

export function disableAudio() {
  enabled = false;
  try {
    localStorage.setItem(KEY, '0');
  } catch {
    /* ignore */
  }
  if (ctx && master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.25);
  }
  stopStorm();
  stopLaunch();
}

export function toggleAudio() {
  if (enabled) disableAudio();
  else enableAudio();
}
