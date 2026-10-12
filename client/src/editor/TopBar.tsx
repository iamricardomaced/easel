import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Cloud, CloudOff, Download, MessageSquare, Play, Redo2, Share2, Undo2 } from 'lucide-react';
import { useEditor } from '../store/editor';
import { Modal, Popover } from '../components/ui';
import { exportDesign, type ExportFormat } from '../lib/export';
import { api } from '../api';
import { toast } from '../lib/toast';
import { MOD } from './ContextMenu';
import { Logo } from '../components/Logo';
import { VersionHistory, commentOn } from './CollabPanels';
import { FindReplace, MagicResize } from './Tools';
import { Avatars } from './Presence';
import { useLive } from '../lib/live';
import type { Member, Role } from '../types';
import { formatTime, pageSeconds } from '../lib/motion';
import type { VideoProgress, VideoQuality } from '../lib/video';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export function TopBar({ saveState, onPresent }: { saveState: SaveState; onPresent: () => void }) {
  const title = useEditor((s) => s.title);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const showGrid = useEditor((s) => s.showGrid);
  const snapping = useEditor((s) => s.snapping);
  const showRulers = useEditor((s) => s.showRulers);
  const [modal, setModal] = useState<'resize' | 'download' | 'share' | 'shortcuts' | 'versions' | 'find' | null>(null);
  const navigate = useNavigate();
  const s = useEditor.getState();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      if (!typing && e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        useEditor.getState().toggle('showRulers');
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setModal('find');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
            {menuItem('Version history', () => { close(); setModal('versions'); })}
            {menuItem('Find and replace', () => { close(); setModal('find'); }, `${MOD}F`)}
            <div className="my-1 border-t" />
            {menuItem(`${showGrid ? 'Hide' : 'Show'} grid`, () => s.toggle('showGrid'))}
            {menuItem(`${showRulers ? 'Hide' : 'Show'} rulers and guides`, () => s.toggle('showRulers'), '⇧R')}
            {menuItem('Clear guides', () => { close(); s.mutate((d) => (d.guides = { x: [], y: [] })); })}
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
      <Avatars />
      <button className="rounded-md p-1.5 hover:bg-white/15" title="Comments" onClick={() => commentOn(null)}>
        <MessageSquare size={18} />
      </button>
      <button className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/15" onClick={onPresent}>
        <Play size={16} /> Present
      </button>
      <button className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20" onClick={() => setModal('download')}>
        <Download size={16} /> Download
      </button>
      <button className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-strong" onClick={() => setModal('share')}>
        <Share2 size={16} /> Share
      </button>
      {modal === 'resize' && <MagicResize onClose={() => setModal(null)} />}
      {modal === 'find' && <FindReplace onClose={() => setModal(null)} />}
      {modal === 'download' && <DownloadModal onClose={() => setModal(null)} />}
      {modal === 'share' && <ShareModal onClose={() => setModal(null)} />}
      {modal === 'shortcuts' && <ShortcutsModal onClose={() => setModal(null)} />}
      {modal === 'versions' && <VersionHistory onClose={() => setModal(null)} />}
    </header>
  );
}

type DownloadFormat = ExportFormat | 'mp4' | 'gif';

const FORMATS: { id: DownloadFormat; label: string; hint: string }[] = [
  { id: 'png', label: 'PNG', hint: 'Best for complex images and illustrations' },
  { id: 'jpg', label: 'JPG', hint: 'Small file size, good for sharing' },
  { id: 'pdf', label: 'PDF Standard', hint: 'Documents, emailing and printing' },
  { id: 'svg', label: 'SVG', hint: 'Vector, sharp at any size' },
  { id: 'mp4', label: 'MP4 Video', hint: 'High quality video with animations, transitions and audio' },
  { id: 'gif', label: 'GIF', hint: 'Short animated clip, no sound' },
];

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function DownloadModal({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const title = useEditor((s) => s.title);
  const pageIndex = useEditor((s) => s.pageIndex);
  const moving = doc.pages.some((p) => p.elements.some((e) => e.type === 'video' || (e.animation && e.animation !== 'none')) || (p.transition && p.transition.kind !== 'none')) || !!doc.audio?.length;
  const [format, setFormat] = useState<DownloadFormat>(moving ? 'mp4' : 'png');
  const [which, setWhich] = useState<'all' | 'current'>('all');
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const [quality, setQuality] = useState<VideoQuality>(1080);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const timed = format === 'mp4' || format === 'gif';
  const run = async () => {
    const pages = which === 'all' ? doc.pages.map((_, i) => i).filter((i) => !doc.pages[i].hidden) : [pageIndex];
    const subset = { ...doc, pages: pages.map((i) => doc.pages[i]) };
    setProgress({ label: 'Preparing…', pct: 0 });
    abort.current = new AbortController();
    const report = (p: VideoProgress) => setProgress({ label: `${p.phase}…`, pct: p.total ? p.done / p.total : 0 });
    const name = (title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'design');
    try {
      if (format === 'mp4') {
        const { exportVideo } = await import('../lib/video');
        const { blob, ext } = await exportVideo(subset, quality, report, abort.current.signal);
        saveBlob(blob, `${name}.${ext}`);
        if (ext !== 'mp4') toast('This browser cannot encode MP4, so the video was saved as WebM');
      } else if (format === 'gif') {
        const { exportGif } = await import('../lib/video');
        saveBlob(await exportGif(subset, 640, report, abort.current.signal), `${name}.gif`);
      } else {
        await exportDesign(doc, title, format, pages, scale, transparent, (d, t) => setProgress({ label: `Rendering ${d}/${t}…`, pct: d / t }));
      }
      toast('Download ready');
      onClose();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast(`Export failed: ${(err as Error).message}`, 'error');
      setProgress(null);
    }
  };
  const seconds = (which === 'all' ? doc.pages.filter((p) => !p.hidden) : [doc.pages[pageIndex]]).reduce((s, p) => s + pageSeconds(p), 0);
  return (
    <Modal title="Download" onClose={() => { abort.current?.abort(); onClose(); }} width={440}>
      <div className="space-y-4 text-sm text-gray-800">
        <div>
          File type
          <div className="mt-1 grid grid-cols-2 gap-1.5" data-testid="download-formats">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                disabled={!!progress}
                className={`rounded-lg border px-3 py-2 text-left ${format === f.id ? 'border-brand bg-brand/5' : 'hover:bg-gray-50'}`}
                onClick={() => setFormat(f.id)}
                data-format={f.id}
              >
                <div className="font-medium">
                  {f.label}
                  {moving && f.id === 'mp4' && <span className="ml-1 rounded bg-brand px-1 text-[10px] font-semibold text-white">Suggested</span>}
                </div>
                <div className="text-[11px] leading-tight text-gray-500">{f.hint}</div>
              </button>
            ))}
          </div>
        </div>
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
        {format === 'mp4' && (
          <label className="block">
            Quality
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={quality} onChange={(e) => setQuality(Number(e.target.value) as VideoQuality)}>
              <option value={480}>480p</option>
              <option value={720}>720p HD</option>
              <option value={1080}>1080p Full HD</option>
              <option value={2160}>4K</option>
            </select>
          </label>
        )}
        {timed && (
          <p className="text-xs text-gray-500">
            {formatTime(seconds)} long. Change page durations, transitions and music in the Timeline at the bottom of the editor.
          </p>
        )}
        {doc.pages.length > 1 && (
          <label className="block">
            Pages
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={which} onChange={(e) => setWhich(e.target.value as 'all' | 'current')}>
              <option value="all">All pages ({doc.pages.filter((p) => !p.hidden).length}{doc.pages.some((p) => p.hidden) ? ', hidden pages skipped' : ''})</option>
              <option value="current">Current page ({pageIndex + 1})</option>
            </select>
          </label>
        )}
        {progress && (
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(progress.pct * 100)}%` }} />
          </div>
        )}
        <div className="flex gap-2">
          <button disabled={!!progress} className="flex-1 rounded-lg bg-brand py-2.5 font-semibold text-white disabled:opacity-60" onClick={run} data-testid="download-run">
            {progress?.label ?? 'Download'}
          </button>
          {progress && timed && (
            <button className="rounded-lg border px-4" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', edit: 'Can edit', comment: 'Can comment', view: 'Can view' };

function ShareModal({ onClose }: { onClose: () => void }) {
  const designId = useEditor((s) => s.designId)!;
  const myRole = useLive((s) => s.role);
  const owner = myRole === 'owner';
  const [state, setState] = useState<{ token: string | null; mode: 'view' | 'template' | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('edit');
  const [loading, setLoading] = useState(false);
  const refresh = () => api.listMembers(designId).then(setMembers).catch(() => {});
  useEffect(() => {
    if (owner) api.getDesign(designId).then((d) => setState({ token: d.shareToken, mode: d.shareMode }));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, owner]);
  const setMode = async (mode: 'view' | 'template' | null) => {
    setLoading(true);
    const r = await api.share(designId, mode);
    setState({ token: r.shareToken, mode: r.shareMode });
    setLoading(false);
  };
  const invite = async () => {
    try {
      const m = await api.addMember(designId, email, role);
      toast(`${m.name} can now ${role === 'edit' ? 'edit' : role}`);
      setEmail('');
      refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };
  const link = state?.token ? `${location.origin}/s/${state.token}` : null;
  return (
    <Modal title="Share this design" onClose={onClose} width={480}>
      <div className="space-y-4 text-sm text-gray-800" onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}>
        {owner && (
          <div>
            <div className="mb-1 font-medium">People with access</div>
            <div className="flex gap-2">
              <input className="min-w-0 flex-1 rounded-lg border px-3 py-2" placeholder="Add people by email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && invite()} data-testid="invite-email" />
              <select className="rounded-lg border px-2" value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, 'owner'>)} data-testid="invite-role">
                <option value="edit">Can edit</option>
                <option value="comment">Can comment</option>
                <option value="view">Can view</option>
              </select>
              <button className="rounded-lg bg-brand px-3 font-semibold text-white disabled:opacity-50" disabled={!email.trim()} onClick={invite} data-testid="invite-send">
                Invite
              </button>
            </div>
          </div>
        )}
        <div className="space-y-1" data-testid="members">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg px-1 py-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{m.name[0]?.toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block truncate text-xs text-gray-500">{m.email}</span>
              </span>
              {owner && m.role !== 'owner' ? (
                <select
                  className="rounded border px-1 py-0.5 text-xs"
                  value={m.role}
                  onChange={async (e) => {
                    if (e.target.value === 'remove') await api.removeMember(designId, m.id);
                    else await api.addMember(designId, m.email, e.target.value as Exclude<Role, 'owner'>);
                    refresh();
                  }}
                >
                  <option value="edit">Can edit</option>
                  <option value="comment">Can comment</option>
                  <option value="view">Can view</option>
                  <option value="remove">Remove</option>
                </select>
              ) : (
                <span className="text-xs text-gray-500">{ROLE_LABEL[m.role]}</span>
              )}
            </div>
          ))}
        </div>
        {owner && (
          <div className="border-t pt-4">
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
                  <div className="mt-2 flex gap-2">
                    <input readOnly className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-xs" value={link} onFocus={(e) => e.target.select()} />
                    <button className="rounded-lg bg-brand px-3 py-2 font-semibold text-white" onClick={() => navigator.clipboard.writeText(link).then(() => toast('Link copied'))}>
                      Copy
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">People you invite see the design in “Shared with you” and edit it with you in real time. Links need no account.</p>
              </>
            )}
          </div>
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
