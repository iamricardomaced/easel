import { useEffect, useRef } from 'react';
import { useEditor } from '../store/editor';

const isMac = navigator.platform.toLowerCase().includes('mac');
export const MOD = isMac ? '⌘' : 'Ctrl+';

export function ContextMenu({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useEditor.getState();
  const sel = s.selected();
  const has = sel.length > 0;
  const locked = has && sel.every((e) => e.locked);
  const grouped = has && sel.every((e) => e.groupId && e.groupId === sel[0].groupId);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const item = (label: string, action: () => void, shortcut?: string, disabled = false) => (
    <button
      key={label}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-6 rounded px-3 py-1.5 text-left text-sm hover:bg-gray-100 disabled:opacity-40"
      onClick={() => {
        action();
        onClose();
      }}
    >
      <span>{label}</span>
      {shortcut && <span className="text-xs text-gray-400">{shortcut}</span>}
    </button>
  );
  const sep = (k: string) => <div key={k} className="my-1 border-t" />;

  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 380);

  return (
    <div ref={ref} className="fixed z-50 w-56 rounded-lg border bg-white p-1 shadow-xl" style={{ left, top }}>
      {item('Copy', s.copy, `${MOD}C`, !has)}
      {item('Paste', s.paste, `${MOD}V`)}
      {item('Duplicate', s.duplicateSelected, `${MOD}D`, !has)}
      {item('Delete', s.deleteSelected, 'Del', !has || locked)}
      {sep('a')}
      {item('Bring forward', () => s.reorder('forward'), `${MOD}]`, !has)}
      {item('Bring to front', () => s.reorder('front'), `${MOD}⌥]`, !has)}
      {item('Send backward', () => s.reorder('backward'), `${MOD}[`, !has)}
      {item('Send to back', () => s.reorder('back'), `${MOD}⌥[`, !has)}
      {sep('b')}
      {grouped ? item('Ungroup', s.ungroup, `${MOD}⇧G`) : item('Group', s.group, `${MOD}G`, sel.length < 2)}
      {item(locked ? 'Unlock' : 'Lock', s.toggleLock, undefined, !has)}
      {item('Align to page center', () => {
        s.align('center');
        s.align('middle');
      }, undefined, !has)}
      {sep('c')}
      {item('Select all', s.selectAll, `${MOD}A`)}
    </div>
  );
}
