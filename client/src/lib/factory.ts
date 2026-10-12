import { nanoid } from 'nanoid';
import type {
  AudioTrack,
  VideoElement,
  ChartElement,
  DesignDoc,
  DesignElement,
  DrawElement,
  Fill,
  IconElement,
  ImageElement,
  LineElement,
  Page,
  QrElement,
  ShapeElement,
  ShapeKind,
  TableElement,
  TextElement,
} from '../types';

export const uid = () => nanoid(10);

export const solid = (color: string): Fill => ({ type: 'solid', color });

export function newPage(background: Fill = solid('#ffffff')): Page {
  return { id: uid(), background, elements: [] };
}

export function newDoc(width: number, height: number): DesignDoc {
  return { width, height, unit: 'px', pages: [newPage()] };
}

const base = (w: number, h: number, x = 0, y = 0) => ({ id: uid(), x, y, w, h, rotation: 0, opacity: 1 });

export function makeText(partial: Partial<TextElement> = {}): TextElement {
  const fontSize = partial.fontSize ?? 32;
  return {
    ...base(Math.max(200, fontSize * 8), fontSize * 1.4),
    type: 'text',
    text: 'Add a little bit of body text',
    fontFamily: 'Inter',
    fontSize,
    fontWeight: 400,
    italic: false,
    underline: false,
    strike: false,
    uppercase: false,
    color: '#000000',
    align: 'center',
    lineHeight: 1.4,
    letterSpacing: 0,
    list: 'none',
    effect: 'none',
    ...partial,
  };
}

export function makeShape(shape: ShapeKind, partial: Partial<ShapeElement> = {}): ShapeElement {
  return {
    ...base(240, 240),
    type: 'shape',
    shape,
    fill: solid('#c4c4c4'),
    stroke: '#000000',
    strokeWidth: 0,
    strokeDash: 'solid',
    radius: 0,
    ...partial,
  };
}

export function makeImage(src: string, w: number, h: number, partial: Partial<ImageElement> = {}): ImageElement {
  return {
    ...base(w, h),
    type: 'image',
    src,
    flipX: false,
    flipY: false,
    radius: 0,
    filters: { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
    crop: { x: 0, y: 0, w: 1, h: 1 },
    frame: 'none',
    ...partial,
  };
}

export function makeLine(partial: Partial<LineElement> = {}): LineElement {
  return {
    ...base(300, 20),
    type: 'line',
    color: '#000000',
    strokeWidth: 4,
    dash: 'solid',
    startCap: 'none',
    endCap: 'none',
    ...partial,
  };
}

export function makeIcon(icon: string, partial: Partial<IconElement> = {}): IconElement {
  return { ...base(160, 160), type: 'icon', icon, color: '#000000', strokeWidth: 2, ...partial };
}

export function makeDraw(
  points: [number, number][],
  color: string,
  strokeWidth: number,
  highlighter = false,
): DrawElement | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const pad = strokeWidth / 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(1, Math.max(...xs) + pad - minX);
  const h = Math.max(1, Math.max(...ys) + pad - minY);
  return {
    ...base(w, h, minX, minY),
    type: 'draw',
    points: points.map(([x, y]) => [x - minX, y - minY]),
    baseW: w,
    baseH: h,
    color,
    strokeWidth,
    highlighter,
    opacity: highlighter ? 0.4 : 1,
  };
}

export function makeTable(rows = 3, cols = 3): TableElement {
  return {
    ...base(cols * 160, rows * 56),
    type: 'table',
    rows: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (r === 0 ? `Heading ${c + 1}` : '')),
    ),
    headerColor: '#fde5dc',
    cellColor: '#ffffff',
    borderColor: '#c9c9c9',
    textColor: '#1a1a1a',
    fontSize: 20,
    fontFamily: 'Inter',
  };
}

export function makeChart(chart: ChartElement['chart']): ChartElement {
  return {
    ...base(480, 320),
    type: 'chart',
    chart,
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    values: [12, 19, 8, 15],
    colors: ['#ff5c39', '#16181d', '#2f6f6a', '#ffb347', '#8fb8de', '#c9b8a6'],
    textColor: '#333333',
    showValues: true,
  };
}

export function makeQr(value: string): QrElement {
  return { ...base(240, 240), type: 'qr', value, color: '#000000', background: '#ffffff' };
}

export function makeVideo(src: string, poster: string, duration: number, w: number, h: number, partial: Partial<VideoElement> = {}): VideoElement {
  return {
    ...base(w, h),
    type: 'video',
    src,
    poster,
    duration,
    trimStart: 0,
    trimEnd: duration,
    volume: 1,
    muted: false,
    loop: true,
    flipX: false,
    flipY: false,
    radius: 0,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    frame: 'none',
    ...partial,
  };
}

export function makeAudioTrack(src: string, name: string, duration: number, partial: Partial<AudioTrack> = {}): AudioTrack {
  return { id: uid(), src, name, duration, start: 0, trimStart: 0, trimEnd: duration, volume: 0.8, fadeIn: 0.5, fadeOut: 1.5, loop: true, ...partial };
}

// Deep copy with fresh ids. Elements sharing a group keep sharing a (new) group.
export function cloneElements(elements: DesignElement[], offset = 0): DesignElement[] {
  const groupMap = new Map<string, string>();
  return elements.map((el) => {
    const copy = structuredClone(el);
    copy.id = uid();
    copy.x += offset;
    copy.y += offset;
    if (copy.groupId) {
      if (!groupMap.has(copy.groupId)) groupMap.set(copy.groupId, uid());
      copy.groupId = groupMap.get(copy.groupId);
    }
    return copy;
  });
}

export function clonePage(page: Page): Page {
  return { ...structuredClone(page), id: uid(), elements: cloneElements(page.elements) };
}
