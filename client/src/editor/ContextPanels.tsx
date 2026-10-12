import { useState, type ReactNode } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround,
  AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround, ArrowDown, ArrowDownToLine, ArrowUp,
  ArrowUpToLine, X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useEditor } from '../store/editor';
import { useUi, type PanelId } from '../store/ui';
import type { AnimationKind, DesignElement, ImageElement, TextElement } from '../types';
import { ColorPicker, Slider } from '../components/ui';
import { imageFilterCss } from './ElementView';
import { uploadFile } from '../lib/upload';
import { toast } from '../lib/toast';
import { ANIMATIONS } from '../lib/motion';
import { TransitionPanel, VideoPanel } from './MediaPanels';

const start = () => useEditor.getState().checkpoint();
const live = (patch: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) =>
  useEditor.getState().updateSelected(patch, false);
const set = (patch: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) =>
  useEditor.getState().updateSelected(patch);

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={() => useUi.getState().setPanel(null)} aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}

const Label = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-5 text-sm font-semibold text-gray-800 first:mt-0">{children}</h3>;

export function ContextPanel({ panel }: { panel: PanelId }) {
  const selected = useEditor(useShallow((s) => s.selected()));
  if (panel === 'position') return <PositionPanel selected={selected} />;
  if (panel === 'transition') return <TransitionPanel />;
  if (!selected.length) return <p className="text-sm text-gray-500">Select an element first.</p>;
  if (panel === 'animate') return <AnimatePanel selected={selected} />;
  if (panel === 'effects') return <EffectsPanel selected={selected} />;
  if (panel === 'photo' && selected[0].type === 'image') return <PhotoPanel el={selected[0]} />;
  if (panel === 'video' && selected[0].type === 'video') return <VideoPanel el={selected[0]} />;
  return null;
}

// ---------- Position ----------

function PositionPanel({ selected }: { selected: DesignElement[] }) {
  const [tab, setTab] = useState<'arrange' | 'layers'>('arrange');
  return (
    <>
      <PanelHeader title="Position" />
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm">
        {(['arrange', 'layers'] as const).map((t) => (
          <button key={t} className={`rounded-md py-1.5 capitalize ${tab === t ? 'bg-white font-semibold shadow-sm' : 'text-gray-600'}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'arrange' ? <Arrange selected={selected} /> : <LayersList />}
    </>
  );
}

function Arrange({ selected }: { selected: DesignElement[] }) {
  const s = useEditor.getState();
  if (!selected.length) return <p className="text-sm text-gray-500">Select an element to arrange it, or open the Layers tab.</p>;
  const one = selected.length === 1;
  const el = selected[0];
  const btn = (label: string, icon: ReactNode, onClick: () => void) => (
    <button key={label} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
  return (
    <div>
      <div className="grid grid-cols-2 gap-1">
        {btn('Forward', <ArrowUp size={16} />, () => s.reorder('forward'))}
        {btn('Backward', <ArrowDown size={16} />, () => s.reorder('backward'))}
        {btn('To front', <ArrowUpToLine size={16} />, () => s.reorder('front'))}
        {btn('To back', <ArrowDownToLine size={16} />, () => s.reorder('back'))}
      </div>
      <Label>{one ? 'Align to page' : 'Align elements'}</Label>
      <div className="grid grid-cols-2 gap-1">
        {btn('Top', <AlignStartHorizontal size={16} />, () => s.align('top'))}
        {btn('Left', <AlignStartVertical size={16} />, () => s.align('left'))}
        {btn('Middle', <AlignCenterHorizontal size={16} />, () => s.align('middle'))}
        {btn('Centre', <AlignCenterVertical size={16} />, () => s.align('center'))}
        {btn('Bottom', <AlignEndHorizontal size={16} />, () => s.align('bottom'))}
        {btn('Right', <AlignEndVertical size={16} />, () => s.align('right'))}
      </div>
      {selected.length > 2 && (
        <>
          <Label>Spacing</Label>
          <div className="grid grid-cols-2 gap-1">
            {btn('Vertically', <AlignVerticalSpaceAround size={16} />, () => s.distribute('v'))}
            {btn('Horizontally', <AlignHorizontalSpaceAround size={16} />, () => s.distribute('h'))}
          </div>
        </>
      )}
      {one && (
        <>
          <Label>Advanced</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['w', 'h', 'x', 'y', 'rotation'] as const).map((k) => (
              <label key={k} className="text-xs text-gray-500">
                {{ w: 'Width', h: 'Height', x: 'X', y: 'Y', rotation: 'Rotate (°)' }[k]}
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-50"
                  value={Math.round(el[k] * 10) / 10}
                  disabled={(k === 'h' && el.type === 'text') || el.locked}
                  onFocus={start}
                  onChange={(e) => live({ [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!el.locked} onChange={() => s.toggleLock()} /> Lock position
          </label>
        </>
      )}
    </div>
  );
}

export function LayersList() {
  const page = useEditor((s) => s.page());
  const selectedIds = useEditor((s) => s.selectedIds);
  const s = useEditor.getState();
  const [dragId, setDragId] = useState<string | null>(null);
  const items = [...page.elements].reverse();
  const label = (el: DesignElement) =>
    el.name ||
    (el.type === 'text'
      ? el.text.slice(0, 30) || 'Text'
      : el.type === 'shape'
        ? `Shape · ${el.shape}`
        : el.type === 'icon'
          ? `Icon · ${el.icon}`
          : el.type[0].toUpperCase() + el.type.slice(1));
  if (!items.length) return <p className="text-sm text-gray-500">This page is empty.</p>;
  return (
    <div className="space-y-1">
      {items.map((el) => (
        <div
          key={el.id}
          draggable
          onDragStart={() => setDragId(el.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (!dragId || dragId === el.id) return;
            s.moveLayer(dragId, page.elements.findIndex((x) => x.id === el.id));
            setDragId(null);
          }}
          onClick={(e) => s.select([el.id], e.shiftKey)}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-sm ${selectedIds.includes(el.id) ? 'border-brand bg-brand/5' : 'hover:bg-gray-50'}`}
        >
          <span className="cursor-grab text-gray-400">⋮⋮</span>
          <span className="flex-1 truncate">{label(el)}</span>
          {el.groupId && <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">group</span>}
          <button
            className="text-xs text-gray-500 hover:text-gray-900"
            title={el.locked ? 'Unlock' : 'Lock'}
            onClick={(e) => {
              e.stopPropagation();
              s.updateElement(el.id, { locked: !el.locked });
            }}
          >
            {el.locked ? '🔒' : '🔓'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------- Animate ----------


function AnimationTile({ kind, label, active, onPick }: { kind: AnimationKind; label: string; active: boolean; onPick: () => void }) {
  const [hover, setHover] = useState(0);
  return (
    <button
      onClick={onPick}
      onPointerEnter={() => setHover(Date.now())}
      className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs ${active ? 'border-brand bg-brand/5 font-semibold text-brand' : 'hover:bg-gray-50'}`}
    >
      <span className="flex h-12 w-full items-center justify-center overflow-hidden rounded-lg bg-paper">
        <span
          key={hover}
          className="block h-6 w-10 rounded bg-brand"
          style={{ animation: kind !== 'none' && hover ? `anim-${kind} 700ms linear both` : undefined }}
        />
      </span>
      {label}
    </button>
  );
}

function AnimatePanel({ selected }: { selected: DesignElement[] }) {
  const current = selected.every((e) => (e.animation ?? 'none') === (selected[0].animation ?? 'none')) ? (selected[0].animation ?? 'none') : null;
  const pick = (kind: AnimationKind) => {
    set({ animation: kind });
    if (kind !== 'none') selected.forEach((e) => useUi.getState().playPreview(e.id, kind));
  };
  const applyToPage = () => {
    const s = useEditor.getState();
    const kind = current ?? 'fade';
    s.mutate((d) => d.pages[s.pageIndex].elements.forEach((e) => (e.animation = kind)));
    s.page().elements.forEach((e) => kind !== 'none' && useUi.getState().playPreview(e.id, kind));
  };
  return (
    <>
      <PanelHeader title="Animate" />
      <p className="mb-3 text-xs text-gray-500">Hover to preview. Animations play when you present, play the timeline or download a video, in layer order.</p>
      <div className="grid grid-cols-3 gap-2">
        {ANIMATIONS.map((a) => (
          <AnimationTile key={a.kind} kind={a.kind} label={a.label} active={current === a.kind} onPick={() => pick(a.kind)} />
        ))}
      </div>
      {current && current !== 'none' && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand" checked={selected.every((e) => e.animateOut)} onChange={(e) => set({ animateOut: e.target.checked })} />
          Also animate on exit
        </label>
      )}
      <button className="mt-4 w-full rounded-lg border py-2 text-sm hover:bg-gray-50" onClick={applyToPage}>
        Apply {current && current !== 'none' ? `“${ANIMATIONS.find((a) => a.kind === current)?.label}”` : 'Fade'} to every element on this page
      </button>
      {current && current !== 'none' && (
        <button className="mt-2 w-full rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-100" onClick={() => selected.forEach((e) => useUi.getState().playPreview(e.id, current))}>
          Play again
        </button>
      )}
    </>
  );
}

// ---------- Effects ----------

const TEXT_STYLES: { id: NonNullable<TextElement['effect']> | 'background'; label: string; preview: React.CSSProperties }[] = [
  { id: 'none', label: 'None', preview: {} },
  { id: 'lift', label: 'Lift', preview: { textShadow: '0 3px 8px rgba(0,0,0,.35)' } },
  { id: 'hollow', label: 'Hollow', preview: { color: 'transparent', WebkitTextStroke: '1.5px #16181d' } },
  { id: 'outline', label: 'Outline', preview: { WebkitTextStroke: '1.5px #000', color: '#ff5c39' } },
  { id: 'neon', label: 'Neon', preview: { color: '#fff', textShadow: '0 0 4px #ff5c39, 0 0 10px #ff5c39, 0 0 18px #ff5c39' } },
  { id: 'shadow', label: 'Shadow', preview: { textShadow: '3px 3px 0 rgba(0,0,0,.4)' } },
  { id: 'echo', label: 'Echo', preview: { textShadow: '2px 2px 0 #16181d80, 4px 4px 0 #16181d40, 6px 6px 0 #16181d2a' } },
  { id: 'splice', label: 'Splice', preview: { color: 'transparent', WebkitTextStroke: '1.5px #16181d', textShadow: '3px 3px 0 #ffb347' } },
  { id: 'glitch', label: 'Glitch', preview: { textShadow: '-2px 0 #00e5ff, 2px 0 #ff2d75' } },
  { id: 'background', label: 'Background', preview: { background: '#ffde59', padding: '0 6px', borderRadius: 4 } },
];

const EFFECT_COLOR_DEFAULT: Partial<Record<NonNullable<TextElement['effect']>, string>> = {
  shadow: '#00000066',
  echo: '#16181d',
  splice: '#ffb347',
  glitch: '#00e5ff',
};

function EffectsPanel({ selected }: { selected: DesignElement[] }) {
  const el = selected[0];
  const text = selected.every((e) => e.type === 'text') ? (el as TextElement) : null;
  const activeStyle = text ? (text.background ? 'background' : (text.effect ?? 'none')) : null;
  return (
    <>
      <PanelHeader title="Effects" />
      {text && (
        <>
          <Label>Style</Label>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_STYLES.map((st) => (
              <button
                key={st.id}
                onClick={() =>
                  st.id === 'background'
                    ? set({ background: text.background ?? '#ffde59', effect: 'none' })
                    : set({ effect: st.id, background: undefined })
                }
                className={`flex flex-col items-center gap-2 rounded-xl border p-2 text-xs ${activeStyle === st.id ? 'border-brand bg-brand/5 font-semibold text-brand' : 'hover:bg-gray-50'}`}
              >
                <span className="flex h-12 w-full items-center justify-center rounded-lg bg-paper text-2xl font-black text-ink" style={st.preview}>
                  Ag
                </span>
                {st.label}
              </button>
            ))}
          </div>
          {text.background && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-gray-500">Background colour</div>
              <ColorPicker value={text.background} onChange={(c) => set({ background: c })} />
            </div>
          )}
          {text.effect && EFFECT_COLOR_DEFAULT[text.effect] && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-gray-500">Effect colour</div>
              <ColorPicker value={(text.effectColor ?? EFFECT_COLOR_DEFAULT[text.effect]!).slice(0, 7)} onChange={(c) => set({ effectColor: c })} />
            </div>
          )}
          <Label>Shape</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['none', 'curve'] as const).map((k) => (
              <button
                key={k}
                className={`rounded-xl border p-2 text-xs capitalize ${(k === 'curve') === !!text.curve ? 'border-brand bg-brand/5 font-semibold text-brand' : 'hover:bg-gray-50'}`}
                onClick={() => set({ curve: k === 'curve' ? 50 : 0 })}
                data-testid={`text-shape-${k}`}
              >
                <span className="mb-1 block text-lg">{k === 'curve' ? '⌒ abc' : 'abc'}</span>
                {k}
              </button>
            ))}
          </div>
          {!!text.curve && (
            <div className="mt-2">
              <Slider label="Curve" value={text.curve} min={-100} max={100} onStart={start} onChange={(v) => live({ curve: v || 1 })} />
            </div>
          )}
        </>
      )}
      <Label>Shadow</Label>
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!el.shadow}
          onChange={(e) => set({ shadow: e.target.checked ? { x: 0, y: 8, blur: 16, color: 'rgba(0,0,0,0.35)' } : undefined })}
        />
        Drop shadow
      </label>
      {el.shadow && (
        <>
          <Slider label="Offset X" value={el.shadow.x} min={-50} max={50} onStart={start} onChange={(v) => live((e) => ({ shadow: { ...e.shadow!, x: v } }))} />
          <Slider label="Offset Y" value={el.shadow.y} min={-50} max={50} onStart={start} onChange={(v) => live((e) => ({ shadow: { ...e.shadow!, y: v } }))} />
          <Slider label="Blur" value={el.shadow.blur} min={0} max={80} onStart={start} onChange={(v) => live((e) => ({ shadow: { ...e.shadow!, blur: v } }))} />
          <div className="mt-2">
            <ColorPicker value={el.shadow.color.startsWith('#') ? el.shadow.color : '#000000'} onChange={(c) => set((e) => ({ shadow: { ...e.shadow!, color: `${c}88` } }))} />
          </div>
        </>
      )}
      <Label>Transparency</Label>
      <Slider label="Opacity" value={Math.round(el.opacity * 100)} min={0} max={100} onStart={start} onChange={(v) => live({ opacity: v / 100 })} />
    </>
  );
}

// ---------- Edit photo ----------

const FILTER_RESET: ImageElement['filters'] = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0, hue: 0 };
const FILTER_PRESETS: { name: string; f: Partial<ImageElement['filters']> }[] = [
  { name: 'Original', f: {} },
  { name: 'Mono', f: { grayscale: 100, contrast: 110 } },
  { name: 'Vintage', f: { sepia: 50, contrast: 90, saturation: 80 } },
  { name: 'Vivid', f: { saturation: 160, contrast: 115 } },
  { name: 'Fade', f: { contrast: 80, brightness: 110, saturation: 80 } },
  { name: 'Cool', f: { hue: 200, saturation: 90 } },
  { name: 'Warm', f: { sepia: 25, saturation: 130 } },
  { name: 'Drama', f: { contrast: 150, brightness: 90, saturation: 70 } },
  { name: 'Soft', f: { blur: 1, brightness: 105 } },
];

function BackgroundRemover({ el }: { el: ImageElement }) {
  const [busy, setBusy] = useState(false);
  const [tolerance, setTolerance] = useState(48);
  const run = async () => {
    setBusy(true);
    try {
      const { removeBackground } = await import('../lib/bgremove');
      const blob = await removeBackground(el.src, tolerance);
      const up = await uploadFile(new File([blob], 'background-removed.png', { type: 'image/png' }));
      if (up) useEditor.getState().updateElement(el.id, { src: up.url, originalSrc: el.originalSrc ?? el.src } as Partial<ImageElement>);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
    setBusy(false);
  };
  return (
    <div className="mb-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-ink py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={run} data-testid="bg-remove">
          {busy ? 'Removing…' : 'Remove background'}
        </button>
        {el.originalSrc && (
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => useEditor.getState().updateElement(el.id, { src: el.originalSrc, originalSrc: undefined } as Partial<ImageElement>)}>
            Restore
          </button>
        )}
      </div>
      <Slider label="Tolerance" value={tolerance} min={10} max={120} onChange={setTolerance} />
      <p className="text-[11px] text-gray-500">Works best on photos taken against a plain background.</p>
    </div>
  );
}

function PhotoPanel({ el }: { el: ImageElement }) {
  const f = el.filters;
  const setF = (patch: Partial<ImageElement['filters']>) => live((e) => ({ filters: { ...(e as ImageElement).filters, ...patch } }));
  return (
    <>
      <PanelHeader title="Edit photo" />
      <BackgroundRemover el={el} />
      <Label>Filters</Label>
      <div className="grid grid-cols-3 gap-2">
        {FILTER_PRESETS.map((p) => (
          <button key={p.name} className="flex flex-col items-center gap-1 text-xs" onClick={() => set({ filters: { ...FILTER_RESET, ...p.f } })}>
            <img src={el.src} crossOrigin="anonymous" alt="" className="h-20 w-full rounded-lg object-cover" style={{ filter: imageFilterCss({ ...FILTER_RESET, ...p.f }) || undefined }} />
            {p.name}
          </button>
        ))}
      </div>
      <Label>Adjust</Label>
      <Slider label="Brightness" value={f.brightness} min={0} max={200} onStart={start} onChange={(v) => setF({ brightness: v })} />
      <Slider label="Contrast" value={f.contrast} min={0} max={200} onStart={start} onChange={(v) => setF({ contrast: v })} />
      <Slider label="Saturation" value={f.saturation} min={0} max={300} onStart={start} onChange={(v) => setF({ saturation: v })} />
      <Slider label="Hue" value={f.hue} min={0} max={360} onStart={start} onChange={(v) => setF({ hue: v })} />
      <Slider label="Blur" value={f.blur} min={0} max={30} onStart={start} onChange={(v) => setF({ blur: v })} />
      <Slider label="Grayscale" value={f.grayscale} min={0} max={100} onStart={start} onChange={(v) => setF({ grayscale: v })} />
      <Slider label="Sepia" value={f.sepia} min={0} max={100} onStart={start} onChange={(v) => setF({ sepia: v })} />
      <button className="mt-3 w-full rounded-lg border py-2 text-sm hover:bg-gray-50" onClick={() => set({ filters: FILTER_RESET })}>
        Reset adjustments
      </button>
    </>
  );
}
