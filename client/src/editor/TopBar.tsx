import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Cloud, CloudOff, Download, Play, Redo2, Share2, Undo2 } from 'lucide-react';
import { useEditor } from '../store/editor';
import { Modal, Popover } from '../components/ui';
import { SIZE_PRESETS } from '../lib/presets';
import { exportDesign, type ExportFormat } from '../lib/export';
import { api } from '../api';
import { toast } from '../lib/toast';
import { MOD } from './ContextMenu';
import { Logo } from '../components/Logo';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export function TopBar({ saveState, onPresent }: { saveState: SaveState; onPresent: () => void }) {
  const title = useEditor((s) => s.title);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const showGrid = useEditor((s) => s.showGrid);
  const snapping = useEditor((s) => s.snapping);
  const [modal, setModal] = useState<'resize' | 'download' | 'share' | 'shortcuts' | null>(null);
  const navigate = useNavigate();
  const s = useEditor.getState();

  const makeCopy = async () => {
    const st = useEditor.getState();
    const d = await api.createDesign(`${st.title} (copy)`, st.doc);
    navigate(`/design/${d.id}`);
    toast('Copy created');
  };

  const menuItem = (label: string, onClick: () => void, hint?: string) => (
    <button key={label} className="flex w-full justify-between rounded px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={onClick}>
      {label}
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </button>
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 bg-ink px-3 text-white">
      <Link to="/" className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white/10" title="Back to home">
        <ChevronLeft size={16} />
        <Logo size={18} inverted />
      </Link>
      <Popover
        width={260}
        trigger={() => <button className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/15">File</button>}
      >
        {(close) => (
          <div className="text-gray-800">
            {menuItem('Resize design', () => { close(); setModal('resize'); })}
            {menuItem('Make a copy', () => { close(); makeCopy(); })}
            {menuItem('Download', () => { close(); setModal('download'); })}
            <div className="my-1 border-t" />
            {menuItem(`${showGrid ? 'Hide' : 'Show'} grid`, () => s.toggle('showGrid'))}
            {menuItem(`${snapping ? 'Disable' : 'Enable'} snapping`, () => s.toggle('snapping'), 'hold ⌥ to skip')}
            {menuItem('Keyboard shortcuts', () => { close(); setModal('shortcuts'); }, '?')}
          </div>
        )}
      </Popover>
      <button className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-40" disabled={!canUndo} onClick={s.undo} title={`Undo (${MOD}Z)`}>
        <Undo2 size={18} />
      </button>
      <button className="rounded-md p-1.5 hover:bg-white/15 disabled:opacity-40" disabled={!canRedo} onClick={s.redo} title={`Redo (${MOD}⇧Z)`}>
        <Redo2 size={18} />
      </button>
      <span className="ml-1 flex items-center gap-1 text-xs text-white/80" title={saveState === 'error' ? 'Could not save; will retry' : undefined}>
        {saveState === 'error' ? <CloudOff size={16} /> : <Cloud size={16} />}
        {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : saveState === 'error' ? 'Offline' : 'Saved'}
      </span>
      <div className="flex-1" />
      <input
        className="w-64 rounded-md bg-transparent px-2 py-1 text-right text-sm font-medium outline-none hover:bg-white/10 focus:bg-white focus:text-gray-900"
        value={title}
        onChange={(e) => s.setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/15" onClick={onPresent}>
        <Play size={16} /> Present
      </button>
      <button className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20" onClick={() => setModal('download')}>
        <Download size={16} /> Download
      </button>
      <button className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-strong" onClick={() => setModal('share')}>
        <Share2 size={16} /> Share
      </button>
      {modal === 'resize' && <ResizeModal onClose={() => setModal(null)} />}
      {modal === 'download' && <DownloadModal onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareModal onClose={() => setModal(null)} />}
      {modal === 'shortcuts' && <ShortcutsModal onClose={() => setModal(null)} />}
    </header>
  );
}

function ResizeModal({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [scale, setScale] = useState(true);
  const navigate = useNavigate();
  const apply = async (copy: boolean) => {
    const s = useEditor.getState();
    if (copy) {
      const prev = structuredClone(s.doc);
      s.resizeDoc(w, h, scale);
      const resized = useEditor.getState().doc;
      const d = await api.createDesign(`${s.title} (${w}×${h})`, resized);
      useEditor.setState({ doc: prev });
      navigate(`/design/${d.id}`);
    } else s.resizeDoc(w, h, scale);
    onClose();
  };
  return (
    <Modal title="Resize design" onClose={onClose} width={520}>
      <div className="text-gray-800">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <input type="number" className="w-24 rounded border px-2 py-1" value={w} onChange={(e) => setW(Math.max(16, Number(e.target.value)))} />
          ×
          <input type="number" className="w-24 rounded border px-2 py-1" value={h} onChange={(e) => setH(Math.max(16, Number(e.target.value)))} />
          px
        </div>
        <div className="mb-3 grid max-h-64 grid-cols-2 gap-1 overflow-auto">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`rounded border px-2 py-1.5 text-left text-xs hover:bg-gray-50 ${p.width === w && p.height === h ? 'border-brand' : ''}`}
              onClick={() => {
                setW(p.width);
                setH(p.height);
              }}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-gray-500">
                {p.width} × {p.height}
              </div>
            </button>
          ))}
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={scale} onChange={(e) => setScale(e.target.checked)} />
          Scale content to fit the new size
        </label>
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => apply(true)}>
            Copy &amp; resize
          </button>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={() => apply(false)}>
            Resize
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DownloadModal({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const title = useEditor((s) => s.title);
  const pageIndex = useEditor((s) => s.pageIndex);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [which, setWhich] = useState<'all' | 'current'>('all');
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const run = async () => {
    const pages = which === 'all' ? doc.pages.map((_, i) => i) : [pageIndex];
    setProgress('Preparing…');
    try {
      await exportDesign(doc, title, format, pages, scale, transparent, (d, t) => setProgress(`Rendering ${d}/${t}…`));
      toast('Download ready');
      onClose();
    } catch (err) {
      toast(`Export failed: ${(err as Error).message}`, 'error');
      setProgress(null);
    }
  };
  return (
    <Modal title="Download" onClose={onClose} width={400}>
      <div className="space-y-4 text-sm text-gray-800">
        <label className="block">
          File type
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            <option value="png">PNG (best for images)</option>
            <option value="jpg">JPG (small file size)</option>
            <option value="pdf">PDF (documents, print)</option>
            <option value="svg">SVG (vector)</option>
          </select>
        </label>
        {(format === 'png' || format === 'jpg') && (
          <label className="block">
            Size × {scale} ({Math.round(doc.width * scale)} × {Math.round(doc.height * scale)} px)
            <input type="range" min={0.25} max={4} step={0.25} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="mt-1 w-full accent-brand" />
          </label>
        )}
        {format === 'png' && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent background
          </label>
        )}
        {doc.pages.length > 1 && (
          <label className="block">
            Pages
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={which} onChange={(e) => setWhich(e.target.value as 'all' | 'current')}>
              <option value="all">All pages ({doc.pages.length})</option>
              <option value="current">Current page ({pageIndex + 1})</option>
            </select>
          </label>
        )}
        <button disabled={!!progress} className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white disabled:opacity-60" onClick={run}>
          {progress ?? 'Download'}
        </button>
      </div>
    </Modal>
  );
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const designId = useEditor((s) => s.designId)!;
  const [state, setState] = useState<{ token: string | null; mode: 'view' | 'template' | null } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    api.getDesign(designId).then((d) => setState({ token: d.shareToken, mode: d.shareMode }));
  }, [designId]);
  const setMode = async (mode: 'view' | 'template' | null) => {
    setLoading(true);
    const r = await api.share(designId, mode);
    setState({ token: r.shareToken, mode: r.shareMode });
    setLoading(false);
  };
  const link = state?.token ? `${location.origin}/s/${state.token}` : null;
  return (
    <Modal title="Share this design" onClose={onClose} width={460}>
      <div className="space-y-3 text-sm text-gray-800">
        {!state ? (
          <p>Loading…</p>
        ) : (
          <>
            <label className="block">
              Anyone with the link
              <select disabled={loading} className="mt-1 w-full rounded-lg border px-3 py-2" value={state.mode ?? 'off'} onChange={(e) => setMode(e.target.value === 'off' ? null : (e.target.value as 'view' | 'template'))}>
                <option value="off">No access (link off)</option>
                <option value="view">Can view</option>
                <option value="template">Can view and use as template</option>
              </select>
            </label>
            {link && (
              <div className="flex gap-2">
                <input readOnly className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-xs" value={link} onFocus={(e) => e.target.select()} />
                <button
                  className="rounded-lg bg-brand px-3 py-2 font-semibold text-white"
                  onClick={() => navigator.clipboard.writeText(link).then(() => toast('Link copied'))}
                >
                  Copy
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500">The view link always shows the latest saved version. Template links let signed-in people copy the design into their own account.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  [`${MOD}Z / ${MOD}⇧Z`, 'Undo / redo'],
  [`${MOD}C / ${MOD}X / ${MOD}V`, 'Copy / cut / paste'],
  [`${MOD}D`, 'Duplicate'],
  [`${MOD}A`, 'Select all'],
  [`${MOD}G / ${MOD}⇧G`, 'Group / ungroup'],
  [`${MOD}] / ${MOD}[`, 'Forward / backward (add ⌥ for front/back)'],
  [`${MOD}⇧L`, 'Lock / unlock'],
  ['Delete / Backspace', 'Delete selection'],
  ['Arrows (⇧ for 10px)', 'Nudge'],
  ['T / R / C / L', 'Add text / rectangle / circle / line'],
  ['D', 'Draw tool'],
  ['Esc', 'Deselect / exit tool'],
  [`${MOD}+ / ${MOD}− / ${MOD}0`, 'Zoom in / out / fit'],
  ['Space + drag', 'Pan'],
  [`${MOD}B / ${MOD}I / ${MOD}U`, 'Bold / italic / underline'],
  [`${MOD}Enter`, 'Add page'],
  [`${MOD}⌥P`, 'Present'],
];

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={480}>
      <table className="w-full text-sm text-gray-800">
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k} className="border-b last:border-0">
              <td className="py-1.5 pr-4 font-mono text-xs">{k}</td>
              <td className="py-1.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
