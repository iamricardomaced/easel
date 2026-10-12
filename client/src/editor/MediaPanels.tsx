import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import type { TransitionKind, VideoElement } from '../types';
import { Slider } from '../components/ui';
import { DEFAULT_PAGE_SECONDS, TRANSITIONS, formatTime, transitionAt } from '../lib/motion';

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={() => useUi.getState().setPanel(null)} aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}

const Label = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-5 text-sm font-semibold text-gray-800 first:mt-0">{children}</h3>;

// ---------- Video ----------

export function VideoPanel({ el }: { el: VideoElement }) {
  const s = useEditor.getState();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(el.trimStart);
  const len = el.trimEnd - el.trimStart;

  // Preview loops inside the trimmed range.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const tick = () => {
      if (v.currentTime >= el.trimEnd || v.currentTime < el.trimStart - 0.05) v.currentTime = el.trimStart;
      setPos(v.currentTime);
    };
    v.addEventListener('timeupdate', tick);
    return () => v.removeEventListener('timeupdate', tick);
  }, [el.trimStart, el.trimEnd]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < el.trimStart || v.currentTime >= el.trimEnd) v.currentTime = el.trimStart;
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const trim = (key: 'trimStart' | 'trimEnd', value: number) => {
    const v = Math.max(0, Math.min(el.duration, value));
    const patch = key === 'trimStart' ? { trimStart: Math.min(v, el.trimEnd - 0.2) } : { trimEnd: Math.max(v, el.trimStart + 0.2) };
    s.updateElement(el.id, patch, false);
    if (ref.current) ref.current.currentTime = key === 'trimStart' ? patch.trimStart! : patch.trimEnd! - 0.05;
  };

  return (
    <>
      <PanelHeader title="Video" />
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={ref} src={el.src} poster={el.poster} className="aspect-video w-full object-contain" muted={el.muted} playsInline />
        <button className="absolute bottom-2 left-2 rounded-full bg-white/90 p-2 text-ink" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 text-xs text-white">{formatTime(Math.max(0, pos - el.trimStart))}</span>
      </div>

      <Label>Trim</Label>
      <TrimBar duration={el.duration} start={el.trimStart} end={el.trimEnd} pos={pos} onStart={() => s.checkpoint()} onChange={trim} />
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{formatTime(el.trimStart)}</span>
        <span className="font-medium text-gray-700">{len.toFixed(1)}s selected</span>
        <span>{formatTime(el.trimEnd)}</span>
      </div>

      <Label>Playback</Label>
      <div className="flex items-center gap-2">
        <button className="rounded-md p-1.5 hover:bg-gray-100" onClick={() => s.updateElement(el.id, { muted: !el.muted })} title={el.muted ? 'Unmute' : 'Mute'}>
          {el.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <div className="flex-1">
          <Slider label="Volume" value={Math.round(el.volume * 100)} min={0} max={100} onStart={() => s.checkpoint()} onChange={(v) => s.updateElement(el.id, { volume: v / 100, muted: v === 0 }, false)} />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-brand" checked={el.loop} onChange={(e) => s.updateElement(el.id, { loop: e.target.checked })} />
        Loop while the page is on screen
      </label>
      <button
        className="mt-4 w-full rounded-lg border py-2 text-sm hover:bg-gray-50"
        onClick={() => {
          const st = useEditor.getState();
          st.setPageAt(st.pageIndex, { duration: Math.max(1, Math.round(len * 10) / 10) });
        }}
      >
        Set page duration to clip length ({len.toFixed(1)}s)
      </button>
    </>
  );
}

function TrimBar({
  duration,
  start,
  end,
  pos,
  onStart,
  onChange,
}: {
  duration: number;
  start: number;
  end: number;
  pos: number;
  onStart: () => void;
  onChange: (key: 'trimStart' | 'trimEnd', v: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / Math.max(0.01, duration)) * 100}%`;
  const grab = (key: 'trimStart' | 'trimEnd') => (e: React.PointerEvent) => {
    e.preventDefault();
    onStart();
    const rect = bar.current!.getBoundingClientRect();
    const move = (m: PointerEvent) => onChange(key, ((m.clientX - rect.left) / rect.width) * duration);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={bar} className="relative h-10 rounded-md bg-gray-200" data-testid="trim-bar">
      <div className="absolute inset-y-0 rounded-md border-2 border-brand bg-brand/15" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
      <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(pos) }} />
      <div className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-brand" style={{ left: pct(start) }} onPointerDown={grab('trimStart')} />
      <div className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-brand" style={{ left: pct(end) }} onPointerDown={grab('trimEnd')} />
    </div>
  );
}

// ---------- Transitions ----------

function TransitionTile({ kind, label, active, onPick }: { kind: TransitionKind; label: string; active: boolean; onPick: () => void }) {
  const [p, setP] = useState(1);
  const raf = useRef(0);
  const hover = () => {
    if (kind === 'none') return;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 800);
      setP(k);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    step();
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const f = transitionAt(kind, p);
  return (
    <button
      onClick={onPick}
      onPointerEnter={hover}
      className={`flex flex-col items-center gap-2 rounded-xl border p-2 text-xs ${active ? 'border-brand bg-brand/5 font-semibold text-brand' : 'hover:bg-gray-50'}`}
    >
      <span className="relative block h-12 w-full overflow-hidden rounded-lg" style={{ perspective: 200 }}>
        <span className="absolute inset-0 bg-ink" style={{ transform: `translateX(${f.outgoing.tx * 100}%) scale(${f.outgoing.scale}) rotateY(${f.outgoing.rotateY}deg)`, opacity: f.outgoing.opacity }} />
        <span
          className="absolute inset-0 bg-brand"
          style={{
            opacity: f.incoming.opacity,
            transform: `translateX(${f.incoming.tx * 100}%) scale(${f.incoming.scale}) rotateY(${f.incoming.rotateY}deg)`,
            clipPath:
              f.incoming.circle !== null
                ? `circle(${f.incoming.circle * 75}% at 50% 50%)`
                : f.incoming.wipe !== null
                  ? `inset(0 ${(1 - f.incoming.wipe) * 100}% 0 0)`
                  : undefined,
          }}
        />
      </span>
      {label}
    </button>
  );
}

export function TransitionPanel() {
  const index = useUi((s) => s.transitionPage);
  const page = useEditor((s) => s.doc.pages[index]);
  const count = useEditor((s) => s.doc.pages.length);
  if (!page || index === 0) return <p className="text-sm text-gray-500">Transitions play between two pages. Add another page first.</p>;
  const tr = page.transition ?? { kind: 'none' as const, duration: 0.6 };
  const s = useEditor.getState();
  const apply = (patch: Partial<typeof tr>) => s.setPageAt(index, { transition: { ...tr, ...patch } });
  return (
    <>
      <PanelHeader title="Transitions" />
      <p className="mb-3 text-xs text-gray-500">
        Between page {index} and page {index + 1}. Hover to preview. Transitions play in Present, the timeline and video downloads.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TRANSITIONS.map((t) => (
          <TransitionTile key={t.kind} kind={t.kind} label={t.label} active={tr.kind === t.kind} onPick={() => apply({ kind: t.kind })} />
        ))}
      </div>
      {tr.kind !== 'none' && (
        <div className="mt-4">
          <Slider
            label="Duration (s)"
            value={tr.duration}
            min={0.2}
            max={Math.min(3, (page.duration ?? DEFAULT_PAGE_SECONDS) - 0.1)}
            step={0.1}
            onStart={() => s.checkpoint()}
            onChange={(v) => s.setPageAt(index, { transition: { ...tr, duration: v } }, false)}
          />
        </div>
      )}
      <button
        className="mt-4 w-full rounded-lg border py-2 text-sm hover:bg-gray-50"
        onClick={() =>
          s.mutate((d) => d.pages.forEach((p, i) => i > 0 && (p.transition = { ...tr })))
        }
      >
        Apply between all {count} pages
      </button>
    </>
  );
}
