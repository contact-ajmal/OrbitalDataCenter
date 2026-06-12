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
  const c = ctx;

  // Background hum
  const noise = noiseBuffer(c);
  const humFilter = c.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 280; // deep space rumble
  const humGain = c.createGain();
  humGain.gain.value = 0.012; // soft rumble
  noise.connect(humFilter);
  humFilter.connect(humGain);
  humGain.connect(master);
  noise.start();

  // Create a filter for the synth pad to make it warm and soft
  const padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 350; // soft and warm
  padFilter.connect(master);

  // Slowly modulate filter cutoff with an LFO for movement
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.04; // slow 25s sweep
  const lfoGain = c.createGain();
  lfoGain.gain.value = 120; // sweep between 230Hz and 470Hz
  lfo.connect(lfoGain);
  lfoGain.connect(padFilter.frequency);
  lfo.start();

  let activeNotes: { osc: OscillatorNode; gain: GainNode }[] = [];

  const chords = [
    // Cmaj9: C3, G3, B3, D4, E4
    [130.81, 196.00, 246.94, 293.66, 329.63],
    // Fmaj9: F2, C3, A3, E4, G4
    [87.31, 130.81, 220.00, 329.63, 392.00],
    // Am9: A2, E3, G3, C4, B4
    [110.00, 164.81, 196.00, 261.63, 493.88],
    // G6/9: G2, D3, B3, E4, A4
    [98.00, 146.83, 246.94, 329.63, 440.00]
  ];
  let currentChordIdx = 0;

  const playChord = () => {
    const now = c.currentTime;
    const notes = chords[currentChordIdx]!;
    currentChordIdx = (currentChordIdx + 1) % chords.length;

    // Cross-fade: slowly fade out old notes
    const oldNotes = activeNotes;
    activeNotes = [];
    oldNotes.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 4);
        osc.stop(now + 4.1);
      } catch {
        /* ignore */
      }
    });

    // Fade in new notes
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = 'triangle'; // triangle is much warmer and softer
      osc.frequency.value = freq + (Math.random() - 0.5) * 0.4; // organic detune
      
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      const noteVol = 0.035 - (i * 0.003); // higher notes are slightly quieter
      gain.gain.exponentialRampToValueAtTime(noteVol, now + 3.5 + i * 0.3); // staggered swells

      osc.connect(gain);
      gain.connect(padFilter);
      osc.start(now);
      activeNotes.push({ osc, gain });
    });
  };

  playChord();

  const interval = setInterval(playChord, 12000); // evolve chord every 12 seconds

  ambient = () => {
    clearInterval(interval);
    try {
      noise.stop();
      lfo.stop();
    } catch {
      /* ignore */
    }
    activeNotes.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        /* ignore */
      }
    });
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
  if (ambient) {
    ambient();
    ambient = null;
  }
  stopStorm();
  stopLaunch();
}

export function toggleAudio() {
  if (enabled) disableAudio();
  else enableAudio();
}
