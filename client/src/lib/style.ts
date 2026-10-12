import type { DesignElement } from '../types';

// Style properties that "Copy style" carries from one element to another.
const BY_TYPE: Record<string, string[]> = {
  text: ['fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'strike', 'uppercase', 'color', 'align', 'lineHeight', 'letterSpacing', 'background', 'effect', 'effectColor'],
  shape: ['fill', 'stroke', 'strokeWidth', 'strokeDash', 'radius', 'textColor', 'fontFamily', 'fontSize'],
  image: ['filters', 'radius', 'border'],
  video: ['radius'],
  line: ['color', 'strokeWidth', 'dash', 'startCap', 'endCap'],
  icon: ['color', 'strokeWidth'],
  draw: ['color', 'strokeWidth'],
  table: ['headerColor', 'cellColor', 'borderColor', 'textColor', 'fontSize', 'fontFamily'],
  chart: ['colors', 'textColor'],
  qr: ['color', 'background'],
};
const COMMON = ['opacity', 'shadow', 'animation', 'animateOut'];

const mainColor = (el: DesignElement): string | undefined =>
  el.type === 'shape' ? el.fill.color : 'color' in el ? (el.color as string) : el.type === 'table' ? el.headerColor : undefined;

export function stylePatch(from: DesignElement, to: DesignElement): Partial<DesignElement> {
  const patch: Record<string, unknown> = {};
  for (const k of COMMON) patch[k] = structuredClone((from as unknown as Record<string, unknown>)[k]);
  if (from.type === to.type) {
    for (const k of BY_TYPE[from.type] ?? []) patch[k] = structuredClone((from as unknown as Record<string, unknown>)[k]);
    return patch as Partial<DesignElement>;
  }
  // Different kinds of element: carry the main colour across.
  const c = mainColor(from);
  if (c) {
    if (to.type === 'shape') patch.fill = { type: 'solid', color: c };
    else if ('color' in to) patch.color = c;
  }
  if (from.type === 'text' && to.type === 'shape') patch.fontFamily = from.fontFamily;
  if (from.type === 'shape' && to.type === 'text' && from.fontFamily) patch.fontFamily = from.fontFamily;
  return patch as Partial<DesignElement>;
}
