import { useEditor } from '../store/editor';
import type { UploadItem } from '../types';
import { makeAudioTrack, makeImage, makeVideo } from './factory';
import { toast } from './toast';

// Adds an uploaded image, video or audio file to the design, the way Canva does:
// images and videos land on the current page (centred or at `at`), audio goes on the timeline.
export function placeUpload(up: UploadItem, at?: { x: number; y: number }) {
  const s = useEditor.getState();
  const { doc } = s;
  if (up.kind === 'audio') {
    s.addAudio(makeAudioTrack(up.url, up.filename.replace(/\.[^.]+$/, ''), up.duration ?? 30, { loop: false, trimEnd: up.duration ?? 30 }));
    toast('Audio added to the timeline');
    return;
  }
  const w0 = up.width ?? 400;
  const h0 = up.height ?? 400;
  const k = Math.min(1, (doc.width * 0.6) / w0, (doc.height * 0.6) / h0);
  const el =
    up.kind === 'video'
      ? makeVideo(up.url, up.poster ?? '', up.duration ?? 5, w0 * k, h0 * k)
      : makeImage(up.url, w0 * k, h0 * k);
  if (at) {
    el.x = at.x - el.w / 2;
    el.y = at.y - el.h / 2;
  }
  s.addElement(el, { center: !at });
  // A page with a clip plays for as long as the clip, like Canva.
  if (el.type === 'video') {
    const st = useEditor.getState();
    const page = st.page();
    const clips = page.elements.filter((e) => e.type === 'video');
    if (clips.length === 1) st.setPageAt(st.pageIndex, { duration: Math.max(1, Math.round(Math.min(120, el.duration) * 10) / 10) });
  }
}
