import type { DesignDoc, DesignElement, Page } from '../types';

// Three-way merge used when a collaborator's save arrives while we have unsaved
// changes. Works per page and per element: whatever we changed since the last sync
// wins, everything else takes the collaborator's version.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeList<T extends { id: string }>(base: T[], local: T[], remote: T[], mergeItem: (b: T | undefined, l: T, r: T) => T): T[] {
  const byId = (xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const B = byId(base);
  const L = byId(local);
  const R = byId(remote);
  // Order: take whichever side reordered; prefer ours if both did.
  const order = same(local.map((x) => x.id), base.map((x) => x.id)) ? remote.map((x) => x.id) : local.map((x) => x.id);
  // Items one side added that the chosen order lacks.
  for (const x of [...local, ...remote]) if (!order.includes(x.id) && !B.has(x.id)) order.push(x.id);
  const out: T[] = [];
  for (const id of order) {
    const b = B.get(id);
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) out.push(mergeItem(b, l, r));
    else if (l && !r) {
      // Remote deleted it; keep it only if we changed it (or added it).
      if (!b || !same(b, l)) out.push(l);
    } else if (r && !l) {
      if (!b || !same(b, r)) out.push(r);
    }
  }
  return out;
}

const mergeElement = (b: DesignElement | undefined, l: DesignElement, r: DesignElement) => (b && same(b, l) ? r : l);

function mergePage(b: Page | undefined, l: Page, r: Page): Page {
  const { elements: be = [], ...bRest } = b ?? ({} as Page);
  const { elements: le, ...lRest } = l;
  const { elements: re, ...rRest } = r;
  const props = b && same(bRest, lRest) ? rRest : lRest;
  return { ...props, elements: mergeList(be, le, re, mergeElement) } as Page;
}

export function mergeDocs(base: DesignDoc, local: DesignDoc, remote: DesignDoc): DesignDoc {
  const { pages: bp, ...bRest } = base;
  const { pages: lp, ...lRest } = local;
  const { pages: rp, ...rRest } = remote;
  const props = same(bRest, lRest) ? rRest : lRest;
  return { ...props, pages: mergeList(bp, lp, rp, mergePage) } as DesignDoc;
}
