import { useEffect, useState } from 'react';
import type { DesignDoc } from '../types';
import { StaticPage } from './ElementView';

export function Present({ doc, start = 0, onClose }: { doc: DesignDoc; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [autoplay, setAutoplay] = useState(false);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const n = doc.pages.length;

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) setI((x) => Math.min(n - 1, x + 1));
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) setI((x) => Math.max(0, x - 1));
      if (e.key === 'Home') setI(0);
      if (e.key === 'End') setI(n - 1);
    };
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [n, onClose]);

  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), (doc.pages[i].duration ?? 5) * 1000);
    return () => clearTimeout(t);
  }, [autoplay, i, n, doc.pages]);

  const scale = Math.min(size.w / doc.width, size.h / doc.height);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black" onClick={() => setI((x) => Math.min(n - 1, x + 1))}>
      <div key={i} style={{ width: doc.width * scale, height: doc.height * scale, animation: 'anim-fade 300ms both' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <StaticPage page={doc.pages[i]} width={doc.width} height={doc.height} animate />
        </div>
      </div>
      <div
        className="group fixed bottom-0 left-0 right-0 flex items-center justify-center gap-3 p-4 opacity-0 transition hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          <button disabled={i === 0} onClick={() => setI(i - 1)} className="px-2 disabled:opacity-40">‹</button>
          <span>
            {i + 1} / {n}
          </span>
          <button disabled={i === n - 1} onClick={() => setI(i + 1)} className="px-2 disabled:opacity-40">›</button>
          <button onClick={() => setAutoplay(!autoplay)} className="ml-2 rounded-full bg-white/15 px-3 py-0.5">
            {autoplay ? 'Pause' : 'Autoplay'}
          </button>
          <button onClick={onClose} className="ml-2 rounded-full bg-white/15 px-3 py-0.5">
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
