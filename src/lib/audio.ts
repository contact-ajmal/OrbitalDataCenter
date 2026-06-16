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

  // Background hum - extremely quiet and subtle
  const noise = noiseBuffer(c);
  const humFilter = c.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 180; // deeper space rumble
  const humGain = c.createGain();
  humGain.gain.value = 0.003; // reduced from 0.012 for a cleaner mix
  noise.connect(humFilter);
  humFilter.connect(humGain);
  humGain.connect(master);
  noise.start();

  // Create a filter for the synth pad to make it warm and soft
  const padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 260; // lowered cutoff for a warmer, rounder tone
  padFilter.connect(master);

  // Set up the feedback delay nodes for rich, spacious, reverb-like space ambient echo
  const delay = c.createDelay(2.0);
  delay.delayTime.value = 0.8; // 800ms delay for deep cosmic space echo
  const delayGain = c.createGain();
  delayGain.gain.value = 0.35; // feedback echo volume
  const delayFilter = c.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 350; // filters echo high frequencies to keep it dark

  padFilter.connect(delay);
  delay.connect(delayFilter);
  delayFilter.connect(delayGain);
  delayGain.connect(delay); // feedback loop
  delayGain.connect(master);

  // Slowly modulate filter cutoff with an LFO for movement (warmer sweep range)
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.03; // slower 33s sweep
  const lfoGain = c.createGain();
  lfoGain.gain.value = 80; // sweep between 180Hz and 340Hz
  lfo.connect(lfoGain);
  lfoGain.connect(padFilter.frequency);
  lfo.start();

  let activeNotes: { osc: OscillatorNode; gain: GainNode }[] = [];

  const chords = [
    // Dbmaj9: Db2, Ab2, F3, C4, Eb4 (lush, floating)
    [69.30, 103.83, 174.61, 261.63, 311.13],
    // Abadd9: Ab2, Eb3, Bb3, C4, G4 (warm, wide)
    [103.83, 155.56, 233.08, 261.63, 392.00],
    // Fm9: F2, C3, Ab3, Eb4, G4 (mysterious space)
    [87.31, 130.81, 207.65, 311.13, 392.00],
    // Gbmaj9#11: Gb2, Db3, F3, Bb3, C4, F4 (cinematic lift)
    [92.50, 138.59, 174.61, 233.08, 261.63, 349.23],
    // Bbm9: Bb2, F3, Ab3, Db4, C5 (deep resolution)
    [116.54, 174.61, 207.65, 277.18, 523.25]
  ];
  let currentChordIdx = 0;

  const playChord = () => {
    const now = c.currentTime;
    const notes = chords[currentChordIdx]!;
    currentChordIdx = (currentChordIdx + 1) % chords.length;

    // Cross-fade: slowly fade out old notes over 6 seconds
    const oldNotes = activeNotes;
    activeNotes = [];
    oldNotes.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);
        osc.stop(now + 6.1);
      } catch {
        /* ignore */
      }
    });

    // Fade in new notes with organic staggered attack swells
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      osc.type = 'triangle'; // triangle is warm and soft
      osc.frequency.value = freq + (Math.random() - 0.5) * 0.8; // organic detune for chorus effect
      
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      const noteVol = 0.022 - (i * 0.0025); // quieter note volume for a soft backdrop
      gain.gain.exponentialRampToValueAtTime(noteVol, now + 4.5 + i * 0.4); // slower, smoother attack swells

      osc.connect(gain);
      gain.connect(padFilter);
      osc.start(now);
      activeNotes.push({ osc, gain });
    });
  };

  playChord();

  const interval = setInterval(playChord, 15000); // evolve chord every 15 seconds

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
