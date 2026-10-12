import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import type { DesignElement, Page } from '../types';
import { clonePage } from '../lib/factory';
import { toast } from '../lib/toast';

function Header({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={() => useUi.getState().setPanel(null)} aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}
const H = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-5 text-sm font-semibold text-gray-800 first:mt-0">{children}</h3>;

// ---------- Styles ----------

// [background, primary, secondary, accent, text]
const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Ember', colors: ['#fff7f2', '#ff5c39', '#16181d', '#ffb347', '#16181d'] },
  { name: 'Lagoon', colors: ['#eef7f6', '#2f6f6a', '#8fc1b5', '#f2c14e', '#10302d'] },
  { name: 'Midnight', colors: ['#14162b', '#6c63ff', '#f25f5c', '#ffe066', '#f5f5ff'] },
  { name: 'Blush', colors: ['#fdf0f2', '#e07a8b', '#7a4e62', '#f6c6c7', '#3b2430'] },
  { name: 'Forest', colors: ['#f4f1e8', '#3a5a40', '#a3b18a', '#dda15e', '#1f2a1f'] },
  { name: 'Citrus', colors: ['#fffbe6', '#ff9f1c', '#2ec4b6', '#e71d36', '#1b1b1b'] },
  { name: 'Mono', colors: ['#ffffff', '#111111', '#555555', '#bbbbbb', '#111111'] },
  { name: 'Ocean', colors: ['#f0f6ff', '#1d4ed8', '#60a5fa', '#f59e0b', '#0b1b3a'] },
];

const FONT_SETS: { heading: string; body: string }[] = [
  { heading: 'Playfair Display', body: 'Lato' },
  { heading: 'Bebas Neue', body: 'Montserrat' },
  { heading: 'Space Grotesk', body: 'Inter' },
  { heading: 'Anton', body: 'Roboto' },
  { heading: 'Pacifico', body: 'Quicksand' },
  { heading: 'Cormorant Garamond', body: 'Lato' },
];

function recolor(page: Page, colors: string[], shift: number) {
  const [bg, ...rest] = colors;
  const text = rest[3];
  const accents = rest.slice(0, 3);
  const pick = (i: number) => accents[(i + shift) % accents.length];
  page.background = { type: 'solid', color: bg };
  let n = 0;
  for (const el of page.elements) {
    if (el.type === 'text') el.color = shift % 2 && el.fontSize > 60 ? pick(0) : text;
    else if (el.type === 'shape') {
      el.fill = { type: 'solid', color: pick(n++) };
      if (el.text) el.textColor = bg;
    } else if (el.type === 'icon' || el.type === 'line' || el.type === 'draw') el.color = pick(n++);
    else if (el.type === 'chart') el.colors = [...accents, text];
    else if (el.type === 'table') {
      el.headerColor = pick(0);
      el.textColor = text;
    }
  }
}

function refont(page: Page, set: { heading: string; body: string }) {
  const texts = page.elements.filter((e): e is DesignElement & { type: 'text' } => e.type === 'text');
  const max = Math.max(0, ...texts.map((t) => t.fontSize));
  for (const t of texts) t.fontFamily = t.fontSize >= max * 0.6 ? set.heading : set.body;
}

export function StylesPanel() {
  const [shift, setShift] = useState(0);
  const [all, setAll] = useState(false);
  const apply = (fn: (p: Page) => void) => {
    const s = useEditor.getState();
    s.mutate((d) => (all ? d.pages : [d.pages[s.pageIndex]]).forEach(fn));
  };
  return (
    <>
      <Header title="Styles" />
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-brand" checked={all} onChange={(e) => setAll(e.target.checked)} /> Apply to all pages
      </label>
      <H>Colour palettes</H>
      <p className="mb-2 text-xs text-gray-500">Click a palette to recolour the page. Click again to shuffle.</p>
      <div className="space-y-2">
        {PALETTES.map((p) => (
          <button
            key={p.name}
            className="flex w-full items-center gap-3 rounded-lg border p-2 hover:border-brand"
            onClick={() => {
              const next = shift + 1;
              setShift(next);
              apply((pg) => recolor(pg, p.colors, next));
            }}
            data-testid={`palette-${p.name}`}
          >
            <span className="flex overflow-hidden rounded-md border">
              {p.colors.map((c, i) => (
                <span key={i} className="h-8 w-8" style={{ background: c }} />
              ))}
            </span>
            <span className="text-sm">{p.name}</span>
          </button>
        ))}
      </div>
      <H>Font sets</H>
      <div className="grid grid-cols-2 gap-2">
        {FONT_SETS.map((f) => (
          <button key={f.heading} className="rounded-lg border bg-gray-50 p-3 text-left hover:border-brand" onClick={() => apply((pg) => refont(pg, f))}>
            <div className="text-lg leading-tight" style={{ fontFamily: f.heading }}>
              {f.heading}
            </div>
            <div className="text-xs" style={{ fontFamily: f.body }}>
              {f.body}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- Apps: bulk create ----------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function AppsPanel() {
  const [csv, setCsv] = useState('Name,Role,Date\nAna Silva,Designer,12 May\nRui Costa,Engineer,14 May\nMia Chen,Product lead,20 May');
  const rows = parseCsv(csv);
  const [header, ...data] = rows;
  const page = useEditor((s) => s.page());
  const used = new Set(
    page.elements.flatMap((e) => [...((e.type === 'text' || e.type === 'shape' ? e.text ?? '' : e.type === 'qr' ? e.value : '').matchAll(/\{\{\s*([^}]+?)\s*\}\}/g))].map((m) => m[1])),
  );
  const generate = () => {
    if (!header || !data.length) return;
    const s = useEditor.getState();
    const template = s.page();
    const fill = (str: string, r: string[]) => str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (all, k) => {
      const i = header.findIndex((h) => h.trim().toLowerCase() === String(k).toLowerCase());
      return i >= 0 ? (r[i] ?? '') : all;
    });
    const pages = data.map((r) => {
      const p = clonePage(template);
      for (const el of p.elements) {
        if (el.type === 'text') el.text = fill(el.text, r);
        else if (el.type === 'shape' && el.text) el.text = fill(el.text, r);
        else if (el.type === 'qr') el.value = fill(el.value, r);
        else if (el.type === 'image' && el.name && /^\{\{.+\}\}$/.test(el.name)) {
          const url = fill(el.name, r);
          if (/^https?:|^\//.test(url)) el.src = url;
        }
      }
      return p;
    });
    s.mutate((d) => d.pages.splice(s.pageIndex + 1, 0, ...pages));
    toast(`Created ${pages.length} pages`);
  };
  return (
    <>
      <Header title="Bulk create" />
      <p className="mb-3 text-xs text-gray-500">
        Write fields like <code className="rounded bg-gray-100 px-1">{'{{Name}}'}</code> in text on the current page, paste a table (CSV or copied from a spreadsheet) and generate one page per row.
      </p>
      <label className="mb-2 block cursor-pointer rounded-lg border py-2 text-center text-sm hover:bg-gray-50">
        Upload CSV
        <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => e.target.files?.[0] && setCsv(await e.target.files[0].text())} />
      </label>
      <textarea className="h-36 w-full rounded-lg border p-2 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} onKeyDown={(e) => e.stopPropagation()} data-testid="bulk-csv" />
      {header && (
        <>
          <H>Fields</H>
          <div className="flex flex-wrap gap-1">
            {header.map((h) => (
              <button
                key={h}
                className={`rounded-full border px-2 py-0.5 text-xs ${used.has(h.trim()) ? 'border-brand bg-brand/10 text-brand' : 'hover:bg-gray-50'}`}
                title="Add as a text box"
                onClick={() => {
                  const s = useEditor.getState();
                  const sel = s.selected()[0];
                  if (sel?.type === 'text') s.updateElement(sel.id, { text: `${sel.text} {{${h.trim()}}}` });
                  else navigator.clipboard?.writeText(`{{${h.trim()}}}`).then(() => toast(`Copied {{${h.trim()}}}`));
                }}
              >
                {`{{${h.trim()}}}`}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Click a field to append it to the selected text box. Name an image {'{{Photo}}'} in Layers to fill it from a URL column.</p>
        </>
      )}
      <button className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!data.length || !used.size} onClick={generate} data-testid="bulk-generate">
        Generate {data.length} page{data.length === 1 ? '' : 's'}
      </button>
      {!used.size && <p className="mt-2 text-[11px] text-gray-500">Add at least one field to this page first.</p>}
    </>
  );
}
