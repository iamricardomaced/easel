export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

let next = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

const emit = () => listeners.forEach((fn) => fn(items));

export function toast(text: string, kind: ToastItem['kind'] = 'info') {
  const item = { id: next++, text, kind };
  items = [...items, item];
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    emit();
  }, 3500);
}

export function subscribeToasts(fn: (items: ToastItem[]) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
