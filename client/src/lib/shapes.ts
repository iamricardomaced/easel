import type { ShapeKind } from '../types';

const poly = (pts: [number, number][]) => `M${pts.map((p) => p.join(',')).join('L')}Z`;

function regular(n: number, w: number, h: number, rotate = -Math.PI / 2): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = rotate + (i * 2 * Math.PI) / n;
    return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)];
  });
}

// SVG path for a shape filling a w×h box. Rect and ellipse are drawn as native elements.
export function shapePath(kind: ShapeKind, w: number, h: number): string {
  switch (kind) {
    case 'triangle':
      return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'diamond':
      return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'pentagon':
      return poly(regular(5, w, h));
    case 'hexagon':
      return poly(regular(6, w, h, 0));
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 1 : 0.4;
        pts.push([w / 2 + (w / 2) * r * Math.cos(a), h / 2 + (h / 2) * r * Math.sin(a)]);
      }
      return poly(pts);
    }
    case 'heart':
      return `M${w / 2},${h * 0.92} C${w * 0.05},${h * 0.6} ${-w * 0.05},${h * 0.2} ${w * 0.25},${h * 0.08} C${w * 0.4},${h * 0.02} ${w * 0.5},${h * 0.15} ${w / 2},${h * 0.25} C${w * 0.5},${h * 0.15} ${w * 0.6},${h * 0.02} ${w * 0.75},${h * 0.08} C${w * 1.05},${h * 0.2} ${w * 0.95},${h * 0.6} ${w / 2},${h * 0.92}Z`;
    case 'arrow':
      return poly([[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]]);
    case 'speech': {
      const r = Math.min(w, h) * 0.12;
      const bh = h * 0.78;
      return `M${r},0 H${w - r} Q${w},0 ${w},${r} V${bh - r} Q${w},${bh} ${w - r},${bh} H${w * 0.4} L${w * 0.2},${h} L${w * 0.24},${bh} H${r} Q0,${bh} 0,${bh - r} V${r} Q0,0 ${r},0Z`;
    }
    case 'cross': {
      const t = 0.33;
      return poly([
        [w * t, 0], [w * (1 - t), 0], [w * (1 - t), h * t], [w, h * t], [w, h * (1 - t)], [w * (1 - t), h * (1 - t)],
        [w * (1 - t), h], [w * t, h], [w * t, h * (1 - t)], [0, h * (1 - t)], [0, h * t], [w * t, h * t],
      ]);
    }
    default:
      return poly([[0, 0], [w, 0], [w, h], [0, h]]);
  }
}

export const SHAPE_KINDS: ShapeKind[] = [
  'rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'arrow', 'speech', 'cross',
];

const HEART_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M50,92 C5,60 -5,20 25,8 C40,2 50,15 50,25 C50,15 60,2 75,8 C105,20 95,60 50,92Z'/></svg>",
)}")`;

// CSS for image frames: clip-path for polygons, a mask for curved outlines.
export function frameStyle(frame: string | undefined): Record<string, string> {
  switch (frame) {
    case 'circle':
      return { clipPath: 'ellipse(50% 50% at 50% 50%)' };
    case 'triangle':
      return { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' };
    case 'hexagon':
      return { clipPath: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' };
    case 'star':
      return { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' };
    case 'heart':
      return { maskImage: HEART_MASK, WebkitMaskImage: HEART_MASK, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' };
    default:
      return {};
  }
}
