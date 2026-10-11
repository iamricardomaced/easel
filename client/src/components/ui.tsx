import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Fill } from '../types';
import { DEFAULT_COLORS } from '../lib/presets';
import { useEditor } from '../store/editor';
import { useBrandKit } from '../store/brand';

export function Popover({
  trigger,
  children,
  align = 'left',
  width = 260,
  title,
}: {
  trigger: (open: boolean) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  width?: number;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative" data-crop-ui>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className={`absolute top-full z-40 mt-2 max-h-[70vh] overflow-auto rounded-xl border bg-white p-3 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ width }}
        >
          {title && <div className="mb-2 text-sm font-semibold text-gray-800">{title}</div>}
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function ToolButton({
  active,
  onClick,
  title,
  children,
  disabled,
  className = '',
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 ${active ? 'bg-[#8b3dff]/10 text-[#8b3dff]' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onStart,
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onStart?: () => void;
  suffix?: string;
}) {
  return (
    <label className="block py-1 text-xs text-gray-600">
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <input
          type="number"
          className="w-14 rounded border px-1 text-right"
          value={Math.round(value * 100) / 100}
          step={step}
          onFocus={onStart}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <input
        type="range"
        className="w-full accent-[#8b3dff]"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <span className="sr-only">{suffix}</span>}
    </label>
  );
}

// Colours used anywhere in the current design, for quick reuse.
function useDocumentColors() {
  const doc = useEditor((s) => s.doc);
  const set = new Set<string>();
  for (const p of doc.pages) {
    set.add(p.background.color);
    for (const el of p.elements) {
      if ('color' in el && typeof el.color === 'string') set.add(el.color);
      if (el.type === 'shape') set.add(el.fill.color);
    }
  }
  return [...set].filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 12);
}

function Swatch({ color, onPick, selected }: { color: string; onPick: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      title={color}
      onClick={onPick}
      className={`h-7 w-7 rounded-md border border-black/10 ${selected ? 'ring-2 ring-[#8b3dff] ring-offset-1' : ''}`}
      style={{ background: color }}
    />
  );
}

export function ColorPicker({
  value,
  onChange,
  allowGradient,
  fill,
  onFill,
}: {
  value: string;
  onChange: (c: string) => void;
  allowGradient?: boolean;
  fill?: Fill;
  onFill?: (f: Fill) => void;
}) {
  const docColors = useDocumentColors();
  const brand = useBrandKit((s) => s.kit);
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const pick = (c: string) => {
    if (onFill && fill) onFill({ type: 'solid', color: c });
    else onChange(c);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => pick(e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
        <input
          className="w-full rounded border px-2 py-1 font-mono text-sm"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex) && pick(hex)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {'EyeDropper' in window && (
          <button
            type="button"
            title="Pick colour from screen"
            className="rounded border px-2 py-1 text-sm"
            onClick={async () => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const res = await new (window as any).EyeDropper().open().catch(() => null);
              if (res?.sRGBHex) pick(res.sRGBHex);
            }}
          >
            ⌖
          </button>
        )}
      </div>
      {docColors.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Document colours</div>
          <div className="flex flex-wrap gap-1.5">
            {docColors.map((c) => (
              <Swatch key={c} color={c} onPick={() => pick(c)} selected={c === value} />
            ))}
          </div>
        </div>
      )}
      {brand.colors.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Brand kit</div>
          <div className="flex flex-wrap gap-1.5">
            {brand.colors.map((c) => (
              <Swatch key={c} color={c} onPick={() => pick(c)} selected={c === value} />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-medium text-gray-500">Default colours</div>
        <div className="grid grid-cols-6 gap-1.5">
          {DEFAULT_COLORS.map((c) => (
            <Swatch key={c} color={c} onPick={() => pick(c)} selected={c === value} />
          ))}
        </div>
      </div>
      {allowGradient && fill && onFill && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Gradient</div>
          <div className="mb-2 grid grid-cols-6 gap-1.5">
            {[
              ['#8c52ff', '#00c2cb'], ['#ff66c4', '#ffde59'], ['#5271ff', '#c1ff72'], ['#000000', '#737373'],
              ['#ff3131', '#ff914d'], ['#0cc0df', '#ffde59'], ['#004aad', '#cb6ce6'], ['#fdfbfb', '#ebedee'],
            ].map(([a, b]) => (
              <button
                key={a + b}
                type="button"
                className="h-7 w-7 rounded-md border border-black/10"
                style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                onClick={() => onFill({ type: 'linear', color: a, color2: b, angle: 135 })}
              />
            ))}
          </div>
          {fill.type === 'linear' && (
            <div className="flex items-center gap-2 text-xs">
              <input type="color" value={fill.color.slice(0, 7)} onChange={(e) => onFill({ ...fill, color: e.target.value })} className="h-7 w-8 rounded border" />
              <input type="color" value={(fill.color2 ?? fill.color).slice(0, 7)} onChange={(e) => onFill({ ...fill, color2: e.target.value })} className="h-7 w-8 rounded border" />
              <input type="range" min={0} max={360} value={fill.angle ?? 135} onChange={(e) => onFill({ ...fill, angle: Number(e.target.value) })} className="flex-1 accent-[#8b3dff]" />
              <span className="w-8 text-right">{fill.angle ?? 135}°</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ColorButton({ color, gradient, title, onClick }: { color: string; gradient?: string; title: string; onClick?: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100">
      <span className="h-6 w-6 rounded-md border border-black/15" style={{ background: gradient ?? color }} />
    </button>
  );
}

export function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[90vh] w-full overflow-auto rounded-2xl bg-white p-6 shadow-2xl" style={{ maxWidth: width }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 text-xl text-gray-500 hover:bg-gray-100" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
