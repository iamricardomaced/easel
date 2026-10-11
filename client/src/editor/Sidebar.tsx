import { lazy, Suspense, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { BarChart3, Brush, Cloud, Image as ImageIcon, Layers, LayoutTemplate, Palette, Shapes, Type } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useEditor } from '../store/editor';
import type { DesignElement, UploadItem } from '../types';
import { api } from '../api';
import { TEMPLATES } from '../lib/templates';
import { makeChart, makeImage, makeLine, makeQr, makeShape, makeTable, makeText, solid } from '../lib/factory';
import { SHAPE_KINDS } from '../lib/shapes';
import { StaticPage } from './ElementView';
import { uploadImageFile, uploadListeners } from '../lib/upload';
import { useBrandKit } from '../store/brand';
import { ColorPicker } from '../components/ui';
import { DEFAULT_COLORS } from '../lib/presets';
import { FONTS } from '../lib/fonts';

const IconSearch = lazy(() => import('./IconSearch'));

type PanelId = 'templates' | 'elements' | 'text' | 'brand' | 'uploads' | 'photos' | 'draw' | 'layers' | 'charts';

const TABS: { id: PanelId; label: string; icon: ReactNode }[] = [
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate size={20} /> },
  { id: 'elements', label: 'Elements', icon: <Shapes size={20} /> },
  { id: 'text', label: 'Text', icon: <Type size={20} /> },
  { id: 'brand', label: 'Brand', icon: <Palette size={20} /> },
  { id: 'uploads', label: 'Uploads', icon: <Cloud size={20} /> },
  { id: 'photos', label: 'Photos', icon: <ImageIcon size={20} /> },
  { id: 'charts', label: 'Charts', icon: <BarChart3 size={20} /> },
  { id: 'draw', label: 'Draw', icon: <Brush size={20} /> },
  { id: 'layers', label: 'Layers', icon: <Layers size={20} /> },
];

export function Sidebar() {
  const [panel, setPanel] = useState<PanelId | null>('templates');
  const setTool = useEditor((s) => s.setTool);
  return (
    <div className="flex h-full shrink-0">
      <nav className="flex w-[72px] flex-col items-center gap-1 bg-white border-r py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setPanel(panel === t.id ? null : t.id);
              if (t.id === 'draw') setTool('draw');
              else if (useEditor.getState().tool !== 'select') setTool('select');
            }}
            className={`flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] ${panel === t.id ? 'bg-brand/10 text-brand' : 'text-gray-500 hover:text-ink hover:bg-gray-100'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      {panel && (
        <div className="flex w-[340px] flex-col overflow-hidden border-r bg-white">
          <div className="flex-1 overflow-y-auto p-4">
            {panel === 'templates' && <TemplatesPanel />}
            {panel === 'elements' && <ElementsPanel />}
            {panel === 'text' && <TextPanel />}
            {panel === 'brand' && <BrandPanel />}
            {panel === 'uploads' && <UploadsPanel />}
            {panel === 'photos' && <PhotosPanel />}
            {panel === 'charts' && <ChartsPanel />}
            {panel === 'draw' && <DrawPanel />}
            {panel === 'layers' && <LayersPanel />}
          </div>
        </div>
      )}
    </div>
  );
}

// Click adds the element centred on the page; drag drops it where released.
function addable(make: () => DesignElement) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => e.dataTransfer.setData('application/x-design-element', JSON.stringify(make())),
    onClick: () => useEditor.getState().addElement(make()),
  };
}

const H = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-gray-800 first:mt-0">{children}</h3>;

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      className="mb-3 w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm outline-none focus:border-brand"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TemplatesPanel() {
  const [q, setQ] = useState('');
  const list = TEMPLATES.filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(q.toLowerCase()));
  const doc = useEditor((s) => s.doc);
  return (
    <>
      <Search value={q} onChange={setQ} placeholder="Search templates" />
      <p className="mb-3 text-xs text-gray-500">Click to replace the current page, or ⇧-click to add as new pages. Templates scale to your design size.</p>
      <div className="grid grid-cols-2 gap-3">
        {list.map((t) => {
          const scale = 148 / t.width;
          return (
            <button
              key={t.id}
              className="group text-left"
              onClick={(e) => {
                const s = useEditor.getState();
                const blank = s.page().elements.length === 0;
                s.applyTemplate(t.pages, t.width, t.height, e.shiftKey && !blank ? 'append' : 'replace-page');
              }}
            >
              <div className="overflow-hidden rounded-lg border group-hover:ring-2 group-hover:ring-brand" style={{ width: 148, height: t.height * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: t.width, height: t.height }}>
                  <StaticPage page={t.pages[0]} width={t.width} height={t.height} />
                </div>
              </div>
              <div className="mt-1 truncate text-xs font-medium">{t.name}</div>
              <div className="text-[11px] text-gray-500">
                {t.category}
                {t.pages.length > 1 ? ` · ${t.pages.length} pages` : ''}
                {Math.abs(t.width / t.height - doc.width / doc.height) < 0.02 ? ' · fits' : ''}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ElementsPanel() {
  return (
    <>
      <H>Shapes</H>
      <div className="grid grid-cols-4 gap-2">
        {SHAPE_KINDS.map((k) => {
          const el = makeShape(k, { w: 64, h: 64 });
          return (
            <button key={k} title={k} className="flex h-16 items-center justify-center rounded-lg hover:bg-gray-100" {...addable(() => makeShape(k))}>
              <div style={{ width: 48, height: 48, position: 'relative' }}>
                <MiniShape el={{ ...el, w: 48, h: 48 }} />
              </div>
            </button>
          );
        })}
        <button
          title="Outline square"
          className="flex h-16 items-center justify-center rounded-lg hover:bg-gray-100"
          {...addable(() => makeShape('rect', { fill: solid('#ffffff00'), stroke: '#000000', strokeWidth: 6 }))}
        >
          <div className="h-12 w-12 border-4 border-black" />
        </button>
        <button
          title="Outline circle"
          className="flex h-16 items-center justify-center rounded-lg hover:bg-gray-100"
          {...addable(() => makeShape('ellipse', { fill: solid('#ffffff00'), stroke: '#000000', strokeWidth: 6 }))}
        >
          <div className="h-12 w-12 rounded-full border-4 border-black" />
        </button>
      </div>
      <H>Lines</H>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Line', p: {} },
          { label: 'Dashed', p: { dash: 'dashed' as const } },
          { label: 'Arrow', p: { endCap: 'arrow' as const } },
          { label: 'Double arrow', p: { endCap: 'arrow' as const, startCap: 'arrow' as const } },
          { label: 'Dotted', p: { dash: 'dotted' as const, strokeWidth: 6 } },
          { label: 'Connector', p: { startCap: 'circle' as const, endCap: 'circle' as const } },
        ].map(({ label, p }) => (
          <button key={label} className="rounded-lg border px-2 py-3 text-xs hover:bg-gray-50" {...addable(() => makeLine(p))}>
            {label}
          </button>
        ))}
      </div>
      <H>Frames</H>
      <p className="mb-2 text-xs text-gray-500">Drop a photo or upload onto a frame to fill it.</p>
      <div className="grid grid-cols-3 gap-2">
        {(['none', 'circle', 'heart', 'star', 'hexagon', 'triangle'] as const).map((fr) => (
          <button
            key={fr}
            className="rounded-lg border px-2 py-3 text-xs capitalize hover:bg-gray-50"
            {...addable(() => makeImage(`https://picsum.photos/seed/frame-${fr}/600/600`, 300, 300, { frame: fr }))}
          >
            {fr === 'none' ? 'Square' : fr}
          </button>
        ))}
      </div>
      <H>Tables</H>
      <div className="grid grid-cols-3 gap-2">
        {[
          [2, 2],
          [3, 3],
          [4, 4],
        ].map(([r, c]) => (
          <button key={`${r}x${c}`} className="rounded-lg border px-2 py-3 text-xs hover:bg-gray-50" {...addable(() => makeTable(r, c))}>
            {r}×{c} table
          </button>
        ))}
      </div>
      <H>QR code</H>
      <button className="w-full rounded-lg border px-2 py-3 text-xs hover:bg-gray-50" {...addable(() => makeQr('https://example.com'))}>
        Add QR code
      </button>
      <H>Icons</H>
      <Suspense fallback={<div className="text-xs text-gray-400">Loading icons…</div>}>
        <IconSearch />
      </Suspense>
    </>
  );
}

function MiniShape({ el }: { el: ReturnType<typeof makeShape> }) {
  return (
    <div style={{ width: el.w, height: el.h }}>
      <StaticPage page={{ id: 'p', background: solid('transparent'), elements: [{ ...el, x: 0, y: 0, fill: solid('#9ca3af') }] }} width={el.w} height={el.h} />
    </div>
  );
}

function TextPanel() {
  const brand = useBrandKit((s) => s.kit);
  return (
    <>
      <button
        className="mb-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        {...addable(() => makeText({ text: 'Your paragraph text', fontSize: 32 }))}
      >
        Add a text box
      </button>
      <H>Default text styles</H>
      <div className="space-y-2">
        <button className="w-full rounded-lg border px-3 py-3 text-left text-2xl font-bold hover:bg-gray-50" {...addable(() => makeText({ text: 'Add a heading', fontSize: 96, fontWeight: 700, fontFamily: brand.fonts.heading }))}>
          Add a heading
        </button>
        <button className="w-full rounded-lg border px-3 py-3 text-left text-lg font-medium hover:bg-gray-50" {...addable(() => makeText({ text: 'Add a subheading', fontSize: 56, fontWeight: 700, fontFamily: brand.fonts.heading }))}>
          Add a subheading
        </button>
        <button className="w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-gray-50" {...addable(() => makeText({ text: 'Add a little bit of body text', fontSize: 32, fontFamily: brand.fonts.body }))}>
          Add a little bit of body text
        </button>
      </div>
      <H>Font combinations</H>
      <div className="grid grid-cols-2 gap-2">
        {[
          { a: 'Playfair Display', b: 'Lato', t: 'Elegant' },
          { a: 'Bebas Neue', b: 'Montserrat', t: 'BOLD NEWS' },
          { a: 'Pacifico', b: 'Quicksand', t: 'Hello summer' },
          { a: 'Space Grotesk', b: 'Inter', t: 'Tech launch' },
          { a: 'Anton', b: 'Roboto', t: 'BIG SALE' },
          { a: 'Great Vibes', b: 'Cormorant Garamond', t: 'Wedding' },
        ].map((c) => (
          <button
            key={c.t}
            className="rounded-lg border bg-gray-50 p-3 text-center hover:bg-gray-100"
            onClick={() => {
              const head = makeText({ text: c.t, fontFamily: c.a, fontSize: 110, w: 800 });
              const sub = makeText({ text: 'Add supporting text here', fontFamily: c.b, fontSize: 36, w: 800 });
              const { doc } = useEditor.getState();
              head.x = sub.x = (doc.width - 800) / 2;
              head.y = doc.height / 2 - 130;
              sub.y = doc.height / 2 + 30;
              const g = crypto.randomUUID();
              head.groupId = sub.groupId = g;
              useEditor.getState().addElements([head, sub]);
            }}
          >
            <div className="text-xl" style={{ fontFamily: c.a }}>
              {c.t}
            </div>
            <div className="text-[11px]" style={{ fontFamily: c.b }}>
              Add supporting text
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function BrandPanel() {
  const { kit, save } = useBrandKit();
  const [editing, setEditing] = useState<number | null>(null);
  const apply = (color: string) => {
    const s = useEditor.getState();
    if (s.selectedIds.length)
      s.updateSelected((el) =>
        el.type === 'text' || el.type === 'icon' || el.type === 'line' || el.type === 'draw'
          ? { color }
          : el.type === 'shape'
            ? { fill: { type: 'solid', color } }
            : {},
      );
    else s.setBackground({ type: 'solid', color });
  };
  return (
    <>
      <H>Brand colours</H>
      <p className="mb-2 text-xs text-gray-500">Click to apply to the selection (or page background). Saved to your account.</p>
      <div className="flex flex-wrap gap-2">
        {kit.colors.map((c, i) => (
          <div key={i} className="group relative">
            <button className="h-10 w-10 rounded-lg border border-black/10" style={{ background: c }} onClick={() => apply(c)} onDoubleClick={() => setEditing(i)} title={`${c} · double-click to edit`} />
            <button
              className="absolute -right-1 -top-1 hidden h-4 w-4 rounded-full bg-gray-800 text-[10px] leading-4 text-white group-hover:block"
              onClick={() => save({ ...kit, colors: kit.colors.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </div>
        ))}
        <button className="h-10 w-10 rounded-lg border border-dashed text-gray-500" onClick={() => save({ ...kit, colors: [...kit.colors, DEFAULT_COLORS[kit.colors.length % DEFAULT_COLORS.length]] })}>
          +
        </button>
      </div>
      {editing !== null && kit.colors[editing] && (
        <div className="mt-3 rounded-lg border p-3">
          <ColorPicker value={kit.colors[editing]} onChange={(c) => save({ ...kit, colors: kit.colors.map((x, j) => (j === editing ? c : x)) })} />
          <button className="mt-2 text-xs text-brand" onClick={() => setEditing(null)}>
            Done
          </button>
        </div>
      )}
      <H>Brand fonts</H>
      {(['heading', 'body'] as const).map((k) => (
        <label key={k} className="mb-2 block text-xs capitalize text-gray-600">
          {k}
          <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={kit.fonts[k]} onChange={(e) => save({ ...kit, fonts: { ...kit.fonts, [k]: e.target.value } })}>
            {FONTS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      ))}
    </>
  );
}

function UploadsPanel() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = () => api.listUploads().then(setItems).catch(() => {});
  useEffect(() => {
    refresh();
    uploadListeners.add(refresh);
    return () => {
      uploadListeners.delete(refresh);
    };
  }, []);
  const doc = useEditor((s) => s.doc);
  const fit = (w: number, h: number) => {
    const k = Math.min(1, (doc.width * 0.6) / w, (doc.height * 0.6) / h);
    return [w * k, h * k] as const;
  };
  return (
    <>
      <label className="mb-4 block w-full cursor-pointer rounded-lg bg-brand py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-strong">
        {busy ? 'Uploading…' : 'Upload files'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            setBusy(true);
            for (const f of [...(e.target.files ?? [])]) await uploadImageFile(f);
            setBusy(false);
            e.target.value = '';
          }}
        />
      </label>
      <p className="mb-3 text-xs text-gray-500">You can also drag images from your computer straight onto the page.</p>
      <div className="columns-2 gap-2">
        {items.map((u) => {
          const [w, h] = fit(u.width ?? 400, u.height ?? 400);
          return (
            <div key={u.id} className="group relative mb-2 break-inside-avoid">
              <img src={u.url} alt={u.filename} className="w-full cursor-pointer rounded-md hover:opacity-90" {...addable(() => makeImage(u.url, w, h))} />
              <button
                className="absolute right-1 top-1 hidden rounded bg-black/60 px-1.5 text-xs text-white group-hover:block"
                onClick={() => api.deleteUpload(u.id).then(refresh)}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PhotosPanel() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const photos = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const portrait = i % 3 === 1;
        return { seed: `${debounced || 'canvas'}-${i}`, w: portrait ? 600 : 800, h: portrait ? 800 : 560 };
      }),
    [debounced],
  );
  const doc = useEditor((s) => s.doc);
  return (
    <>
      <Search value={q} onChange={setQ} placeholder="Search photos" />
      <p className="mb-3 text-xs text-gray-500">Free stock photos from Lorem Picsum. Drag onto an image or frame to replace it.</p>
      <div className="columns-2 gap-2">
        {photos.map((p) => {
          const k = Math.min((doc.width * 0.6) / p.w, (doc.height * 0.6) / p.h);
          const src = `https://picsum.photos/seed/${encodeURIComponent(p.seed)}/${p.w * 2}/${p.h * 2}`;
          return (
            <img
              key={p.seed}
              src={`https://picsum.photos/seed/${encodeURIComponent(p.seed)}/${p.w / 4}/${p.h / 4}`}
              alt=""
              loading="lazy"
              className="mb-2 w-full cursor-pointer rounded-md hover:opacity-90"
              style={{ aspectRatio: `${p.w}/${p.h}` }}
              {...addable(() => makeImage(src, p.w * k, p.h * k))}
            />
          );
        })}
      </div>
    </>
  );
}

function ChartsPanel() {
  return (
    <>
      <H>Charts</H>
      <div className="grid grid-cols-2 gap-2">
        {(['bar', 'line', 'pie', 'donut'] as const).map((c) => {
          const el = makeChart(c);
          return (
            <button key={c} className="rounded-lg border p-2 text-xs capitalize hover:bg-gray-50" {...addable(() => makeChart(c))}>
              <div className="pointer-events-none" style={{ width: 130, height: 87, overflow: 'hidden' }}>
                <div style={{ transform: `scale(${130 / el.w})`, transformOrigin: 'top left' }}>
                  <StaticPage page={{ id: c, background: solid('#fff'), elements: [{ ...el, x: 0, y: 0 }] }} width={el.w} height={el.h} />
                </div>
              </div>
              {c} chart
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">Select a chart and use “Edit data” in the toolbar to change labels, values and colours.</p>
    </>
  );
}

function DrawPanel() {
  const { tool, penColor, penWidth, setTool, setPen } = useEditor(
    useShallow((s) => ({ tool: s.tool, penColor: s.penColor, penWidth: s.penWidth, setTool: s.setTool, setPen: s.setPen })),
  );
  return (
    <>
      <H>Tools</H>
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ['draw', 'Pen'],
            ['highlighter', 'Highlighter'],
            ['eraser', 'Eraser'],
            ['select', 'Select'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} className={`rounded-lg border py-3 text-xs ${tool === t ? 'border-brand bg-brand/10' : ''}`} onClick={() => setTool(t)}>
            {label}
          </button>
        ))}
      </div>
      <H>Colour</H>
      <ColorPicker value={penColor} onChange={(c) => setPen(c)} />
      <H>Weight</H>
      <input type="range" min={1} max={60} value={penWidth} onChange={(e) => setPen(undefined, Number(e.target.value))} className="w-full accent-brand" />
      <p className="mt-3 text-xs text-gray-500">Draw directly on the page. The eraser removes whole strokes.</p>
    </>
  );
}

function LayersPanel() {
  const page = useEditor((s) => s.page());
  const selectedIds = useEditor((s) => s.selectedIds);
  const s = useEditor.getState();
  const [dragId, setDragId] = useState<string | null>(null);
  const items = [...page.elements].reverse();
  const label = (el: DesignElement) =>
    el.name ||
    (el.type === 'text'
      ? el.text.slice(0, 30) || 'Text'
      : el.type === 'shape'
        ? `Shape · ${el.shape}`
        : el.type === 'icon'
          ? `Icon · ${el.icon}`
          : el.type[0].toUpperCase() + el.type.slice(1));
  return (
    <>
      <H>Layers</H>
      {!items.length && <p className="text-xs text-gray-500">This page is empty.</p>}
      <div className="space-y-1">
        {items.map((el) => (
          <div
            key={el.id}
            draggable
            onDragStart={() => setDragId(el.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId || dragId === el.id) return;
              s.moveLayer(dragId, page.elements.findIndex((x) => x.id === el.id));
              setDragId(null);
            }}
            onClick={(e) => s.select([el.id], e.shiftKey)}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm ${selectedIds.includes(el.id) ? 'border-brand bg-brand/5' : 'hover:bg-gray-50'}`}
          >
            <span className="cursor-grab text-gray-400">⋮⋮</span>
            <span className="flex-1 truncate">{label(el)}</span>
            {el.groupId && <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">group</span>}
            <button
              className="text-xs text-gray-500 hover:text-gray-900"
              onClick={(e) => {
                e.stopPropagation();
                s.updateElement(el.id, { locked: !el.locked });
              }}
            >
              {el.locked ? '🔒' : '🔓'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
