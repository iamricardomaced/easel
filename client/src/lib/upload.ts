import { api } from '../api';
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

export async function uploadImageFile(file: File) {
  const { width, height } = await imageSize(file);
  try {
    const up = await api.upload(file, width, height);
    uploadListeners.forEach((fn) => fn());
    return { url: up.url, width, height };
  } catch (err) {
    toast((err as Error).message, 'error');
    return null;
  }
}
