import { api } from '../api';
import type { UploadItem } from '../types';
import { probeAudio, probeVideo } from './media';
import { toast } from './toast';

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 400 });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve({ width: 400, height: 400 });
    img.src = url;
  });
}

export const uploadListeners = new Set<() => void>();

export const isMediaFile = (f: File) => /^(image|video|audio)\//.test(f.type);

// Uploads an image, video or audio file with the metadata the editor needs to place it.
export async function uploadFile(file: File): Promise<UploadItem | null> {
  try {
    let meta: { width?: number; height?: number; duration?: number; poster?: string } = {};
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      try {
        meta = await probeVideo(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      meta = { duration: await probeAudio(url) };
      URL.revokeObjectURL(url);
    } else meta = await imageSize(file);
    const up = await api.upload(file, meta);
    uploadListeners.forEach((fn) => fn());
    return { ...up, poster: up.poster ?? meta.poster ?? null };
  } catch (err) {
    toast((err as Error).message, 'error');
    return null;
  }
}

export async function uploadImageFile(file: File) {
  const up = await uploadFile(file);
  return up ? { url: up.url, width: up.width ?? 400, height: up.height ?? 400 } : null;
}
