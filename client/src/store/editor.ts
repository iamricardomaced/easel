import { create } from 'zustand';
import type { DesignDoc, DesignElement, Fill, Page } from '../types';
import { cloneElements, clonePage, newPage, uid } from '../lib/factory';
import { elementAABB, selectionBox } from '../lib/geometry';

const HISTORY_LIMIT = 100;

export type Tool = 'select' | 'draw' | 'highlighter' | 'eraser' | 'hand';

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

interface EditorState {
  designId: string | null;
  title: string;
  doc: DesignDoc;
  pageIndex: number;
  selectedIds: string[];
  editingId: string | null;
  zoom: number;
  fitZoom: number;
  past: DesignDoc[];
  future: DesignDoc[];
  version: number; // bumps on every doc change, used for autosave
  tool: Tool;
  penColor: string;
  penWidth: number;
  showGrid: boolean;
  showRulers: boolean;
  snapping: boolean;

  load: (id: string, title: string, doc: DesignDoc) => void;
  setTitle: (title: string) => void;
  setZoom: (z: number) => void;
  setFitZoom: (z: number) => void;
  setTool: (t: Tool) => void;
  setPen: (color?: string, width?: number) => void;
  toggle: (key: 'showGrid' | 'showRulers' | 'snapping') => void;

  // History: `checkpoint` records the current doc so a following series of
  // `mutate(..., false)` calls (e.g. a drag) undoes as one step.
  checkpoint: () => void;
  mutate: (fn: (doc: DesignDoc) => void, record?: boolean) => void;
  undo: () => void;
  redo: () => void;

  page: () => Page;
  selected: () => DesignElement[];
  select: (ids: string[], additive?: boolean) => void;
  selectAll: () => void;
  setEditing: (id: string | null) => void;

  addElement: (el: DesignElement, opts?: { center?: boolean; select?: boolean }) => void;
  addElements: (els: DesignElement[]) => void;
  updateElement: (id: string, patch: Partial<DesignElement>, record?: boolean) => void;
  updateSelected: (patch: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>), record?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  nudge: (dx: number, dy: number) => void;
  group: () => void;
  ungroup: () => void;
  toggleLock: () => void;
  reorder: (dir: 'forward' | 'backward' | 'front' | 'back') => void;
  moveLayer: (id: string, toIndex: number) => void;
  align: (mode: AlignMode) => void;
  distribute: (axis: 'h' | 'v') => void;
  flip: (axis: 'x' | 'y') => void;

  setPageIndex: (i: number) => void;
  addPage: (afterIndex?: number) => void;
  duplicatePage: (i: number) => void;
  deletePage: (i: number) => void;
  movePage: (from: number, to: number) => void;
  setBackground: (fill: Fill, image?: string | null) => void;
  setPageField: (patch: Partial<Page>) => void;
  resizeDoc: (width: number, height: number, scaleContent: boolean) => void;
  applyTemplate: (pages: Page[], width: number, height: number, mode: 'replace-page' | 'append') => void;
}

let clipboard: DesignElement[] = [];
let pasteCount = 0;

const emptyDoc: DesignDoc = { width: 1080, height: 1080, unit: 'px', pages: [newPage()] };

export const useEditor = create<EditorState>((set, get) => {
  const pageEls = () => get().doc.pages[get().pageIndex].elements;

  // Expand a set of ids to include every member of any group they touch.
  const withGroups = (ids: string[]) => {
    const els = pageEls();
    const groups = new Set(els.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId));
    return els.filter((e) => ids.includes(e.id) || (e.groupId && groups.has(e.groupId))).map((e) => e.id);
  };

  return {
    designId: null,
    title: 'Untitled design',
    doc: emptyDoc,
    pageIndex: 0,
    selectedIds: [],
    editingId: null,
    zoom: 0.5,
    fitZoom: 0.5,
    past: [],
    future: [],
    version: 0,
    tool: 'select',
    penColor: '#ff5c39',
    penWidth: 8,
    showGrid: false,
    showRulers: false,
    snapping: true,

    load: (id, title, doc) =>
      set({ designId: id, title, doc, pageIndex: 0, selectedIds: [], editingId: null, past: [], future: [], version: 0 }),
    setTitle: (title) => set({ title }),
    setZoom: (z) => set({ zoom: Math.min(5, Math.max(0.05, z)) }),
    setFitZoom: (z) => set({ fitZoom: z }),
    setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [], editingId: null }),
    setPen: (color, width) => set({ penColor: color ?? get().penColor, penWidth: width ?? get().penWidth }),
    toggle: (key) => set({ [key]: !get()[key] } as Partial<EditorState>),

    checkpoint: () =>
      set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT + 1), structuredClone(s.doc)], future: [] })),

    mutate: (fn, record = true) => {
      const s = get();
      const next = structuredClone(s.doc);
      fn(next);
      set({
        doc: next,
        version: s.version + 1,
        ...(record ? { past: [...s.past.slice(-HISTORY_LIMIT + 1), s.doc], future: [] } : {}),
      });
    },

    undo: () => {
      const s = get();
      if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({
        doc: prev,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future],
        version: s.version + 1,
        pageIndex: Math.min(s.pageIndex, prev.pages.length - 1),
        selectedIds: [],
        editingId: null,
      });
    },
    redo: () => {
      const s = get();
      if (!s.future.length) return;
      const next = s.future[0];
      set({
        doc: next,
        past: [...s.past, s.doc],
        future: s.future.slice(1),
        version: s.version + 1,
        pageIndex: Math.min(s.pageIndex, next.pages.length - 1),
        selectedIds: [],
        editingId: null,
      });
    },

    page: () => get().doc.pages[get().pageIndex],
    selected: () => pageEls().filter((e) => get().selectedIds.includes(e.id)),
    select: (ids, additive = false) => {
      const expanded = withGroups(ids);
      if (!additive) return set({ selectedIds: expanded, editingId: null });
      const cur = new Set(get().selectedIds);
      const allIn = expanded.every((id) => cur.has(id));
      expanded.forEach((id) => (allIn ? cur.delete(id) : cur.add(id)));
      set({ selectedIds: [...cur], editingId: null });
    },
    selectAll: () => set({ selectedIds: pageEls().filter((e) => !e.locked).map((e) => e.id) }),
    setEditing: (id) => set({ editingId: id }),

    addElement: (el, opts = {}) => {
      const { center = true, select = true } = opts;
      const { doc } = get();
      if (center) {
        el.x = (doc.width - el.w) / 2;
        el.y = (doc.height - el.h) / 2;
      }
      get().mutate((d) => d.pages[get().pageIndex].elements.push(el));
      if (select) set({ selectedIds: [el.id], tool: 'select' });
    },
    addElements: (els) => {
      get().mutate((d) => d.pages[get().pageIndex].elements.push(...els));
      set({ selectedIds: els.map((e) => e.id) });
    },
    updateElement: (id, patch, record = true) =>
      get().mutate((d) => {
        const el = d.pages[get().pageIndex].elements.find((e) => e.id === id);
        if (el) Object.assign(el, patch);
      }, record),
    updateSelected: (patch, record = true) => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      get().mutate((d) => {
        for (const el of d.pages[get().pageIndex].elements) {
          if (!ids.includes(el.id)) continue;
          Object.assign(el, typeof patch === 'function' ? patch(el) : patch);
        }
      }, record);
    },
    deleteSelected: () => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      get().mutate((d) => {
        const p = d.pages[get().pageIndex];
        p.elements = p.elements.filter((e) => !ids.includes(e.id) || e.locked);
      });
      set({ selectedIds: [], editingId: null });
    },
    duplicateSelected: () => {
      const sel = get().selected();
      if (!sel.length) return;
      const copies = cloneElements(sel, 20).map((c) => ({ ...c, locked: false }));
      get().addElements(copies);
    },
    copy: () => {
      clipboard = structuredClone(get().selected());
      pasteCount = 0;
    },
    cut: () => {
      get().copy();
      get().deleteSelected();
    },
    paste: () => {
      if (!clipboard.length) return;
      pasteCount += 1;
      get().addElements(cloneElements(clipboard, 20 * pasteCount));
    },
    nudge: (dx, dy) => get().updateSelected((el) => (el.locked ? {} : { x: el.x + dx, y: el.y + dy })),
    group: () => {
      if (get().selectedIds.length < 2) return;
      const g = uid();
      get().updateSelected({ groupId: g });
    },
    ungroup: () => get().updateSelected({ groupId: undefined }),
    toggleLock: () => {
      const sel = get().selected();
      const lock = !sel.every((e) => e.locked);
      get().updateSelected({ locked: lock });
    },
    reorder: (dir) => {
      const ids = get().selectedIds;
      get().mutate((d) => {
        const p = d.pages[get().pageIndex];
        const sel = p.elements.filter((e) => ids.includes(e.id));
        const rest = p.elements.filter((e) => !ids.includes(e.id));
        if (dir === 'front') p.elements = [...rest, ...sel];
        else if (dir === 'back') p.elements = [...sel, ...rest];
        else {
          const arr = p.elements;
          const order = dir === 'forward' ? [...arr.keys()].reverse() : [...arr.keys()];
          for (const i of order) {
            if (!ids.includes(arr[i].id)) continue;
            const j = dir === 'forward' ? i + 1 : i - 1;
            if (j < 0 || j >= arr.length || ids.includes(arr[j].id)) continue;
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
        }
      });
    },
    moveLayer: (id, toIndex) =>
      get().mutate((d) => {
        const els = d.pages[get().pageIndex].elements;
        const from = els.findIndex((e) => e.id === id);
        if (from < 0) return;
        const [el] = els.splice(from, 1);
        els.splice(Math.max(0, Math.min(els.length, toIndex)), 0, el);
      }),
    align: (mode) => {
      const sel = get().selected().filter((e) => !e.locked);
      if (!sel.length) return;
      const { doc } = get();
      // One element (or one group) aligns to the page; several align to their bounds.
      const groups = new Set(sel.map((e) => e.groupId ?? e.id));
      const target =
        groups.size === 1 ? { x: 0, y: 0, w: doc.width, h: doc.height } : selectionBox(sel)!;
      const units = [...groups].map((g) => sel.filter((e) => (e.groupId ?? e.id) === g));
      const moves = new Map<string, { dx: number; dy: number }>();
      for (const unit of units) {
        const b = selectionBox(unit)!;
        let dx = 0;
        let dy = 0;
        if (mode === 'left') dx = target.x - b.x;
        if (mode === 'center') dx = target.x + target.w / 2 - (b.x + b.w / 2);
        if (mode === 'right') dx = target.x + target.w - (b.x + b.w);
        if (mode === 'top') dy = target.y - b.y;
        if (mode === 'middle') dy = target.y + target.h / 2 - (b.y + b.h / 2);
        if (mode === 'bottom') dy = target.y + target.h - (b.y + b.h);
        unit.forEach((e) => moves.set(e.id, { dx, dy }));
      }
      get().updateSelected((el) => {
        const m = moves.get(el.id);
        return m ? { x: el.x + m.dx, y: el.y + m.dy } : {};
      });
    },
    distribute: (axis) => {
      const sel = get().selected().filter((e) => !e.locked);
      if (sel.length < 3) return;
      const boxes = sel.map((e) => ({ e, b: elementAABB(e) }));
      const key = axis === 'h' ? 'x' : 'y';
      const size = axis === 'h' ? 'w' : 'h';
      boxes.sort((a, b) => a.b[key] - b.b[key]);
      const first = boxes[0].b;
      const last = boxes[boxes.length - 1].b;
      const total = boxes.reduce((s, x) => s + x.b[size], 0);
      const gap = (last[key] + last[size] - first[key] - total) / (boxes.length - 1);
      let cursor = first[key];
      const moves = new Map<string, number>();
      for (const { e, b } of boxes) {
        moves.set(e.id, cursor - b[key]);
        cursor += b[size] + gap;
      }
      get().updateSelected((el) => ({ [key]: el[key] + (moves.get(el.id) ?? 0) }));
    },
    flip: (axis) =>
      get().updateSelected((el) => {
        if (el.type !== 'image') return {};
        return axis === 'x' ? { flipX: !el.flipX } : { flipY: !el.flipY };
      }),

    setPageIndex: (i) => set({ pageIndex: i, selectedIds: [], editingId: null }),
    addPage: (afterIndex) => {
      const at = (afterIndex ?? get().pageIndex) + 1;
      get().mutate((d) => d.pages.splice(at, 0, newPage()));
      set({ pageIndex: at, selectedIds: [] });
    },
    duplicatePage: (i) => {
      get().mutate((d) => d.pages.splice(i + 1, 0, clonePage(d.pages[i])));
      set({ pageIndex: i + 1, selectedIds: [] });
    },
    deletePage: (i) => {
      if (get().doc.pages.length <= 1) return;
      get().mutate((d) => d.pages.splice(i, 1));
      set({ pageIndex: Math.max(0, Math.min(i, get().doc.pages.length - 1)), selectedIds: [] });
    },
    movePage: (from, to) => {
      if (to < 0 || to >= get().doc.pages.length) return;
      get().mutate((d) => {
        const [p] = d.pages.splice(from, 1);
        d.pages.splice(to, 0, p);
      });
      set({ pageIndex: to });
    },
    setBackground: (fill, image) =>
      get().mutate((d) => {
        const p = d.pages[get().pageIndex];
        p.background = fill;
        if (image !== undefined) p.backgroundImage = image ?? undefined;
      }),
    setPageField: (patch) => get().mutate((d) => Object.assign(d.pages[get().pageIndex], patch)),
    resizeDoc: (width, height, scaleContent) =>
      get().mutate((d) => {
        if (scaleContent) {
          const s = Math.min(width / d.width, height / d.height);
          const ox = (width - d.width * s) / 2;
          const oy = (height - d.height * s) / 2;
          for (const p of d.pages)
            for (const el of p.elements) {
              el.x = el.x * s + ox;
              el.y = el.y * s + oy;
              el.w *= s;
              el.h *= s;
              if (el.type === 'text') el.fontSize *= s;
              if ('strokeWidth' in el) el.strokeWidth *= s;
              if (el.type === 'table') el.fontSize *= s;
            }
        }
        d.width = width;
        d.height = height;
      }),
    applyTemplate: (pages, width, height, mode) => {
      const s = get();
      const fresh = pages.map(clonePage);
      // Scale template content to the current design size.
      const sc = Math.min(s.doc.width / width, s.doc.height / height);
      const ox = (s.doc.width - width * sc) / 2;
      const oy = (s.doc.height - height * sc) / 2;
      if (sc !== 1 || ox || oy)
        for (const p of fresh)
          for (const el of p.elements) {
            el.x = el.x * sc + ox;
            el.y = el.y * sc + oy;
            el.w *= sc;
            el.h *= sc;
            if (el.type === 'text') el.fontSize *= sc;
          }
      get().mutate((d) => {
        if (mode === 'replace-page') d.pages.splice(s.pageIndex, 1, ...fresh);
        else d.pages.splice(s.pageIndex + 1, 0, ...fresh);
      });
      set({ pageIndex: mode === 'replace-page' ? s.pageIndex : s.pageIndex + 1, selectedIds: [] });
    },
  };
});

// Exposed in development for debugging and browser tests.
if (import.meta.env.DEV) (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;
