import type { CSSProperties } from 'react';
import type { AnimationKind, AudioTrack, DesignDoc, DesignElement, Page, TransitionKind, VideoElement } from '../types';

// One timing model shared by the editor preview, Present, the timeline player and the
// video/GIF exporter, so a design moves the same way everywhere.

export const ANIM_MS = 700;
export const STAGGER_MS = 90;
export const DEFAULT_PAGE_SECONDS = 5;

export const ANIMATIONS: { kind: AnimationKind; label: string }[] = [
  { kind: 'none', label: 'None' },
  { kind: 'fade', label: 'Fade' },
  { kind: 'rise', label: 'Rise' },
  { kind: 'pan', label: 'Pan' },
  { kind: 'drop', label: 'Drop' },
  { kind: 'pop', label: 'Pop' },
  { kind: 'zoom', label: 'Zoom' },
  { kind: 'wipe', label: 'Wipe' },
  { kind: 'blur', label: 'Blur' },
  { kind: 'spin', label: 'Spin' },
  { kind: 'bounce', label: 'Bounce' },
  { kind: 'tumble', label: 'Tumble' },
];

export const TRANSITIONS: { kind: TransitionKind; label: string }[] = [
  { kind: 'none', label: 'None' },
  { kind: 'dissolve', label: 'Dissolve' },
  { kind: 'slide', label: 'Slide' },
  { kind: 'push', label: 'Push' },
  { kind: 'wipe', label: 'Wipe' },
  { kind: 'zoom', label: 'Zoom' },
  { kind: 'circle', label: 'Circle wipe' },
  { kind: 'flip', label: 'Flip' },
];

export interface MotionState {
  opacity: number;
  tx: number; // px
  ty: number; // px
  scale: number;
  rotate: number; // deg
  blur: number; // px
  reveal: number; // 0..1, fraction of the box shown from the left (wipe)
}

export const REST: MotionState = { opacity: 1, tx: 0, ty: 0, scale: 1, rotate: 0, blur: 0, reveal: 1 };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const backOut = (t: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const bounceOut = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// State of an element `p` of the way (0..1) through its entrance animation.
export function animAt(kind: AnimationKind | undefined, p: number): MotionState {
  p = clamp01(p);
  if (!kind || kind === 'none' || p >= 1) return REST;
  const e = easeOut(p);
  const fade = Math.min(1, p * 2);
  switch (kind) {
    case 'fade':
      return { ...REST, opacity: e };
    case 'rise':
      return { ...REST, opacity: fade, ty: 40 * (1 - e) };
    case 'pan':
      return { ...REST, opacity: fade, tx: -60 * (1 - e) };
    case 'drop':
      return { ...REST, opacity: fade, ty: -60 * (1 - e) };
    case 'pop':
      return { ...REST, opacity: fade, scale: 0.6 + 0.4 * backOut(p) };
    case 'zoom':
      return { ...REST, opacity: e, scale: 1.35 - 0.35 * e };
    case 'wipe':
      return { ...REST, reveal: e };
    case 'blur':
      return { ...REST, opacity: e, blur: 18 * (1 - e) };
    case 'spin':
      return { ...REST, opacity: fade, rotate: -120 * (1 - e), scale: 0.7 + 0.3 * e };
    case 'bounce':
      return { ...REST, opacity: fade, ty: -120 * (1 - bounceOut(p)) };
    case 'tumble':
      return { ...REST, opacity: fade, rotate: 25 * (1 - e), tx: -40 * (1 - e), ty: 30 * (1 - e) };
  }
  return REST;
}

// Animation state for the element at position `order` among the page's animated
// elements, `t` seconds into a page that lasts `pageSeconds`.
export function elementMotion(el: DesignElement, order: number, t: number, pageSeconds: number): MotionState {
  if (!el.animation || el.animation === 'none') return REST;
  const delay = (order * STAGGER_MS) / 1000;
  const len = ANIM_MS / 1000;
  const pin = (t - delay) / len;
  if (pin < 1) return animAt(el.animation, pin);
  if (el.animateOut) {
    const pout = (pageSeconds - t) / len;
    if (pout < 1) return animAt(el.animation, pout);
  }
  return REST;
}

export function motionCss(m: MotionState): CSSProperties {
  if (m === REST) return {};
  const tf = [
    (m.tx || m.ty) && `translate(${m.tx}px, ${m.ty}px)`,
    m.scale !== 1 && `scale(${m.scale})`,
    m.rotate && `rotate(${m.rotate}deg)`,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    opacity: m.opacity,
    transform: tf || undefined,
    filter: m.blur ? `blur(${m.blur}px)` : undefined,
    clipPath: m.reveal < 1 ? `inset(-50% ${(1 - m.reveal) * 100}% -50% -50%)` : undefined,
  };
}

// Order index of each animated element on a page (unanimated elements get -1).
export function animationOrder(page: Page): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  for (const el of page.elements) out.set(el.id, el.animation && el.animation !== 'none' ? n++ : -1);
  return out;
}

// ---------- Page transitions ----------

export interface TransitionFrame {
  incoming: { opacity: number; tx: number; ty: number; scale: number; circle: number | null; wipe: number | null; rotateY: number };
  outgoing: { opacity: number; tx: number; scale: number; rotateY: number };
}

// `p` 0..1 through a transition into the next page. tx values are fractions of the width.
export function transitionAt(kind: TransitionKind | undefined, p: number): TransitionFrame {
  const e = easeOut(clamp01(p));
  const still = { opacity: 1, tx: 0, ty: 0, scale: 1, circle: null, wipe: null, rotateY: 0 };
  const out = { opacity: 1, tx: 0, scale: 1, rotateY: 0 };
  switch (kind) {
    case 'dissolve':
      return { incoming: { ...still, opacity: e }, outgoing: out };
    case 'slide':
      return { incoming: { ...still, tx: 1 - e }, outgoing: out };
    case 'push':
      return { incoming: { ...still, tx: 1 - e }, outgoing: { ...out, tx: -e } };
    case 'wipe':
      return { incoming: { ...still, wipe: e }, outgoing: out };
    case 'zoom':
      return { incoming: { ...still, opacity: e, scale: 0.6 + 0.4 * e }, outgoing: { ...out, scale: 1 + 0.2 * e, opacity: 1 - e } };
    case 'circle':
      return { incoming: { ...still, circle: e }, outgoing: out };
    case 'flip':
      return p < 0.5
        ? { incoming: { ...still, opacity: 0 }, outgoing: { ...out, rotateY: 180 * p } }
        : { incoming: { ...still, rotateY: -90 + 90 * (p - 0.5) * 2 }, outgoing: { ...out, opacity: 0 } };
  }
  return { incoming: still, outgoing: out };
}

// ---------- Timeline ----------

export const pageSeconds = (p: Page) => p.duration ?? DEFAULT_PAGE_SECONDS;

export function pageStarts(doc: DesignDoc): number[] {
  const out: number[] = [];
  let t = 0;
  for (const p of doc.pages) {
    out.push(t);
    t += pageSeconds(p);
  }
  return out;
}

export const totalSeconds = (doc: DesignDoc) => doc.pages.reduce((s, p) => s + pageSeconds(p), 0);

// Which page is on screen at global time `t`, and how far into it.
export function locate(doc: DesignDoc, t: number): { index: number; local: number } {
  const starts = pageStarts(doc);
  for (let i = doc.pages.length - 1; i >= 0; i--) if (t >= starts[i]) return { index: i, local: t - starts[i] };
  return { index: 0, local: 0 };
}

// Transition progress into page `index` at local time `local`, or null when none is running.
export function transitionProgress(page: Page, index: number, local: number): number | null {
  const tr = page.transition;
  if (index === 0 || !tr || tr.kind === 'none' || tr.duration <= 0) return null;
  return local < tr.duration ? local / tr.duration : null;
}

// ---------- Media timing ----------

// Where in the source a video clip is `t` seconds after its page starts.
export function clipTime(el: VideoElement, t: number) {
  const len = Math.max(0.05, el.trimEnd - el.trimStart);
  return el.trimStart + (el.loop ? t % len : Math.min(t, len - 0.03));
}

// Volume of an audio track at design time `t`, or null when the track is silent then.
export function trackGain(a: AudioTrack, t: number, total: number): number | null {
  const len = Math.max(0.05, a.trimEnd - a.trimStart);
  const lt = t - a.start;
  const end = a.loop ? total - a.start : len;
  if (lt < 0 || lt >= end) return null;
  let g = a.volume;
  if (a.fadeIn > 0) g *= Math.min(1, lt / a.fadeIn);
  if (a.fadeOut > 0) g *= Math.min(1, (end - lt) / a.fadeOut);
  return Math.max(0, g);
}

export const trackSourceTime = (a: AudioTrack, t: number) => {
  const len = Math.max(0.05, a.trimEnd - a.trimStart);
  return a.trimStart + ((t - a.start) % len);
};

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
}

// CSS keyframes sampled from `animAt`, for hover previews and the canvas preview.
function keyframesCss() {
  const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return ANIMATIONS.filter((a) => a.kind !== 'none')
    .map(({ kind }) => {
      const steps = Array.from({ length: 21 }, (_, i) => {
        const m = animAt(kind, i / 20);
        const css = motionCss(m === REST ? { ...REST, opacity: 1 } : m) as Record<string, unknown>;
        const body = Object.entries({ opacity: 1, transform: 'none', filter: 'none', clipPath: 'inset(-50% -50% -50% -50%)', ...css })
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${kebab(k)}:${v}`)
          .join(';');
        return `${i * 5}%{${body}}`;
      }).join('');
      return `@keyframes anim-${kind}{${steps}}`;
    })
    .join('\n');
}

if (typeof document !== 'undefined' && !document.getElementById('anim-keyframes')) {
  const style = document.createElement('style');
  style.id = 'anim-keyframes';
  style.textContent = keyframesCss();
  document.head.appendChild(style);
}
