import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import { Player, usePlaybackClock } from './Player';
import { formatTime, locate, totalSeconds } from '../lib/motion';
import { togglePlay } from './BottomBar';

// Covers the canvas while the timeline plays, like Canva's in-editor playback.
export function PlaybackOverlay() {
  const playing = useUi((s) => s.playing);
  const time = useUi((s) => s.time);
  const doc = useEditor((s) => s.doc);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  usePlaybackClock(doc, playing, time, useUi.getState().setTime, () => {
    useUi.getState().setPlaying(false);
    useEditor.getState().setPageIndex(doc.pages.length - 1);
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth - 64, h: el.clientHeight - 64 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [playing]);
  // Keep the editor's current page in step with the playhead.
  const index = locate(doc, Math.min(time, totalSeconds(doc) - 0.001)).index;
  useEffect(() => {
    if (playing && useEditor.getState().pageIndex !== index) useEditor.setState({ pageIndex: index, selectedIds: [] });
  }, [index, playing]);
  if (!playing) return null;
  return (
    <div ref={ref} className="absolute inset-0 z-20 flex items-center justify-center bg-paper" onClick={togglePlay} data-testid="playback">
      <div className="shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
        <Player doc={doc} time={time} playing boxW={Math.max(100, box.w)} boxH={Math.max(100, box.h)} />
      </div>
      <span className="absolute bottom-3 right-4 rounded bg-black/60 px-2 py-0.5 text-xs tabular-nums text-white">
        {formatTime(time)} / {formatTime(totalSeconds(doc))}
      </span>
    </div>
  );
}
