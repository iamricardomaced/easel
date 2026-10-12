import { useEffect, useRef } from 'react';
import type { AudioTrack, DesignDoc } from '../types';
import { TimedPage } from './ElementView';
import { locate, pageSeconds, totalSeconds, trackGain, trackSourceTime, transitionAt, transitionProgress } from '../lib/motion';
import { useMedia } from '../lib/media';

// Drives a playback clock with requestAnimationFrame while `playing` is true.
export function usePlaybackClock(doc: DesignDoc, playing: boolean, time: number, setTime: (t: number) => void, onEnd: () => void, loop = false) {
  const latest = useRef({ time, setTime, onEnd });
  latest.current = { time, setTime, onEnd };
  useEffect(() => {
    if (!playing) return;
    const total = totalSeconds(doc);
    let last = performance.now();
    let t = latest.current.time >= total - 0.05 ? 0 : latest.current.time;
    let raf = 0;
    // Recent values we set; anything else showing up in `time` is a seek from outside.
    const emitted = [t];
    const step = (now: number) => {
      if (!emitted.includes(latest.current.time)) t = latest.current.time;
      t += (now - last) / 1000;
      last = now;
      if (t >= total) {
        if (loop) t = 0;
        else {
          latest.current.setTime(total);
          latest.current.onEnd();
          return;
        }
      }
      emitted.push(t);
      if (emitted.length > 4) emitted.shift();
      latest.current.setTime(t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, doc, loop]);
}

// The whole design at global time `time`, scaled to fit a `boxW` × `boxH` area.
export function Player({ doc, time, playing, boxW, boxH }: { doc: DesignDoc; time: number; playing: boolean; boxW: number; boxH: number }) {
  const scale = Math.min(boxW / doc.width, boxH / doc.height);
  const { index, local } = locate(doc, Math.min(time, totalSeconds(doc) - 0.001));
  const page = doc.pages[index];
  const p = transitionProgress(page, index, local);
  const prev = p !== null ? doc.pages[index - 1] : null;
  const f = p !== null ? transitionAt(page.transition?.kind, p) : null;
  const w = doc.width;
  const h = doc.height;
  return (
    <div style={{ width: w * scale, height: h * scale, position: 'relative', overflow: 'hidden', perspective: 2000 }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h, position: 'relative' }}>
        {prev && f && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: f.outgoing.opacity,
              transform: `translateX(${f.outgoing.tx * w}px) scale(${f.outgoing.scale}) rotateY(${f.outgoing.rotateY}deg)`,
            }}
          >
            <TimedPage key={prev.id} page={prev} width={w} height={h} time={pageSeconds(prev)} playing={false} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: f ? f.incoming.opacity : 1,
            transform: f ? `translateX(${f.incoming.tx * w}px) scale(${f.incoming.scale}) rotateY(${f.incoming.rotateY}deg)` : undefined,
            clipPath: f
              ? f.incoming.circle !== null
                ? `circle(${f.incoming.circle * 75}% at 50% 50%)`
                : f.incoming.wipe !== null
                  ? `inset(0 ${(1 - f.incoming.wipe) * 100}% 0 0)`
                  : undefined
              : undefined,
          }}
        >
          <TimedPage key={page.id} page={page} width={w} height={h} time={local} playing={playing} />
        </div>
      </div>
      {(doc.audio ?? []).map((a) => (
        <AudioVoice key={a.id} track={a} time={time} total={totalSeconds(doc)} playing={playing} />
      ))}
    </div>
  );
}

function AudioVoice({ track, time, total, playing }: { track: AudioTrack; time: number; total: number; playing: boolean }) {
  const url = useMedia(track.src);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !url) return;
    const g = trackGain(track, time, total);
    if (!playing || g === null) {
      if (!el.paused) el.pause();
      return;
    }
    el.volume = Math.min(1, g);
    const want = trackSourceTime(track, time);
    if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
    if (el.paused) el.play().catch(() => {});
  });
  useEffect(() => () => ref.current?.pause(), []);
  return url ? <audio ref={ref} src={url} preload="auto" /> : null;
}
