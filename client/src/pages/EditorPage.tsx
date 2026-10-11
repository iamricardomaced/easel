import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useEditor } from '../store/editor';
import { useBrandKit } from '../store/brand';
import { Canvas } from '../editor/Canvas';
import { Sidebar } from '../editor/Sidebar';
import { Toolbar } from '../editor/Toolbar';
import { TopBar, type SaveState } from '../editor/TopBar';
import { BottomBar } from '../editor/BottomBar';
import { Present } from '../editor/Present';
import { makeThumbnail } from '../lib/export';
import { makeImage, makeLine, makeShape, makeText } from '../lib/factory';
import { uploadImageFile } from '../lib/upload';
import type { TextElement } from '../types';

const SAVE_DELAY = 1000;
const THUMB_DELAY = 4000;

export function EditorPage() {
  const { id } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [presenting, setPresenting] = useState(false);
  const version = useEditor((s) => s.version);
  const title = useEditor((s) => s.title);
  const areaRef = useRef<HTMLDivElement>(null);
  const firstVersion = useRef(true);
  const dirty = useRef(false);

  useEffect(() => {
    setLoaded(false);
    firstVersion.current = true;
    dirty.current = false;
    useBrandKit.getState().load();
    api
      .getDesign(id!)
      .then((d) => {
        useEditor.getState().load(d.id, d.title, d.doc);
        document.title = `${d.title} – Canvas`;
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const fit = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const { doc, setZoom, setFitZoom } = useEditor.getState();
    // Leave room for the toolbar (48px), bottom bar (40px), page label and padding.
    const z = Math.min((area.clientWidth - 140) / doc.width, (area.clientHeight - 48 - 40 - 130) / doc.height, 2);
    setFitZoom(z);
    setZoom(z);
  }, []);

  useEffect(() => {
    if (loaded) fit();
  }, [loaded, fit]);

  // Autosave: document changes debounce to a PATCH; thumbnails regenerate less often.
  useEffect(() => {
    if (!loaded) return;
    if (firstVersion.current) {
      firstVersion.current = false;
      return;
    }
    setSaveState('unsaved');
    const t = setTimeout(async () => {
      const { designId, doc } = useEditor.getState();
      if (!designId) return;
      setSaveState('saving');
      try {
        await api.updateDesign(designId, { doc });
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, SAVE_DELAY);
    const th = setTimeout(async () => {
      const { designId, doc } = useEditor.getState();
      const thumb = await makeThumbnail(doc);
      if (designId && thumb) api.updateDesign(designId, { thumbnail: thumb }).catch(() => {});
    }, THUMB_DELAY);
    return () => {
      clearTimeout(t);
      clearTimeout(th);
    };
  }, [version, loaded]);

  // Leaving the editor flushes any pending save and refreshes the thumbnail.
  useEffect(() => {
    if (loaded && version > 0) dirty.current = true;
  }, [version, loaded]);
  useEffect(
    () => () => {
      if (!dirty.current) return;
      const { designId, doc } = useEditor.getState();
      if (!designId) return;
      api.updateDesign(designId, { doc }).catch(() => {});
      // Render the thumbnail after React finishes unmounting the editor.
      setTimeout(() =>
        makeThumbnail(doc).then((thumb) => {
          if (thumb) api.updateDesign(designId, { thumbnail: thumb }).catch(() => {});
        }),
      );
    },
    [id],
  );

  const savedTitle = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    document.title = `${title} – Canvas`;
    if (savedTitle.current === null || savedTitle.current === title) {
      savedTitle.current = title;
      return;
    }
    const t = setTimeout(() => {
      savedTitle.current = title;
      const { designId } = useEditor.getState();
      if (designId) api.updateDesign(designId, { title }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [title, loaded]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState !== 'saved') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  useShortcuts(fit, () => setPresenting(true));

  // Pasting an image from the system clipboard uploads it and adds it to the page.
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName)) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) {
        e.preventDefault();
        useEditor.getState().paste();
        return;
      }
      e.preventDefault();
      const up = await uploadImageFile(file);
      if (!up) return;
      const { doc, addElement } = useEditor.getState();
      const k = Math.min(1, (doc.width * 0.6) / up.width, (doc.height * 0.6) / up.height);
      addElement(makeImage(up.url, up.width * k, up.height * k));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  if (error) return <div className="flex h-screen items-center justify-center text-gray-600">{error}</div>;
  if (!loaded) return <div className="flex h-screen items-center justify-center text-gray-400">Loading design…</div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#ebecf0]">
      <TopBar saveState={saveState} onPresent={() => setPresenting(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div ref={areaRef} className="flex min-w-0 flex-1 flex-col">
          <Toolbar />
          <Canvas />
          <BottomBar onFit={fit} onPresent={() => setPresenting(true)} />
        </div>
      </div>
      {presenting && <Present doc={useEditor.getState().doc} start={useEditor.getState().pageIndex} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function useShortcuts(fit: () => void, present: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const s = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };

      if (mod && k === 'z') return run(e.shiftKey ? s.redo : s.undo);
      if (mod && k === 'y') return run(s.redo);
      if (mod && k === 'c') return run(s.copy);
      if (mod && k === 'x') return run(s.cut);
      if (mod && k === 'v') return; // handled by the paste event so system images work too
      if (mod && k === 'd') return run(s.duplicateSelected);
      if (mod && k === 'a') return run(s.selectAll);
      if (mod && k === 'g') return run(e.shiftKey ? s.ungroup : s.group);
      if (mod && e.shiftKey && k === 'l') return run(s.toggleLock);
      if (mod && e.key === ']') return run(() => s.reorder(e.altKey ? 'front' : 'forward'));
      if (mod && e.key === '[') return run(() => s.reorder(e.altKey ? 'back' : 'backward'));
      if (mod && (e.key === '=' || e.key === '+')) return run(() => s.setZoom(s.zoom * 1.2));
      if (mod && e.key === '-') return run(() => s.setZoom(s.zoom / 1.2));
      if (mod && e.key === '0') return run(fit);
      if (mod && e.key === 'Enter') return run(() => s.addPage());
      if (mod && e.altKey && k === 'p') return run(present);
      if (mod && ['b', 'i', 'u'].includes(k)) {
        const sel = s.selected().filter((x): x is TextElement => x.type === 'text');
        if (!sel.length) return;
        return run(() => {
          const t0 = sel[0];
          if (k === 'b') s.updateSelected({ fontWeight: t0.fontWeight >= 700 ? 400 : 700 });
          if (k === 'i') s.updateSelected({ italic: !t0.italic });
          if (k === 'u') s.updateSelected({ underline: !t0.underline });
        });
      }
      if (mod) return;

      if (e.key === 'Delete' || e.key === 'Backspace') return run(s.deleteSelected);
      if (e.key === 'Escape') return run(() => (s.tool !== 'select' ? s.setTool('select') : s.select([])));
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') return run(() => s.nudge(-step, 0));
      if (e.key === 'ArrowRight') return run(() => s.nudge(step, 0));
      if (e.key === 'ArrowUp') return run(() => s.nudge(0, -step));
      if (e.key === 'ArrowDown') return run(() => s.nudge(0, step));
      if (k === 't') return run(() => s.addElement(makeText({ text: 'Your text here', fontSize: Math.round(s.doc.width / 20) })));
      if (k === 'r') return run(() => s.addElement(makeShape('rect')));
      if (k === 'c') return run(() => s.addElement(makeShape('ellipse')));
      if (k === 'l') return run(() => s.addElement(makeLine()));
      if (k === 'd') return run(() => s.setTool('draw'));
      if (e.key === 'Enter' && s.selectedIds.length === 1) {
        const el = s.selected()[0];
        if (el.type === 'text' && !el.locked) return run(() => {
          s.checkpoint();
          s.setEditing(el.id);
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fit, present]);
}
