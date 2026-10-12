import { useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEditor } from '../store/editor';
import { Modal } from '../components/ui';
import { StaticPage } from './ElementView';
import { SIZE_PRESETS } from '../lib/presets';
import { api } from '../api';
import { toast } from '../lib/toast';
import type { DesignDoc } from '../types';

// ---------- Find and replace ----------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function FindReplace({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const re = useMemo(() => (find ? new RegExp(escapeRe(find), matchCase ? 'g' : 'gi') : null), [find, matchCase]);
  const hits = useMemo(() => {
    if (!re) return [];
    const out: { page: number; id: string; text: string; count: number }[] = [];
    doc.pages.forEach((p, i) =>
      p.elements.forEach((el) => {
        const text = el.type === 'text' ? el.text : el.type === 'shape' ? (el.text ?? '') : el.type === 'table' ? el.rows.flat().join(' · ') : '';
        const count = text.match(re)?.length ?? 0;
        if (count) out.push({ page: i, id: el.id, text, count });
      }),
    );
    return out;
  }, [doc, re]);
  const total = hits.reduce((s, h) => s + h.count, 0);
  const replaceIn = (ids: string[] | null) => {
    if (!re) return;
    useEditor.getState().mutate((d) => {
      for (const p of d.pages)
        for (const el of p.elements) {
          if (ids && !ids.includes(el.id)) continue;
          if (el.type === 'text') el.text = el.text.replace(re, replace);
          else if (el.type === 'shape' && el.text) el.text = el.text.replace(re, replace);
          else if (el.type === 'table') el.rows = el.rows.map((r) => r.map((c) => c.replace(re, replace)));
        }
    });
  };
  return (
    <Modal title="Find and replace" onClose={onClose} width={480}>
      <div className="space-y-3 text-sm text-gray-800" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
        <input autoFocus className="w-full rounded-lg border px-3 py-2" placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} data-testid="find-input" />
        <input className="w-full rounded-lg border px-3 py-2" placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} data-testid="replace-input" />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="accent-brand" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
        </label>
        <div className="text-xs text-gray-500">{find ? `${total} match${total === 1 ? '' : 'es'} in ${hits.length} element${hits.length === 1 ? '' : 's'}` : 'Searches text, shapes and tables on every page.'}</div>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {hits.map((h) => (
            <div key={h.id} className="flex items-center gap-2 rounded border px-2 py-1.5">
              <button
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => {
                  const s = useEditor.getState();
                  s.setPageIndex(h.page);
                  s.select([h.id]);
                  document.querySelector(`[data-page-index="${h.page}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <span className="mr-2 text-xs text-gray-400">p{h.page + 1}</span>
                {h.text}
              </button>
              <button className="rounded px-2 py-0.5 text-xs hover:bg-gray-100" onClick={() => replaceIn([h.id])}>
                Replace
              </button>
            </div>
          ))}
        </div>
        <button disabled={!total} className="w-full rounded-lg bg-brand py-2 font-semibold text-white disabled:opacity-50" onClick={() => { replaceIn(null); toast(`Replaced ${total}`); }} data-testid="replace-all">
          Replace all
        </button>
      </div>
    </Modal>
  );
}

// ---------- Page grid view ----------

export function GridView({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const pageIndex = useEditor((s) => s.pageIndex);
  const [drag, setDrag] = useState<number | null>(null);
  const s = useEditor.getState();
  const k = 200 / Math.max(doc.width, doc.height);
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper" data-testid="grid-view">
      <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-3">
        <h2 className="font-semibold">All pages ({doc.pages.length})</h2>
        <span className="text-xs text-gray-500">Drag to reorder. Click a page to open it.</span>
        <button className="rounded-lg bg-ink px-4 py-1.5 text-sm text-white" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="flex flex-wrap gap-6 p-8">
        {doc.pages.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null && drag !== i) s.movePage(drag, i);
              setDrag(null);
            }}
            className={`group relative ${drag === i ? 'opacity-40' : ''}`}
            data-testid="grid-page"
          >
            <button
              className={`block overflow-hidden rounded-md border-2 bg-white shadow-sm ${i === pageIndex ? 'border-brand' : 'border-transparent'} ${p.hidden ? 'opacity-50' : ''}`}
              style={{ width: doc.width * k, height: doc.height * k }}
              onClick={() => {
                s.setPageIndex(i);
                onClose();
                setTimeout(() => document.querySelector(`[data-page-index="${i}"]`)?.scrollIntoView({ block: 'center' }), 50);
              }}
            >
              <div className="pointer-events-none" style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
                <StaticPage page={p} width={doc.width} height={doc.height} />
              </div>
            </button>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
              <span>
                {i + 1}
                {p.title ? ` · ${p.title}` : ''}
                {p.hidden ? ' · hidden' : ''}
              </span>
              <span className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                <button className="rounded p-1 hover:bg-gray-200" title={p.hidden ? 'Show' : 'Hide'} onClick={() => s.setPageAt(i, { hidden: !p.hidden })}>
                  {p.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button className="rounded p-1 hover:bg-gray-200" title="Duplicate" onClick={() => s.duplicatePage(i)}>
                  <Copy size={13} />
                </button>
                <button className="rounded p-1 hover:bg-gray-200 disabled:opacity-30" disabled={doc.pages.length === 1} title="Delete" onClick={() => s.deletePage(i)}>
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          </div>
        ))}
        <button className="rounded-md border-2 border-dashed text-3xl text-gray-400 hover:text-ink" style={{ width: doc.width * k, height: doc.height * k }} onClick={() => s.addPage(doc.pages.length - 1)}>
          +
        </button>
      </div>
    </div>
  );
}

// ---------- Magic resize ----------

// Scales and re-centres every element into a new canvas size.
export function resizedDoc(doc: DesignDoc, width: number, height: number): DesignDoc {
  const d = structuredClone(doc);
  const sc = Math.min(width / d.width, height / d.height);
  const ox = (width - d.width * sc) / 2;
  const oy = (height - d.height * sc) / 2;
  for (const p of d.pages)
    for (const el of p.elements) {
      el.x = el.x * sc + ox;
      el.y = el.y * sc + oy;
      el.w *= sc;
      el.h *= sc;
      if (el.type === 'text' || el.type === 'table') el.fontSize *= sc;
      if (el.type === 'shape' && el.fontSize) el.fontSize *= sc;
      if ('strokeWidth' in el) el.strokeWidth *= sc;
    }
  d.width = width;
  d.height = height;
  return d;
}

export function MagicResize({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const title = useEditor((s) => s.title);
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState({ on: false, w: doc.width, h: doc.height });
  const [busy, setBusy] = useState(false);
  const sizes = [...SIZE_PRESETS.filter((p) => picked.includes(p.id)).map((p) => ({ label: p.label, w: p.width, h: p.height })), ...(custom.on ? [{ label: `${custom.w}×${custom.h}`, w: custom.w, h: custom.h }] : [])];
  const copyAll = async () => {
    setBusy(true);
    const made = [];
    for (const z of sizes) made.push(await api.createDesign(`${title} (${z.label})`, resizedDoc(useEditor.getState().doc, z.w, z.h)));
    setBusy(false);
    toast(`Created ${made.length} resized cop${made.length === 1 ? 'y' : 'ies'}`);
    onClose();
    if (made.length === 1) navigate(`/design/${made[0].id}`);
  };
  const resizeThis = () => {
    const z = sizes[0];
    useEditor.getState().mutate((d) => Object.assign(d, resizedDoc(d, z.w, z.h)));
    onClose();
  };
  return (
    <Modal title="Resize & Magic Switch" onClose={onClose} width={560}>
      <div className="text-sm text-gray-800">
        <p className="mb-3 text-xs text-gray-500">Pick one or more sizes. “Copy & resize” makes a new design for each; content scales to fit.</p>
        <div className="mb-3 grid max-h-72 grid-cols-2 gap-1 overflow-auto">
          {SIZE_PRESETS.map((p) => (
            <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 hover:bg-gray-50 ${picked.includes(p.id) ? 'border-brand bg-brand/5' : ''}`}>
              <input type="checkbox" className="accent-brand" checked={picked.includes(p.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id))} data-testid={`size-${p.id}`} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{p.label}</span>
                <span className="text-[11px] text-gray-500">
                  {p.width} × {p.height}
                </span>
              </span>
            </label>
          ))}
        </div>
        <label className="mb-4 flex items-center gap-2 text-xs">
          <input type="checkbox" className="accent-brand" checked={custom.on} onChange={(e) => setCustom({ ...custom, on: e.target.checked })} />
          Custom size
          <input type="number" className="w-20 rounded border px-1 py-0.5" value={custom.w} onChange={(e) => setCustom({ ...custom, on: true, w: Math.max(16, Number(e.target.value)) })} />×
          <input type="number" className="w-20 rounded border px-1 py-0.5" value={custom.h} onChange={(e) => setCustom({ ...custom, on: true, h: Math.max(16, Number(e.target.value)) })} />
          px
        </label>
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={sizes.length !== 1} onClick={resizeThis} title={sizes.length !== 1 ? 'Pick exactly one size to resize this design' : undefined}>
            Resize this design
          </button>
          <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!sizes.length || busy} onClick={copyAll} data-testid="copy-resize">
            {busy ? 'Creating…' : `Copy & resize${sizes.length > 1 ? ` (${sizes.length})` : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
