import type { DesignElement } from '../types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const deg2rad = (d: number) => (d * Math.PI) / 180;

export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): [number, number] {
  const r = deg2rad(deg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

// Axis-aligned bounding box of a rotated element.
export function elementAABB(el: Box & { rotation: number }): Box {
  if (!el.rotation) return { x: el.x, y: el.y, w: el.w, h: el.h };
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const pts = [
    rotatePoint(el.x, el.y, cx, cy, el.rotation),
    rotatePoint(el.x + el.w, el.y, cx, cy, el.rotation),
    rotatePoint(el.x + el.w, el.y + el.h, cx, cy, el.rotation),
    rotatePoint(el.x, el.y + el.h, cx, cy, el.rotation),
  ];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

export function selectionBox(elements: DesignElement[]): Box | null {
  return unionBox(elements.map(elementAABB));
}

export function intersects(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// Resize a (possibly rotated) box by dragging one handle. The opposite handle stays fixed
// in page space. dx/dy are the pointer delta in page space.
export function resizeBox(
  start: Box & { rotation: number },
  handle: Handle,
  dx: number,
  dy: number,
  keepRatio: boolean,
  minSize = 8,
): Box {
  const r = deg2rad(start.rotation);
  // Pointer delta in the element's local frame.
  const ldx = dx * Math.cos(r) + dy * Math.sin(r);
  const ldy = -dx * Math.sin(r) + dy * Math.cos(r);

  const sx = handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0;
  const sy = handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0;

  let w = start.w + sx * ldx;
  let h = start.h + sy * ldy;

  if (keepRatio && sx !== 0 && sy !== 0) {
    const ratio = start.w / start.h;
    if (Math.abs(w / start.w) > Math.abs(h / start.h)) h = w / ratio;
    else w = h * ratio;
  }
  w = Math.max(minSize, w);
  h = Math.max(minSize, h);

  // The fixed anchor in local coordinates relative to the centre.
  const ax = (-sx * start.w) / 2;
  const ay = (-sy * start.h) / 2;
  const cx0 = start.x + start.w / 2;
  const cy0 = start.y + start.h / 2;
  const [anchorX, anchorY] = rotatePoint(cx0 + ax, cy0 + ay, cx0, cy0, start.rotation);

  // New centre: anchor plus the rotated offset from the anchor to the new centre.
  const ox = (sx * w) / 2;
  const oy = (sy * h) / 2;
  const ncx = anchorX + ox * Math.cos(r) - oy * Math.sin(r);
  const ncy = anchorY + ox * Math.sin(r) + oy * Math.cos(r);
  return { x: ncx - w / 2, y: ncy - h / 2, w, h };
}

export interface Guide {
  orientation: 'v' | 'h';
  pos: number;
}

// Snap a moving box to page edges/centre and other element edges/centres.
export function snapBox(box: Box, targets: Box[], page: { w: number; h: number }, threshold: number) {
  const xs = [0, page.w / 2, page.w];
  const ys = [0, page.h / 2, page.h];
  for (const t of targets) {
    xs.push(t.x, t.x + t.w / 2, t.x + t.w);
    ys.push(t.y, t.y + t.h / 2, t.y + t.h);
  }
  const mine = {
    x: [box.x, box.x + box.w / 2, box.x + box.w],
    y: [box.y, box.y + box.h / 2, box.y + box.h],
  };
  let bestDx = 0;
  let bestX = threshold + 1;
  let gx: number | null = null;
  for (const m of mine.x)
    for (const t of xs) {
      const d = t - m;
      if (Math.abs(d) < Math.abs(bestX)) {
        bestX = d;
        bestDx = d;
        gx = t;
      }
    }
  let bestDy = 0;
  let bestY = threshold + 1;
  let gy: number | null = null;
  for (const m of mine.y)
    for (const t of ys) {
      const d = t - m;
      if (Math.abs(d) < Math.abs(bestY)) {
        bestY = d;
        bestDy = d;
        gy = t;
      }
    }
  const guides: Guide[] = [];
  let dx = 0;
  let dy = 0;
  if (Math.abs(bestX) <= threshold && gx !== null) {
    dx = bestDx;
    guides.push({ orientation: 'v', pos: gx });
  }
  if (Math.abs(bestY) <= threshold && gy !== null) {
    dy = bestDy;
    guides.push({ orientation: 'h', pos: gy });
  }
  return { dx, dy, guides };
}
