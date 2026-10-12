import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder as FolderIcon, FolderPlus, Home, Users, MoreHorizontal, Plus, Search, Star, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { DesignSummary, Folder } from '../types';
import { useAuth } from '../store/auth';
import { SIZE_PRESETS } from '../lib/presets';
import { TEMPLATES, type Template } from '../lib/templates';
import { clonePage, newDoc } from '../lib/factory';
import { StaticPage } from '../editor/ElementView';
import { Modal, Popover } from '../components/ui';
import { toast } from '../lib/toast';
import { Logo } from '../components/Logo';

type View = 'all' | 'starred' | 'trash' | 'shared';

export function HomePage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [view, setView] = useState<View>('all');
  const [q, setQ] = useState('');
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);

  const refreshFolders = useCallback(() => api.listFolders().then(setFolders).catch(() => {}), []);
  const refresh = useCallback(() => {
    api.listDesigns(view, q, folder ?? undefined).then(setDesigns).catch((e) => toast(e.message, 'error'));
    refreshFolders();
  }, [view, q, folder, refreshFolders]);
  const current = folders.find((f) => f.id === folder) ?? null;
  const [naming, setNaming] = useState<string | null>(null);
  const newFolder = async (name: string) => {
    setNaming(null);
    if (!name.trim()) return;
    const f = await api.createFolder(name.trim());
    setView('all');
    setFolder(f.id);
    refreshFolders();
  };
  const moveTo = async (designId: string, folderId: string | null) => {
    await api.updateDesign(designId, { folderId });
    toast(folderId ? `Moved to ${folders.find((f) => f.id === folderId)?.name}` : 'Removed from folder');
    refresh();
  };

  useEffect(() => {
    document.title = 'Home – Easel';
    const t = setTimeout(refresh, 200);
    return () => clearTimeout(t);
  }, [refresh]);

  const create = async (title: string, width: number, height: number) => {
    const d = await api.createDesign(title, newDoc(width, height));
    navigate(`/design/${d.id}`);
  };
  const fromTemplate = async (t: Template) => {
    const doc = { width: t.width, height: t.height, unit: 'px' as const, pages: t.pages.map(clonePage) };
    const d = await api.createDesign(t.name, doc);
    navigate(`/design/${d.id}`);
  };

  const navBtn = (v: View, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => {
        setView(v);
        setFolder(null);
      }}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${view === v && !folder ? 'bg-brand/10 font-semibold text-brand' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r p-4">
        <div className="mb-6 px-2">
          <Logo size={26} />
        </div>
        <button onClick={() => setCustom(true)} className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-strong">
          <Plus size={16} /> New design
        </button>
        <nav className="space-y-1">
          {navBtn('all', 'Home', <Home size={18} />)}
          {navBtn('shared', 'Shared with you', <Users size={18} />)}
          {navBtn('starred', 'Starred', <Star size={18} />)}
          {navBtn('trash', 'Trash', <Trash2 size={18} />)}
        </nav>
        <div className="mb-1 mt-6 flex items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Folders
          <button className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-ink" title="New folder" onClick={() => setNaming('')} data-testid="new-folder">
            <FolderPlus size={16} />
          </button>
        </div>
        <nav className="space-y-0.5 overflow-y-auto">
          {naming !== null && (
            <input
              autoFocus
              className="w-full rounded-lg border border-brand px-3 py-1.5 text-sm outline-none"
              placeholder="Folder name"
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
              onBlur={() => newFolder(naming)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') newFolder(naming);
                if (e.key === 'Escape') setNaming(null);
              }}
              data-testid="folder-name"
            />
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setView('all');
                setFolder(f.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(f.id);
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const id = e.dataTransfer.getData('text/design-id');
                if (id) moveTo(id, f.id);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm ${folder === f.id ? 'bg-brand/10 font-semibold text-brand' : 'text-gray-700 hover:bg-gray-100'} ${dropTarget === f.id ? 'ring-2 ring-brand' : ''}`}
            >
              <FolderIcon size={16} />
              <span className="flex-1 truncate text-left">{f.name}</span>
              <span className="text-xs text-gray-400">{f.count}</span>
            </button>
          ))}
          {!folders.length && <p className="px-3 text-xs text-gray-400">Group designs into folders. Drag a design onto a folder to move it.</p>}
        </nav>
        <div className="flex-1" />
        <Popover
          trigger={() => (
            <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-gray-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                {user?.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user?.name}</span>
                <span className="block truncate text-xs text-gray-500">{user?.email}</span>
              </span>
            </button>
          )}
        >
          <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={() => logout().then(() => navigate('/login'))}>
            Log out
          </button>
        </Popover>
      </aside>

      <main className="min-w-0 flex-1">
        {view === 'all' && !q && !folder && (
          <section className="border-b bg-paper px-10 pb-10 pt-10 text-ink">
            <h1 className="mb-1 text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Start something new</h1>
            <p className="mb-6 text-sm text-gray-600">Pick a format, start from a template, or set your own size.</p>
            <div className="mb-8 flex max-w-xl items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-gray-700">
              <Search size={18} className="text-gray-400" />
              <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search your designs" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              {SIZE_PRESETS.slice(0, 10).map((p) => (
                <button key={p.id} onClick={() => create(p.label, p.width, p.height)} className="flex w-28 flex-col items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-3 hover:border-brand">
                  <span className="flex h-12 w-12 items-center justify-center">
                    <span className="block rounded-[3px] border-2 border-ink bg-brand/15" style={{ width: (28 * p.width) / Math.max(p.width, p.height), height: (28 * p.height) / Math.max(p.width, p.height) }} />
                  </span>
                  <span className="text-center text-xs font-medium">{p.label}</span>
                </button>
              ))}
              <button onClick={() => setCustom(true)} className="flex w-28 flex-col items-center gap-2 rounded-lg border border-dashed border-black/20 bg-white px-3 py-3 hover:border-brand">
                <span className="flex h-12 w-12 items-center justify-center text-brand">
                  <Plus />
                </span>
                <span className="text-xs font-medium">Custom size</span>
              </button>
            </div>
          </section>
        )}

        <div className="px-10 py-8">
          {(view !== 'all' || q || folder) && (
            <div className="mb-6 flex items-center gap-2 rounded-full border px-4 py-2.5 text-gray-700">
              <Search size={18} className="text-gray-400" />
              <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Search your designs" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}

          {view === 'all' && !q && !folder && (
            <section className="mb-10">
              <h2 className="mb-4 text-lg font-semibold">Start from a template</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {TEMPLATES.map((t) => {
                  const h = 150;
                  const k = h / t.height;
                  return (
                    <button key={t.id} onClick={() => fromTemplate(t)} className="shrink-0 text-left">
                      <div className="overflow-hidden rounded-lg border shadow-sm transition hover:shadow-md" style={{ width: t.width * k, height: h }}>
                        <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
                          <StaticPage page={t.pages[0]} width={t.width} height={t.height} />
                        </div>
                      </div>
                      <div className="mt-1.5 text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.category}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mb-4 flex items-center gap-3">
            {current && renamingFolder !== null ? (
              <input
                autoFocus
                className="rounded border px-2 py-1 text-lg font-semibold"
                value={renamingFolder}
                onChange={(e) => setRenamingFolder(e.target.value)}
                onBlur={async () => {
                  if (renamingFolder.trim()) await api.renameFolder(current.id, renamingFolder.trim());
                  setRenamingFolder(null);
                  refreshFolders();
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ) : (
            <h2 className="text-lg font-semibold">{current ? current.name : view === 'trash' ? 'Trash' : view === 'starred' ? 'Starred' : view === 'shared' ? 'Shared with you' : q ? `Results for “${q}”` : 'Recent designs'}</h2>
            )}
            {current && renamingFolder === null && (
              <>
                <button
                  className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                  onClick={() => setRenamingFolder(current.name)}
                >
                  Rename
                </button>
                <button
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    await api.deleteFolder(current.id);
                    setFolder(null);
                    toast('Folder deleted. Its designs are still in Home.');
                  }}
                >
                  Delete folder
                </button>
              </>
            )}
          </div>
          {view === 'trash' && <p className="-mt-2 mb-4 text-sm text-gray-500">Restore designs or delete them for good.</p>}
          {designs === null ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : designs.length === 0 ? (
            <p className="text-sm text-gray-500">{view === 'all' && !q ? 'No designs yet. Pick a size above to start.' : 'Nothing here.'}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
              {designs.map((d) => (
                <DesignCard key={d.id} d={d} trash={view === 'trash'} shared={view === 'shared'} onChange={refresh} folders={folders} onMove={moveTo} />
              ))}
            </div>
          )}
        </div>
      </main>

      {custom && (
        <CustomSizeModal
          onClose={() => setCustom(false)}
          onCreate={(w, h) => {
            setCustom(false);
            create('Untitled design', w, h);
          }}
        />
      )}
    </div>
  );
}

function DesignCard({
  d,
  trash,
  onChange,
  folders,
  onMove,
  shared,
}: {
  d: DesignSummary;
  trash: boolean;
  shared?: boolean;
  onChange: () => void;
  folders: Folder[];
  onMove: (id: string, folder: string | null) => void;
}) {
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(d.title);
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    await fn();
    if (msg) toast(msg);
    onChange();
  };
  const item = (label: string, onClick: () => void, danger = false) => (
    <button className={`w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-100 ${danger ? 'text-red-600' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="group" draggable={!trash && !shared} onDragStart={(e) => e.dataTransfer.setData('text/design-id', d.id)}>
      <div
        className="relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gray-100 transition group-hover:shadow-md"
        onClick={() => !trash && navigate(`/design/${d.id}`)}
      >
        {d.thumbnail ? <img src={d.thumbnail} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-gray-400">No preview yet</span>}
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <Popover
            align="right"
            width={200}
            trigger={() => (
              <button className="rounded-md bg-white/90 p-1 shadow">
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {(close) =>
              shared ? (
                <>
                  {item('Open', () => navigate(`/design/${d.id}`))}
                  {item('Make a copy', () => { close(); act(() => api.duplicateDesign(d.id), 'Copy added to your designs'); })}
                  {item('Leave', () => { close(); act(() => api.me().then((u) => api.removeMember(d.id, u.id)), 'Removed from your list'); }, true)}
                </>
              ) : trash ? (
                <>
                  {item('Restore', () => { close(); act(() => api.updateDesign(d.id, { trashed: false }), 'Restored'); })}
                  {item('Delete forever', () => { close(); act(() => api.deleteDesign(d.id), 'Deleted'); }, true)}
                </>
              ) : (
                <>
                  {item('Open', () => navigate(`/design/${d.id}`))}
                  {item('Rename', () => { close(); setRenaming(true); })}
                  {item(d.starred ? 'Unstar' : 'Star', () => { close(); act(() => api.updateDesign(d.id, { starred: !d.starred })); })}
                  {item('Make a copy', () => { close(); act(() => api.duplicateDesign(d.id), 'Copy created'); })}
                  {folders.length > 0 && <div className="mt-1 border-t px-3 pb-1 pt-2 text-[11px] font-semibold uppercase text-gray-400">Move to folder</div>}
                  {folders.filter((f) => f.id !== d.folderId).map((f) => item(f.name, () => { close(); onMove(d.id, f.id); }))}
                  {d.folderId && item('Remove from folder', () => { close(); onMove(d.id, null); })}
                  {item('Move to trash', () => { close(); act(() => api.updateDesign(d.id, { trashed: true }), 'Moved to trash'); }, true)}
                </>
              )
            }
          </Popover>
        </div>
        {d.starred && <Star size={16} className="absolute left-2 top-2 fill-yellow-400 text-yellow-400" />}
      </div>
      {renaming ? (
        <input
          autoFocus
          className="mt-2 w-full rounded border px-2 py-1 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setRenaming(false);
            if (title.trim() && title !== d.title) act(() => api.updateDesign(d.id, { title: title.trim() }));
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <div className="mt-2 truncate text-sm font-medium">{d.title}</div>
      )}
      <div className="text-xs text-gray-500">
        {d.ownerName ? `${d.ownerName} · ${d.role === 'edit' ? 'can edit' : d.role === 'comment' ? 'can comment' : 'can view'} · ` : ''}Edited {new Date(d.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function CustomSizeModal({ onClose, onCreate }: { onClose: () => void; onCreate: (w: number, h: number) => void }) {
  const [w, setW] = useState(1080);
  const [h, setH] = useState(1080);
  const [unit, setUnit] = useState<'px' | 'mm' | 'in'>('px');
  const toPx = (v: number) => Math.round(unit === 'px' ? v : unit === 'in' ? v * 96 : (v / 25.4) * 96);
  return (
    <Modal title="Create a design" onClose={onClose} width={560}>
      <div className="mb-4 grid max-h-72 grid-cols-2 gap-2 overflow-auto">
        {SIZE_PRESETS.map((p) => (
          <button key={p.id} className="rounded-lg border px-3 py-2 text-left hover:border-brand" onClick={() => onCreate(p.width, p.height)}>
            <div className="text-sm font-medium">{p.label}</div>
            <div className="text-xs text-gray-500">
              {p.category} · {p.width} × {p.height} px
            </div>
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 border-t pt-4 text-sm">
        <label>
          Width
          <input type="number" className="mt-1 block w-24 rounded border px-2 py-1.5" value={w} onChange={(e) => setW(Number(e.target.value))} />
        </label>
        <label>
          Height
          <input type="number" className="mt-1 block w-24 rounded border px-2 py-1.5" value={h} onChange={(e) => setH(Number(e.target.value))} />
        </label>
        <select className="rounded border px-2 py-1.5" value={unit} onChange={(e) => setUnit(e.target.value as 'px' | 'mm' | 'in')}>
          <option value="px">px</option>
          <option value="mm">mm</option>
          <option value="in">in</option>
        </select>
        <div className="flex-1" />
        <button
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
          disabled={toPx(w) < 16 || toPx(h) < 16 || toPx(w) > 8000 || toPx(h) > 8000}
          onClick={() => onCreate(toPx(w), toPx(h))}
        >
          Create new design
        </button>
      </div>
    </Modal>
  );
}
