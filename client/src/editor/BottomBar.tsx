import { useState } from 'react';
import { Maximize, StickyNote } from 'lucide-react';
import { useEditor } from '../store/editor';
import { StaticPage } from './ElementView';

export function BottomBar({ onFit, onPresent }: { onFit: () => void; onPresent: () => void }) {
  const zoom = useEditor((s) => s.zoom);
  const doc = useEditor((s) => s.doc);
  const pageIndex = useEditor((s) => s.pageIndex);
  const [notes, setNotes] = useState(false);
  const [strip, setStrip] = useState(false);
  const s = useEditor.getState();
  const page = doc.pages[pageIndex];
  const thumbH = 56;
  const k = thumbH / doc.height;
  return (
    <div className="shrink-0 border-t bg-white">
      {notes && (
        <textarea
          className="block h-24 w-full resize-none border-b px-4 py-2 text-sm outline-none"
          placeholder={`Notes for page ${pageIndex + 1} (only you see these)`}
          value={page.notes ?? ''}
          onFocus={() => s.checkpoint()}
          onChange={(e) => s.mutate((d) => (d.pages[pageIndex].notes = e.target.value), false)}
        />
      )}
      {strip && (
        <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
          {doc.pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                s.setPageIndex(i);
                document.querySelector(`[data-page-index="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className={`relative shrink-0 overflow-hidden rounded border-2 ${i === pageIndex ? 'border-brand' : 'border-transparent'}`}
              style={{ width: doc.width * k + 4, height: thumbH + 4 }}
            >
              <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
                <StaticPage page={p} width={doc.width} height={doc.height} />
              </div>
              <span className="absolute bottom-0.5 left-1 rounded bg-black/50 px-1 text-[10px] text-white">{i + 1}</span>
            </button>
          ))}
          <button className="shrink-0 rounded border-2 border-dashed px-4 text-xl text-gray-400" style={{ height: thumbH + 4 }} onClick={() => s.addPage(doc.pages.length - 1)}>
            +
          </button>
        </div>
      )}
      <div className="flex h-10 items-center gap-3 px-4 text-sm text-gray-700">
        <button className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 ${notes ? 'text-brand' : ''}`} onClick={() => setNotes(!notes)}>
          <StickyNote size={16} /> Notes
        </button>
        <div className="flex-1" />
        <input type="range" min={0.05} max={3} step={0.01} value={zoom} onChange={(e) => s.setZoom(Number(e.target.value))} className="w-40 accent-brand" />
        <button className="w-14 rounded px-1 py-1 text-xs hover:bg-gray-100" onClick={onFit} title="Fit to screen">
          {Math.round(zoom * 100)}%
        </button>
        <button className={`rounded px-2 py-1 text-xs hover:bg-gray-100 ${strip ? 'text-brand' : ''}`} onClick={() => setStrip(!strip)}>
          Pages {pageIndex + 1} / {doc.pages.length}
        </button>
        <button className="rounded p-1 hover:bg-gray-100" title="Present full screen" onClick={onPresent}>
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
