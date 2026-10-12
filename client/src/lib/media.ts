import { useEffect, useState } from 'react';

// ---------- Built-in music ----------
// The audio library is synthesised in the browser, so it needs no stock-media account
// and the files never leave the device. A track is stored in designs as `synth:<id>`.

type Synth = { id: string; name: string; mood: string; bpm: number; chords: number[][]; style: 'pop' | 'lofi' | 'ambient' | 'cinematic' | 'pluck' | 'drive' };

export const MUSIC: Synth[] = [
  { id: 'sunny', name: 'Sunny Side', mood: 'Happy', bpm: 112, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], style: 'pop' },
  { id: 'study', name: 'Late Study', mood: 'Lo-fi', bpm: 78, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], style: 'lofi' },
  { id: 'drift', name: 'Slow Drift', mood: 'Calm', bpm: 60, chords: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], style: 'ambient' },
  { id: 'rise', name: 'Rising Tide', mood: 'Cinematic', bpm: 90, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 62]], style: 'cinematic' },
  { id: 'pluck', name: 'Paper Planes', mood: 'Playful', bpm: 120, chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]], style: 'pluck' },
  { id: 'drive', name: 'Night Drive', mood: 'Energetic', bpm: 124, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], style: 'drive' },
];

const SR = 44100;
const LENGTH = 32;
const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function note(ctx: BaseAudioContext, dest: AudioNode, freq: number, t: number, dur: number, type: OscillatorType, gain: number, attack = 0.01, release = 0.2) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, Math.max(t + attack, t + dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBuffer(ctx: BaseAudioContext) {
  const b = ctx.createBuffer(1, SR, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function drum(ctx: BaseAudioContext, dest: AudioNode, kind: 'kick' | 'hat' | 'snare', t: number, noise: AudioBuffer, level = 1) {
  if (kind === 'kick') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.9 * level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.32);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const g = ctx.createGain();
  const len = kind === 'hat' ? 0.05 : 0.18;
  g.gain.setValueAtTime((kind === 'hat' ? 0.18 : 0.4) * level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(f).connect(g).connect(dest);
  src.start(t);
  src.stop(t + len + 0.02);
}

async function renderSynth(s: Synth): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, SR * LENGTH, SR);
  const master = ctx.createGain();
  master.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = s.style === 'lofi' ? 2200 : s.style === 'ambient' ? 1600 : 9000;
  master.connect(lp).connect(ctx.destination);
  const noise = noiseBuffer(ctx);
  const beat = 60 / s.bpm;
  const bar = beat * 4;
  const bars = Math.ceil(LENGTH / bar);
  for (let b = 0; b < bars; b++) {
    const chord = s.chords[b % s.chords.length];
    const t0 = b * bar;
    if (t0 >= LENGTH) break;
    const fadeIn = Math.min(1, b / 2 + 0.3);
    // Pad / chord bed
    const padType: OscillatorType = s.style === 'ambient' || s.style === 'cinematic' ? 'sine' : 'triangle';
    const padGain = s.style === 'pluck' || s.style === 'drive' ? 0.05 : 0.09;
    chord.forEach((n) => note(ctx, master, hz(n), t0, bar, padType, padGain * fadeIn, s.style === 'ambient' ? 1.2 : 0.05, s.style === 'ambient' ? 1.2 : 0.3));
    // Bass
    if (s.style !== 'ambient') {
      for (let k = 0; k < (s.style === 'drive' ? 8 : 2); k++) {
        const step = bar / (s.style === 'drive' ? 8 : 2);
        note(ctx, master, hz(chord[0] - 24), t0 + k * step, step * 0.9, s.style === 'drive' ? 'sawtooth' : 'sine', s.style === 'drive' ? 0.06 : 0.22);
      }
    }
    // Melody / arpeggio
    if (s.style === 'pluck' || s.style === 'pop' || s.style === 'drive') {
      for (let k = 0; k < 8; k++) {
        const n = chord[(k * (s.style === 'pop' ? 2 : 1)) % chord.length] + 12;
        note(ctx, master, hz(n), t0 + (k * bar) / 8, bar / 8, s.style === 'drive' ? 'square' : 'triangle', 0.05, 0.005, 0.12);
      }
    }
    if (s.style === 'lofi') {
      const swing = beat * 0.58;
      [0, 1.5, 2, 3.5].forEach((k, i) => note(ctx, master, hz(chord[(i + b) % chord.length] + 12), t0 + k * beat + (i % 2 ? swing - beat / 2 : 0), beat * 0.8, 'sine', 0.07, 0.01, 0.4));
    }
    if (s.style === 'cinematic') {
      note(ctx, master, hz(chord[chord.length - 1] + 12), t0, bar, 'sawtooth', 0.02 * (b / bars + 0.3), 1.5, 0.5);
      drum(ctx, master, 'kick', t0, noise, 0.8);
    }
    // Drums
    if (s.style === 'pop' || s.style === 'drive' || s.style === 'lofi' || s.style === 'pluck') {
      for (let k = 0; k < 4; k++) {
        const t = t0 + k * beat;
        if (s.style === 'drive' || k % 2 === 0) drum(ctx, master, 'kick', t, noise, s.style === 'lofi' ? 0.6 : 1);
        if (k % 2 === 1) drum(ctx, master, 'snare', t, noise, s.style === 'lofi' ? 0.5 : 0.8);
        drum(ctx, master, 'hat', t + beat / 2, noise, s.style === 'lofi' ? 0.6 : 1);
        if (s.style !== 'lofi') drum(ctx, master, 'hat', t, noise, 0.6);
      }
    }
  }
  return ctx.startRendering();
}

export function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + len * ch * 2, true);
  str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

const resolved = new Map<string, Promise<string>>();

// Turns a stored media source into something an <audio>/<video> element or fetch can load.
export function resolveMedia(src: string): Promise<string> {
  if (!src.startsWith('synth:')) return Promise.resolve(src);
  let p = resolved.get(src);
  if (!p) {
    const def = MUSIC.find((m) => `synth:${m.id}` === src) ?? MUSIC[0];
    p = renderSynth(def).then((b) => URL.createObjectURL(encodeWav(b)));
    resolved.set(src, p);
  }
  return p;
}

export function useMedia(src: string | undefined) {
  const [url, setUrl] = useState<string | null>(src && !src.startsWith('synth:') ? src : null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    resolveMedia(src).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [src]);
  return url;
}

export const MUSIC_SECONDS = LENGTH;

// ---------- Probing files ----------

// Read a video's size and length and grab a still frame for previews and image exports.
export function probeVideo(url: string, at = 0.1): Promise<{ width: number; height: number; duration: number; poster: string }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    let duration = 0;
    v.onloadedmetadata = () => {
      // MediaRecorder output has no duration until you seek past the end.
      if (!Number.isFinite(v.duration)) {
        v.currentTime = 1e9;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          duration = v.duration;
          v.currentTime = Math.min(at, duration / 2);
        };
        return;
      }
      duration = v.duration;
      v.currentTime = Math.min(at, duration / 2);
    };
    v.onseeked = () => {
      if (!duration || !Number.isFinite(duration)) return;
      v.onseeked = null;
      const scale = Math.min(1, 640 / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(v.videoWidth * scale));
      c.height = Math.max(1, Math.round(v.videoHeight * scale));
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      resolve({ width: v.videoWidth, height: v.videoHeight, duration, poster: c.toDataURL('image/jpeg', 0.7) });
    };
    v.onerror = () => reject(new Error('Could not read this video'));
  });
}

export function probeAudio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    a.src = url;
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) return resolve(a.duration);
      a.currentTime = 1e9;
      a.ontimeupdate = () => {
        a.ontimeupdate = null;
        resolve(Number.isFinite(a.duration) ? a.duration : 0);
      };
    };
    a.onerror = () => resolve(0);
  });
}
