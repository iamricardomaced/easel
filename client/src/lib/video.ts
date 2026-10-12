import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from 'mediabunny';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { DesignDoc, DesignElement, Page, VideoElement } from '../types';
import { renderPageCanvas } from './export';
import { animationOrder, clipTime, elementMotion, trackGain, locate, pageSeconds, pageStarts, totalSeconds, transitionAt, transitionProgress, REST, type MotionState } from './motion';
import { resolveMedia } from './media';

// Renders a design's timeline (pages, animations, transitions, video clips and audio)
// frame by frame into an MP4 or a GIF, entirely in the browser.
//
// Each page is rasterised once into layers: runs of still elements share a bitmap,
// while every animated element and every video gets its own layer that is
// transformed or redrawn per frame. That keeps per-frame work to canvas compositing.

export type VideoQuality = 480 | 720 | 1080 | 2160;

export interface VideoProgress {
  phase: string;
  done: number;
  total: number;
}

type Layer =
  | { kind: 'still'; bitmap: HTMLCanvasElement }
  | { kind: 'anim'; bitmap: HTMLCanvasElement; el: DesignElement; order: number }
  | { kind: 'video'; mask: HTMLCanvasElement; el: VideoElement; order: number; video: HTMLVideoElement };

interface PageLayers {
  page: Page;
  layers: Layer[];
}

const WHITE_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

const transparentPage = (els: DesignElement[]): Page => ({ id: 'layer', background: { type: 'solid', color: 'transparent' }, elements: els });

async function loadVideo(src: string): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.muted = true;
  v.preload = 'auto';
  v.playsInline = true;
  v.src = src;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error('A video in this design could not be loaded'));
  });
  return v;
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return Promise.resolve();
  return new Promise((res) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      res();
    };
    v.addEventListener('seeked', done);
    v.currentTime = t;
    setTimeout(done, 3000);
  });
}

async function buildLayers(doc: DesignDoc, page: Page, scale: number): Promise<PageLayers> {
  const sub = (p: Page) => ({ ...doc, pages: [p] });
  const layers: Layer[] = [];
  const bg = await renderPageCanvas(sub({ ...page, elements: [] }), 0, scale);
  layers.push({ kind: 'still', bitmap: bg });
  const order = animationOrder(page);
  let run: DesignElement[] = [];
  const flush = async () => {
    if (!run.length) return;
    layers.push({ kind: 'still', bitmap: await renderPageCanvas(sub(transparentPage(run)), 0, scale) });
    run = [];
  };
  for (const el of page.elements) {
    const animated = (order.get(el.id) ?? -1) >= 0;
    if (el.type === 'video') {
      await flush();
      // Alpha mask of the clip's frame shape, radius and rotation.
      const maskEl = { ...el, type: 'image', src: WHITE_PIXEL, filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0, hue: 0 }, crop: { x: 0, y: 0, w: 1, h: 1 }, opacity: 1, shadow: undefined } as unknown as DesignElement;
      const mask = await renderPageCanvas(sub(transparentPage([maskEl])), 0, scale);
      layers.push({ kind: 'video', mask, el, order: order.get(el.id) ?? -1, video: await loadVideo(await resolveMedia(el.src)) });
    } else if (animated) {
      await flush();
      layers.push({ kind: 'anim', bitmap: await renderPageCanvas(sub(transparentPage([el])), 0, scale), el, order: order.get(el.id)! });
    } else run.push(el);
  }
  await flush();
  return { page, layers };
}

function applyMotion(ctx: CanvasRenderingContext2D, el: DesignElement, m: MotionState) {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const rot = ((el.rotation || 0) * Math.PI) / 180;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(m.tx, m.ty);
  ctx.scale(m.scale, m.scale);
  ctx.rotate((m.rotate * Math.PI) / 180);
  if (m.reveal < 1) {
    ctx.beginPath();
    ctx.rect(-el.w, -el.h * 2, el.w / 2 + m.reveal * el.w, el.h * 4);
    ctx.clip();
  }
  ctx.rotate(-rot);
  ctx.translate(-cx, -cy);
}

// Draws one page at local time `t` into `ctx`, whose transform maps design units to pixels.
async function drawPage(ctx: CanvasRenderingContext2D, doc: DesignDoc, pl: PageLayers, t: number, scale: number, scratch: HTMLCanvasElement) {
  const W = doc.width;
  const H = doc.height;
  const secs = pageSeconds(pl.page);
  for (const layer of pl.layers) {
    if (layer.kind === 'still') {
      ctx.drawImage(layer.bitmap, 0, 0, W, H);
      continue;
    }
    const m = layer.order >= 0 ? elementMotion(layer.el, layer.order, t, secs) : REST;
    if (m.opacity <= 0.001) continue;
    let src: HTMLCanvasElement = layer.kind === 'anim' ? layer.bitmap : scratch;
    if (layer.kind === 'video') {
      const el = layer.el;
      await seek(layer.video, clipTime(el, t));
      const s = scratch.getContext('2d')!;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'source-over';
      s.clearRect(0, 0, scratch.width, scratch.height);
      s.setTransform(scale, 0, 0, scale, 0, 0);
      s.translate(el.x + el.w / 2, el.y + el.h / 2);
      s.rotate(((el.rotation || 0) * Math.PI) / 180);
      s.translate(-el.w / 2, -el.h / 2);
      // object-fit: cover inside the crop rectangle
      const v = layer.video;
      const rx = el.crop.x * el.w;
      const ry = el.crop.y * el.h;
      const rw = el.crop.w * el.w;
      const rh = el.crop.h * el.h;
      const k = Math.max(rw / v.videoWidth, rh / v.videoHeight);
      const dw = v.videoWidth * k;
      const dh = v.videoHeight * k;
      s.translate(rx + rw / 2, ry + rh / 2);
      s.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      s.drawImage(v, -dw / 2, -dh / 2, dw, dh);
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'destination-in';
      s.drawImage(layer.mask, 0, 0);
      s.globalCompositeOperation = 'source-over';
      src = scratch;
    }
    ctx.save();
    ctx.globalAlpha = m.opacity * (layer.kind === 'video' ? layer.el.opacity : 1);
    if (m.blur) ctx.filter = `blur(${m.blur * scale}px)`;
    applyMotion(ctx, layer.el, m);
    ctx.drawImage(src, 0, 0, W, H);
    ctx.restore();
  }
}

interface FrameRenderer {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  render: (time: number) => Promise<void>;
  dispose: () => void;
}

async function createRenderer(doc: DesignDoc, pxScale: number, onPhase: (p: VideoProgress) => void): Promise<FrameRenderer> {
  const width = Math.round((doc.width * pxScale) / 2) * 2;
  const height = Math.round((doc.height * pxScale) / 2) * 2;
  const scale = width / doc.width;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  };
  const out = mk();
  const pageA = mk();
  const pageB = mk();
  const scratch = mk();
  const ctx = out.getContext('2d', { alpha: false })!;
  const cache = new Map<number, PageLayers>();
  const layersFor = async (i: number) => {
    let pl = cache.get(i);
    if (!pl) {
      onPhase({ phase: `Preparing page ${i + 1}`, done: i, total: doc.pages.length });
      pl = await buildLayers(doc, doc.pages[i], scale);
      cache.set(i, pl);
      // Only the current page and the one before it (for transitions) are needed.
      for (const k of cache.keys()) if (k < i - 1) cache.delete(k);
    }
    return pl;
  };
  const drawInto = async (c: HTMLCanvasElement, i: number, t: number) => {
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width, height);
    g.setTransform(scale, 0, 0, scale, 0, 0);
    await drawPage(g, doc, await layersFor(i), t, scale, scratch);
  };
  const total = totalSeconds(doc);
  return {
    width,
    height,
    canvas: out,
    render: async (time) => {
      const { index, local } = locate(doc, Math.min(time, total - 0.0005));
      const page = doc.pages[index];
      const p = transitionProgress(page, index, local);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      if (p === null) {
        await drawInto(pageA, index, local);
        ctx.drawImage(pageA, 0, 0);
        return;
      }
      const f = transitionAt(page.transition?.kind, p);
      await drawInto(pageB, index - 1, pageSeconds(doc.pages[index - 1]));
      await drawInto(pageA, index, local);
      const place = (c: HTMLCanvasElement, o: { opacity: number; tx: number; scale: number; rotateY: number }, clip?: (g: CanvasRenderingContext2D) => void) => {
        ctx.save();
        ctx.globalAlpha = o.opacity;
        ctx.translate(width / 2 + o.tx * width, height / 2);
        ctx.scale(o.scale * Math.cos((o.rotateY * Math.PI) / 180), o.scale);
        ctx.translate(-width / 2, -height / 2);
        clip?.(ctx);
        ctx.drawImage(c, 0, 0);
        ctx.restore();
      };
      place(pageB, f.outgoing);
      place(pageA, f.incoming, (g) => {
        if (f.incoming.circle !== null) {
          g.beginPath();
          g.arc(width / 2, height / 2, (f.incoming.circle * 0.75 * Math.hypot(width, height)) / Math.SQRT2, 0, Math.PI * 2);
          g.clip();
        } else if (f.incoming.wipe !== null) {
          g.beginPath();
          g.rect(0, 0, f.incoming.wipe * width, height);
          g.clip();
        }
      });
    },
    dispose: () => {
      for (const pl of cache.values()) for (const l of pl.layers) if (l.kind === 'video') l.video.removeAttribute('src');
      cache.clear();
    },
  };
}

// ---------- Audio ----------

async function decode(ctx: BaseAudioContext, src: string): Promise<AudioBuffer | null> {
  try {
    const buf = await (await fetch(await resolveMedia(src))).arrayBuffer();
    return await ctx.decodeAudioData(buf);
  } catch {
    return null; // e.g. a video without a sound track
  }
}

export function hasAudio(doc: DesignDoc) {
  return !!doc.audio?.length || doc.pages.some((p) => p.elements.some((e) => e.type === 'video' && !e.muted && e.volume > 0));
}

async function mixAudio(doc: DesignDoc): Promise<AudioBuffer | null> {
  if (!hasAudio(doc)) return null;
  const rate = 48000;
  const total = totalSeconds(doc);
  const ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  let any = false;
  // Music and sound tracks
  for (const a of doc.audio ?? []) {
    const buf = await decode(ctx, a.src);
    if (!buf) continue;
    any = true;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    // Gain envelope sampled every 50 ms covers fades and the track window.
    g.gain.setValueAtTime(0, 0);
    for (let t = 0; t <= total; t += 0.05) g.gain.setValueAtTime(trackGain(a, t, total) ?? 0, t);
    const len = Math.max(0.05, Math.min(a.trimEnd, buf.duration) - a.trimStart);
    const end = a.loop ? total : Math.min(total, a.start + len);
    for (let t = a.start; t < end; t += len) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.connect(g);
      s.start(t, a.trimStart, Math.min(len, end - t));
    }
  }
  // Sound from video clips, for as long as their page is on screen
  const starts = pageStarts(doc);
  for (const [i, p] of doc.pages.entries()) {
    for (const el of p.elements) {
      if (el.type !== 'video' || el.muted || el.volume <= 0) continue;
      const buf = await decode(ctx, el.src);
      if (!buf) continue;
      any = true;
      const g = ctx.createGain();
      g.gain.value = el.volume;
      g.connect(ctx.destination);
      const secs = pageSeconds(p);
      const len = Math.max(0.05, Math.min(el.trimEnd, buf.duration) - el.trimStart);
      for (let t = 0; t < secs; t += len) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(g);
        s.start(starts[i] + t, el.trimStart, Math.min(len, secs - t));
        if (!el.loop) break;
      }
    }
  }
  if (!any) return null;
  const out = await ctx.startRendering();
  // Stacked tracks can clip; scale the mix down to leave a little headroom.
  let peak = 0;
  for (let c = 0; c < out.numberOfChannels; c++) {
    const d = out.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak > 0.95)
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= 0.95 / peak;
    }
  return out;
}

// ---------- Encoders ----------

export async function exportVideo(
  doc: DesignDoc,
  quality: VideoQuality,
  onProgress: (p: VideoProgress) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
  const pxScale = quality / Math.min(doc.width, doc.height);
  const fps = 30;
  const total = totalSeconds(doc);
  const frames = Math.max(1, Math.round(total * fps));

  onProgress({ phase: 'Mixing audio', done: 0, total: 1 });
  const audio = await mixAudio(doc);
  const r = await createRenderer(doc, pxScale, onProgress);

  let format: Mp4OutputFormat | WebMOutputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });
  let videoCodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: r.width, height: r.height });
  if (!videoCodec) {
    format = new WebMOutputFormat();
    videoCodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: r.width, height: r.height });
  }
  if (!videoCodec) throw new Error('This browser cannot encode video. Try a recent Chrome, Edge or Safari.');
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const video = new CanvasSource(r.canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: fps });
  let audioSource: AudioBufferSource | null = null;
  if (audio) {
    const audioCodec = await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), { numberOfChannels: 2, sampleRate: audio.sampleRate });
    if (audioCodec) {
      audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH });
      output.addAudioTrack(audioSource);
    }
  }
  await output.start();
  try {
    for (let f = 0; f < frames; f++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      await r.render(f / fps);
      await video.add(f / fps, 1 / fps);
      if (f % 5 === 0) onProgress({ phase: 'Rendering video', done: f, total: frames });
    }
    if (audioSource && audio) await audioSource.add(audio);
    onProgress({ phase: 'Finishing', done: frames, total: frames });
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    r.dispose();
  }
  const ext = format instanceof Mp4OutputFormat ? 'mp4' : 'webm';
  return { blob: new Blob([target.buffer!], { type: format.mimeType }), ext };
}

export async function exportGif(doc: DesignDoc, maxSide: number, onProgress: (p: VideoProgress) => void, signal?: AbortSignal): Promise<Blob> {
  const pxScale = Math.min(1, maxSide / Math.max(doc.width, doc.height));
  const fps = 15;
  const frames = Math.max(1, Math.round(totalSeconds(doc) * fps));
  const r = await createRenderer(doc, pxScale, onProgress);
  const gif = GIFEncoder();
  const ctx = r.canvas.getContext('2d')!;
  try {
    for (let f = 0; f < frames; f++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      await r.render(f / fps);
      const { data } = ctx.getImageData(0, 0, r.width, r.height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), r.width, r.height, { palette, delay: 1000 / fps, repeat: 0 });
      if (f % 3 === 0) onProgress({ phase: 'Rendering GIF', done: f, total: frames });
      // Yield so the progress label can repaint.
      if (f % 3 === 0) await new Promise((res) => setTimeout(res));
    }
  } finally {
    r.dispose();
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
}
