import { useRef, useState } from 'react';
import { ArrowRightLeft, Clock, LayoutGrid, Maximize, Music, Pause, Play, Repeat, StickyNote, Trash2 } from 'lucide-react';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import type { AudioTrack } from '../types';
import { StaticPage } from './ElementView';
import { formatTime, locate, pageSeconds, pageStarts, totalSeconds } from '../lib/motion';
import { Slider } from '../components/ui';
import { GridView } from './Tools';

const PPS = 36; // timeline pixels per second

export function BottomBar({ onFit, onPresent }: { onFit: () => void; onPresent: () => void }) {
  const zoom = useEditor((s) => s.zoom);
  const doc = useEditor((s) => s.doc);
  const pageIndex = useEditor((s) => s.pageIndex);
  const playing = useUi((s) => s.playing);
  const [notes, setNotes] = useState(false);
  const [grid, setGrid] = useState(false);
  const [view, setView] = useState<'none' | 'pages' | 'timeline'>('none');
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
      {view === 'pages' && (
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
      {view === 'timeline' && <Timeline />}
      {grid && <GridView onClose={() => setGrid(false)} />}
      <div className="flex h-10 items-center gap-3 px-4 text-sm text-gray-700">
        <button className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 ${notes ? 'text-brand' : ''}`} onClick={() => setNotes(!notes)}>
          <StickyNote size={16} /> Notes
        </button>
        <button
          className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 ${view === 'timeline' ? 'text-brand' : ''}`}
          onClick={() => setView(view === 'timeline' ? 'none' : 'timeline')}
          data-testid="timeline-toggle"
        >
          <Clock size={16} /> Timeline
        </button>
        <button
          className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100"
          onClick={() => togglePlay()}
          title="Play the design with animations, transitions and audio"
          data-testid="play-toggle"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span className="tabular-nums text-xs text-gray-500">{formatTime(totalSeconds(doc))}</span>
        </button>
        <div className="flex-1" />
        <input type="range" min={0.05} max={3} step={0.01} value={zoom} onChange={(e) => s.setZoom(Number(e.target.value))} className="w-40 accent-brand" />
        <button className="w-14 rounded px-1 py-1 text-xs hover:bg-gray-100" onClick={onFit} title="Fit to screen">
          {Math.round(zoom * 100)}%
        </button>
        <button className={`rounded px-2 py-1 text-xs hover:bg-gray-100 ${view === 'pages' ? 'text-brand' : ''}`} onClick={() => setView(view === 'pages' ? 'none' : 'pages')}>
          Pages {pageIndex + 1} / {doc.pages.length}
        </button>
        <button className="rounded p-1 hover:bg-gray-100" title="Grid view" onClick={() => setGrid(true)} data-testid="grid-toggle">
          <LayoutGrid size={16} />
        </button>
        <button className="rounded p-1 hover:bg-gray-100" title="Present full screen" onClick={onPresent}>
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}

// Starts playback from the current page (or resumes from the playhead), or stops it.
export function togglePlay() {
  const ui = useUi.getState();
  const ed = useEditor.getState();
  if (ui.playing) {
    ui.setPlaying(false);
    ed.setPageIndex(locate(ed.doc, Math.min(ui.time, totalSeconds(ed.doc) - 0.001)).index);
    return;
  }
  const starts = pageStarts(ed.doc);
  const here = locate(ed.doc, ui.time).index;
  if (here !== ed.pageIndex || ui.time >= totalSeconds(ed.doc) - 0.05) ui.setTime(starts[ed.pageIndex]);
  ui.setPlaying(true);
}

function Timeline() {
  const doc = useEditor((s) => s.doc);
  const pageIndex = useEditor((s) => s.pageIndex);
  const time = useUi((s) => s.time);
  const [audioSel, setAudioSel] = useState<string | null>(null);
  const s = useEditor.getState();
  const total = totalSeconds(doc);
  const starts = pageStarts(doc);
  const track = useRef<HTMLDivElement>(null);
  const thumbH = 44;
  const k = thumbH / doc.height;
  const selectedTrack = doc.audio?.find((a) => a.id === audioSel) ?? null;

  const seekAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const t = Math.max(0, Math.min(total, (clientX - r.left + track.current!.scrollLeft) / PPS));
    useUi.getState().setTime(t);
    const i = locate(doc, Math.min(t, total - 0.001)).index;
    if (i !== useEditor.getState().pageIndex) s.setPageIndex(i);
  };

  const resizePage = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    s.checkpoint();
    const x0 = e.clientX;
    const d0 = pageSeconds(doc.pages[i]);
    const move = (m: PointerEvent) => {
      const d = Math.max(1, Math.min(120, Math.round((d0 + (m.clientX - x0) / PPS) * 10) / 10));
      s.setPageAt(i, { duration: d }, false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const moveAudio = (a: AudioTrack) => (e: React.PointerEvent) => {
    e.preventDefault();
    setAudioSel(a.id);
    s.checkpoint();
    const x0 = e.clientX;
    const start0 = a.start;
    const move = (m: PointerEvent) => s.updateAudio(a.id, { start: Math.max(0, Math.round((start0 + (m.clientX - x0) / PPS) * 10) / 10) }, false);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="border-b" data-testid="timeline">
      <div ref={track} className="relative overflow-x-auto px-4 pb-2 pt-5" onPointerDown={(e) => e.target === e.currentTarget && seekAt(e.clientX)}>
        <div className="relative" style={{ width: total * PPS + 120 }}>
          {/* Seconds ruler */}
          <div className="absolute -top-4 left-0 h-4 w-full cursor-pointer" onPointerDown={(e) => seekAt(e.clientX)}>
            {Array.from({ length: Math.ceil(total) + 1 }, (_, i) => (
              <span key={i} className="absolute top-0 text-[9px] text-gray-400" style={{ left: i * PPS }}>
                {i % 5 === 0 ? `${i}s` : '·'}
              </span>
            ))}
          </div>
          {/* Pages */}
          <div className="flex items-center">
            {doc.pages.map((p, i) => {
              const w = pageSeconds(p) * PPS;
              return (
                <div key={p.id} className="relative shrink-0" style={{ width: w }}>
                  {i > 0 && (
                    <button
                      className={`absolute -left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm hover:border-brand ${p.transition && p.transition.kind !== 'none' ? 'text-brand' : 'text-gray-400'}`}
                      title={p.transition && p.transition.kind !== 'none' ? `Transition: ${p.transition.kind}` : 'Add transition'}
                      onClick={() => useUi.getState().openTransition(i)}
                      data-testid={`transition-${i}`}
                    >
                      <ArrowRightLeft size={12} />
                    </button>
                  )}
                  <button
                    className={`relative block h-[52px] w-full overflow-hidden rounded-md border-2 ${i === pageIndex ? 'border-brand' : 'border-gray-200'}`}
                    onClick={() => {
                      s.setPageIndex(i);
                      useUi.getState().setTime(starts[i]);
                    }}
                    style={{ background: '#f4f4f5' }}
                  >
                    <div className="flex h-full gap-0.5 overflow-hidden">
                      {Array.from({ length: Math.max(1, Math.floor(w / (doc.width * k + 2))) }, (_, j) => (
                        <div key={j} className="shrink-0" style={{ width: doc.width * k, height: thumbH, overflow: 'hidden' }}>
                          <div style={{ transform: `scale(${k})`, transformOrigin: 'top left' }}>
                            <StaticPage page={p} width={doc.width} height={doc.height} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{pageSeconds(p).toFixed(1)}s</span>
                  </button>
                  <div
                    className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded bg-brand/0 hover:bg-brand/60"
                    onPointerDown={resizePage(i)}
                    title="Drag to change how long this page plays"
                    data-testid={`duration-handle-${i}`}
                  />
                </div>
              );
            })}
            <button className="ml-2 h-[52px] shrink-0 rounded-md border-2 border-dashed px-3 text-lg text-gray-400 hover:text-ink" onClick={() => s.addPage(doc.pages.length - 1)}>
              +
            </button>
          </div>
          {/* Audio */}
          <div className="relative mt-1.5 h-7">
            {(doc.audio ?? []).map((a) => {
              const len = a.loop ? Math.max(0.5, total - a.start) : a.trimEnd - a.trimStart;
              return (
                <div
                  key={a.id}
                  className={`absolute top-0 flex h-7 cursor-grab items-center gap-1 overflow-hidden rounded-md px-2 text-[11px] text-white ${audioSel === a.id ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                  style={{ left: a.start * PPS, width: Math.max(24, len * PPS), background: '#2f6f6a' }}
                  onPointerDown={moveAudio(a)}
                  data-testid="audio-clip"
                >
                  <Music size={12} className="shrink-0" />
                  <span className="truncate">{a.name}</span>
                </div>
              );
            })}
            {!doc.audio?.length && (
              <button className="h-7 rounded-md border border-dashed px-3 text-[11px] text-gray-500 hover:text-ink" onClick={() => useUi.getState().setPanel('audio')}>
                + Add audio
              </button>
            )}
          </div>
          {/* Playhead */}
          <div className="pointer-events-none absolute -top-4 bottom-0 w-0.5 bg-ink" style={{ left: Math.min(time, total) * PPS }} />
        </div>
      </div>
      {selectedTrack && <AudioControls track={selectedTrack} onClose={() => setAudioSel(null)} />}
    </div>
  );
}

function AudioControls({ track, onClose }: { track: AudioTrack; onClose: () => void }) {
  const s = useEditor.getState();
  const upd = (patch: Partial<AudioTrack>) => s.updateAudio(track.id, patch, false);
  return (
    <div className="flex flex-wrap items-center gap-4 border-t bg-gray-50 px-4 py-2 text-xs" data-testid="audio-controls">
      <span className="flex items-center gap-1 font-medium">
        <Music size={14} /> {track.name}
      </span>
      <div className="w-36">
        <Slider label="Volume" value={Math.round(track.volume * 100)} min={0} max={100} onStart={() => s.checkpoint()} onChange={(v) => upd({ volume: v / 100 })} />
      </div>
      <div className="w-28">
        <Slider label="Fade in (s)" value={track.fadeIn} min={0} max={5} step={0.1} onStart={() => s.checkpoint()} onChange={(v) => upd({ fadeIn: v })} />
      </div>
      <div className="w-28">
        <Slider label="Fade out (s)" value={track.fadeOut} min={0} max={5} step={0.1} onStart={() => s.checkpoint()} onChange={(v) => upd({ fadeOut: v })} />
      </div>
      <div className="w-36">
        <Slider label="Start in clip (s)" value={track.trimStart} min={0} max={Math.max(0, track.trimEnd - 0.5)} step={0.1} onStart={() => s.checkpoint()} onChange={(v) => upd({ trimStart: v })} />
      </div>
      <label className="flex items-center gap-1">
        <input type="checkbox" className="accent-brand" checked={!!track.loop} onChange={(e) => s.updateAudio(track.id, { loop: e.target.checked })} />
        <Repeat size={12} /> Loop to the end
      </label>
      <div className="flex-1" />
      <button className="flex items-center gap-1 rounded px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => { s.removeAudio(track.id); onClose(); }}>
        <Trash2 size={14} /> Remove
      </button>
    </div>
  );
}
