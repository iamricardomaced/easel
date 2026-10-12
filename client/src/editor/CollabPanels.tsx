import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { Check, MessageSquare, RotateCcw, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { Comment, DesignDoc, VersionSummary } from '../types';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import { Modal } from '../components/ui';
import { StaticPage } from './ElementView';
import { toast } from '../lib/toast';

// ---------- Comments ----------

interface CommentState {
  list: Comment[];
  draftFor: string | null; // element id the next comment attaches to
  load: (designId: string) => Promise<void>;
  setDraftFor: (id: string | null) => void;
}

export const useComments = create<CommentState>((set) => ({
  list: [],
  draftFor: null,
  load: async (designId) => set({ list: await api.listComments(designId).catch(() => []) }),
  setDraftFor: (draftFor) => set({ draftFor }),
}));

export function commentOn(elementId: string | null) {
  useComments.getState().setDraftFor(elementId);
  useUi.getState().setPanel('comments');
}

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString();
};

export function CommentsPanel() {
  const designId = useEditor((s) => s.designId)!;
  const pages = useEditor((s) => s.doc.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const { list, draftFor, load, setDraftFor } = useComments();
  const [text, setText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const refresh = useCallback(() => load(designId), [designId, load]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const post = async (parentId?: string, body = text) => {
    if (!body.trim()) return;
    await api.addComment(designId, { text: body, pageId: pages[pageIndex]?.id, elementId: parentId ? null : draftFor, parentId });
    if (!parentId) {
      setText('');
      setDraftFor(null);
    }
    refresh();
  };

  const threads = list.filter((c) => !c.parentId && (showResolved || !c.resolved));
  const target = draftFor ? pages.flatMap((p) => p.elements).find((e) => e.id === draftFor) : null;
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Comments</h2>
        <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={() => useUi.getState().setPanel(null)} aria-label="Close panel">
          <X size={18} />
        </button>
      </div>
      <div className="mb-4 rounded-lg border p-2">
        {target && (
          <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
            On the selected {target.type}
            <button className="text-gray-400 hover:text-ink" onClick={() => setDraftFor(null)}>
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          className="h-16 w-full resize-none text-sm outline-none"
          placeholder={`Add a comment on page ${pageIndex + 1}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post();
          }}
          data-testid="comment-input"
        />
        <div className="flex justify-end">
          <button className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white disabled:opacity-50" disabled={!text.trim()} onClick={() => post()}>
            Comment
          </button>
        </div>
      </div>
      <label className="mb-3 flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" className="accent-brand" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
      </label>
      {!threads.length && <p className="text-sm text-gray-500">No comments yet. Select an element and click Comment in the toolbar to pin one to it.</p>}
      <div className="space-y-3">
        {threads.map((c) => (
          <Thread key={c.id} c={c} replies={list.filter((r) => r.parentId === c.id)} onReply={(t) => post(c.id, t)} onChange={refresh} />
        ))}
      </div>
    </>
  );
}

function Thread({ c, replies, onReply, onChange }: { c: Comment; replies: Comment[]; onReply: (t: string) => void; onChange: () => void }) {
  const [reply, setReply] = useState('');
  const pages = useEditor((s) => s.doc.pages);
  const pi = pages.findIndex((p) => p.id === c.pageId);
  const jump = () => {
    const s = useEditor.getState();
    if (pi >= 0) s.setPageIndex(pi);
    if (c.elementId) s.select([c.elementId]);
    document.querySelector(`[data-page-index="${Math.max(0, pi)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return (
    <div className={`rounded-lg border p-3 text-sm ${c.resolved ? 'opacity-60' : ''}`} data-testid="comment-thread">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">{c.author.name[0]?.toUpperCase()}</span>
        <span className="font-semibold">{c.author.name}</span>
        <span className="text-gray-400">{ago(c.createdAt)}</span>
        <div className="flex-1" />
        <button className="rounded p-1 text-gray-500 hover:bg-gray-100" title={c.resolved ? 'Reopen' : 'Resolve'} onClick={() => api.updateComment(c.id, { resolved: !c.resolved }).then(onChange)}>
          {c.resolved ? <RotateCcw size={14} /> : <Check size={14} />}
        </button>
        <button className="rounded p-1 text-gray-500 hover:bg-gray-100" title="Delete" onClick={() => api.deleteComment(c.id).then(onChange)}>
          <Trash2 size={14} />
        </button>
      </div>
      <button className="block w-full whitespace-pre-wrap text-left" onClick={jump}>
        {c.text}
      </button>
      <div className="mt-1 text-[11px] text-gray-400">
        {pi >= 0 ? `Page ${pi + 1}` : 'Deleted page'}
        {c.elementId ? ' · on an element' : ''}
      </div>
      {replies.map((r) => (
        <div key={r.id} className="mt-2 border-l-2 pl-2 text-xs">
          <span className="font-semibold">{r.author.name}</span> <span className="text-gray-400">{ago(r.createdAt)}</span>
          <div className="whitespace-pre-wrap">{r.text}</div>
        </div>
      ))}
      {!c.resolved && (
        <input
          className="mt-2 w-full rounded border px-2 py-1 text-xs outline-none focus:border-brand"
          placeholder="Reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && reply.trim()) {
              onReply(reply);
              setReply('');
            }
          }}
        />
      )}
    </div>
  );
}

// Small bubble on elements that have open comments.
export function CommentBadge({ elementId }: { elementId: string }) {
  const zoom = useEditor((s) => s.zoom);
  const n = useComments((s) => s.list.filter((c) => c.elementId === elementId && !c.resolved && !c.parentId).length);
  if (!n) return null;
  return (
    <button
      className="absolute right-0 top-0 z-10 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full bg-brand px-1 text-[10px] font-semibold text-white shadow"
      style={{ transform: `translate(50%, -50%) scale(${1 / zoom})`, transformOrigin: 'center' }}
      data-testid="comment-badge"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => commentOn(null)}
      title={`${n} comment${n > 1 ? 's' : ''}`}
    >
      <MessageSquare size={11} /> {n}
    </button>
  );
}

// ---------- Version history ----------

export function VersionHistory({ onClose }: { onClose: () => void }) {
  const designId = useEditor((s) => s.designId)!;
  const doc = useEditor((s) => s.doc);
  const [list, setList] = useState<VersionSummary[] | null>(null);
  const [preview, setPreview] = useState<{ id: string; doc: DesignDoc } | null>(null);
  const [name, setName] = useState('');
  const refresh = useCallback(() => api.listVersions(designId).then(setList), [designId]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const open = async (v: VersionSummary) => setPreview({ id: v.id, doc: (await api.getVersion(designId, v.id)).doc });
  const restore = async () => {
    if (!preview) return;
    const d = await api.restoreVersion(designId, preview.id);
    useEditor.getState().mutate((cur) => {
      for (const key of Object.keys(cur)) delete (cur as unknown as Record<string, unknown>)[key];
      Object.assign(cur, d.doc);
    });
    useEditor.getState().setPageIndex(0);
    useEditor.getState().setTitle(d.title);
    toast('Version restored. Undo or pick “Before restoring” to go back.');
    onClose();
  };
  const show = preview?.doc ?? doc;
  const k = Math.min(380 / show.width, 280 / show.height);
  return (
    <Modal title="Version history" onClose={onClose} width={760}>
      <div className="flex gap-4 text-sm text-gray-800">
        <div className="w-64 shrink-0">
          <div className="mb-3 flex gap-1">
            <input className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" placeholder="Name this version" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()} />
            <button
              className="rounded bg-ink px-2 text-xs text-white"
              onClick={async () => {
                await api.updateDesign(designId, { doc: useEditor.getState().doc });
                await api.saveVersion(designId, name || 'Saved version');
                setName('');
                refresh();
                toast('Version saved');
              }}
            >
              Save
            </button>
          </div>
          <button className={`mb-1 w-full rounded-lg px-3 py-2 text-left ${!preview ? 'bg-brand/10 font-semibold' : 'hover:bg-gray-50'}`} onClick={() => setPreview(null)}>
            Current version
          </button>
          <div className="max-h-80 space-y-1 overflow-y-auto" data-testid="versions">
            {list === null && <p className="px-3 text-xs text-gray-400">Loading…</p>}
            {list?.length === 0 && <p className="px-3 text-xs text-gray-500">Versions are saved automatically every ten minutes while you edit.</p>}
            {list?.map((v) => (
              <button key={v.id} className={`w-full rounded-lg px-3 py-2 text-left ${preview?.id === v.id ? 'bg-brand/10' : 'hover:bg-gray-50'}`} onClick={() => open(v)}>
                <div className="font-medium">{v.name ?? new Date(v.createdAt).toLocaleString()}</div>
                <div className="text-[11px] text-gray-500">{v.name ? new Date(v.createdAt).toLocaleString() : v.title}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-3">
          <div className="max-h-[320px] space-y-2 overflow-y-auto">
            {show.pages.slice(0, 6).map((p) => (
              <div key={p.id} className="overflow-hidden rounded border" style={{ width: show.width * k, height: show.height * k }}>
                <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
                  <StaticPage page={p} width={show.width} height={show.height} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{show.pages.length} page{show.pages.length > 1 ? 's' : ''}</p>
          {preview && (
            <button className="rounded-lg bg-brand px-4 py-2 font-semibold text-white" onClick={restore} data-testid="restore-version">
              Restore this version
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
