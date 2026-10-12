import { useCallback, useEffect, useState } from 'react';
import type { DesignDoc } from '../types';
import { Player, usePlaybackClock } from './Player';
import { locate, pageSeconds, pageStarts, totalSeconds } from '../lib/motion';

export function Present({ doc, start = 0, onClose }: { doc: DesignDoc; start?: number; onClose: () => void }) {
  const starts = pageStarts(doc);
  const [time, setTime] = useState(starts[start] ?? 0);
  const [playing, setPlaying] = useState(true);
  const [autoplay, setAutoplay] = useState(false);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const n = doc.pages.length;
  const i = locate(doc, Math.min(time, totalSeconds(doc) - 0.001)).index;

  const go = useCallback(
    (to: number) => {
      const k = Math.max(0, Math.min(n - 1, to));
      setTime(starts[k]);
      setPlaying(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n, doc],
  );

  // Without autoplay each page holds on its last frame until you move on.
  const clamp = useCallback(
    (t: number) => {
      if (autoplay) return setTime(t);
      const end = starts[i] + pageSeconds(doc.pages[i]) - 0.02;
      if (t >= end) {
        setTime(end);
        setPlaying(false);
      } else setTime(t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoplay, i, doc],
  );
  usePlaybackClock(doc, playing, time, clamp, () => setPlaying(false), autoplay);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) go(i + 1);
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) go(i - 1);
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, i, n, onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black" onClick={() => go(i + 1)} data-testid="present">
      <Player doc={doc} time={time} playing={playing} boxW={size.w} boxH={size.h} />
      <div
        className="group fixed bottom-0 left-0 right-0 flex items-center justify-center gap-3 p-4 opacity-0 transition hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          <button disabled={i === 0} onClick={() => go(i - 1)} className="px-2 disabled:opacity-40">‹</button>
          <span>
            {i + 1} / {n}
          </span>
          <button disabled={i === n - 1} onClick={() => go(i + 1)} className="px-2 disabled:opacity-40">›</button>
          <button
            onClick={() => {
              setAutoplay(!autoplay);
              setPlaying(true);
            }}
            className="ml-2 rounded-full bg-white/15 px-3 py-0.5"
          >
            {autoplay ? 'Stop autoplay' : 'Autoplay'}
          </button>
          <button onClick={onClose} className="ml-2 rounded-full bg-white/15 px-3 py-0.5">
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
