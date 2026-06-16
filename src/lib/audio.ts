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

  // Create a filter for the synth pad to make it warm, light, and soft
  const padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 650; // raised cutoff for light, airy tones
  padFilter.connect(master);

  // Set up the feedback delay nodes for rich, spacious, reverb-like space ambient echo
  const delay = c.createDelay(2.0);
  delay.delayTime.value = 1.0; // 1-second delay for a spacious celestial echo tail
  const delayGain = c.createGain();
  delayGain.gain.value = 0.40; // feedback echo volume
  const delayFilter = c.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 750; // filters echo high frequencies slightly to keep them warm

  padFilter.connect(delay);
  delay.connect(delayFilter);
  delayFilter.connect(delayGain);
  delayGain.connect(delay); // feedback loop
  delayGain.connect(master);

  // Slowly modulate filter cutoff with an LFO for light movement
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.025; // slow 40s sweep
  const lfoGain = c.createGain();
  lfoGain.gain.value = 150; // sweep between 500Hz and 800Hz
  lfo.connect(lfoGain);
  lfoGain.connect(padFilter.frequency);
  lfo.start();

  let activeNotes: { osc: OscillatorNode; gain: GainNode }[] = [];

  const chords = [
    // Dbmaj9 (transposed up 1 octave): Db3, Ab3, F4, C5, Eb5 (airy, crystal)
    [138.59, 207.65, 349.23, 523.25, 622.25],
    // Abadd9 (transposed up 1 octave): Ab3, Eb4, Bb4, C5, G5 (soothing, floating)
    [207.65, 311.13, 466.16, 523.25, 783.99],
    // Fm9 (transposed up 1 octave): F3, C4, Ab4, Eb5, G5 (peaceful space)
    [174.61, 261.63, 415.30, 622.25, 783.99],
    // Gbmaj9#11 (transposed up 1 octave): Gb3, Db4, F4, Bb4, C5, F5 (dreamy shimmer)
    [185.00, 277.18, 349.23, 466.16, 523.25, 698.46],
    // Bbm9 (transposed up 1 octave): Bb3, F4, Ab4, Db5, C6 (deep, pure resolution)
    [233.08, 349.23, 415.30, 554.37, 1046.50]
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
      osc.type = 'sine'; // sine waves are pure, soft, and soothing (no humming/buzzing)
      osc.frequency.value = freq + (Math.random() - 0.5) * 0.5; // organic detune for clean chorus effect
      
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      const noteVol = 0.016 - (i * 0.0018); // very soft, ear-soothing volume levels
      gain.gain.exponentialRampToValueAtTime(noteVol, now + 4.5 + i * 0.4); // slow, smooth attack swells

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
