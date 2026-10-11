import type { ReactNode } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, CaseUpper, ChevronDown,
  Copy, FlipHorizontal2, FlipVertical2, Group, Italic, List, ListOrdered, Lock, LockOpen, Minus, Plus,
  Strikethrough, Trash2, Underline, Ungroup,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useEditor } from '../store/editor';
import type {
  AnimationKind, ChartElement, DesignElement, DrawElement, IconElement, ImageElement, LineElement, QrElement,
  ShapeElement, TableElement, TextElement,
} from '../types';
import { ColorButton, ColorPicker, Popover, Slider, ToolButton } from '../components/ui';
import { FONTS } from '../lib/fonts';
import { fillCss } from './ElementView';
import { SHAPE_KINDS } from '../lib/shapes';

const Sep = () => <div className="mx-1 h-6 w-px bg-gray-200" />;

// Live edits from sliders: checkpoint once when the gesture starts, then update without history.
const start = () => useEditor.getState().checkpoint();
const live = (patch: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) =>
  useEditor.getState().updateSelected(patch, false);
const set = (patch: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) =>
  useEditor.getState().updateSelected(patch);

export function Toolbar() {
  const selected = useEditor(useShallow((s) => s.selected()));
  const editingId = useEditor((s) => s.editingId);
  if (!selected.length) return <PageToolbar />;
  const el = selected[0];
  const same = selected.every((e) => e.type === el.type);
  return (
    <div className="flex h-12 shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-white px-3">
      {same && el.type === 'text' && <TextTools el={el} />}
      {same && el.type === 'shape' && <ShapeTools el={el} />}
      {same && el.type === 'image' && <ImageTools el={el} cropping={editingId === el.id} />}
      {same && el.type === 'line' && <LineTools el={el} />}
      {same && el.type === 'icon' && <IconTools el={el} />}
      {same && el.type === 'draw' && <DrawTools el={el} />}
      {same && el.type === 'table' && <TableTools el={el} />}
      {same && el.type === 'chart' && <ChartTools el={el} />}
      {same && el.type === 'qr' && <QrTools el={el} />}
      <div className="flex-1" />
      <CommonTools selected={selected} />
    </div>
  );
}

function PageToolbar() {
  const page = useEditor((s) => s.page());
  const s = useEditor.getState();
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3 text-sm">
      <Popover title="Background colour" trigger={() => <ColorButton title="Background colour" color={page.background.color} gradient={fillCss(page.background)} />}>
        <ColorPicker
          value={page.background.color}
          onChange={(c) => s.setBackground({ type: 'solid', color: c })}
          allowGradient
          fill={page.background}
          onFill={(f) => s.setBackground(f)}
        />
      </Popover>
      {page.backgroundImage && (
        <ToolButton onClick={() => s.setBackground(page.background, null)}>Remove background image</ToolButton>
      )}
      <Sep />
      <input
        className="w-48 rounded border px-2 py-1"
        placeholder="Page title"
        value={page.title ?? ''}
        onFocus={start}
        onChange={(e) => useEditor.getState().mutate((d) => (d.pages[useEditor.getState().pageIndex].title = e.target.value), false)}
      />
      <span className="text-xs text-gray-400">Click an element to edit it</span>
    </div>
  );
}

function TextTools({ el }: { el: TextElement }) {
  const nextAlign = { left: 'center', center: 'right', right: 'justify', justify: 'left' } as const;
  const AlignIcon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[el.align];
  const nextList = { none: 'bullet', bullet: 'number', number: 'none' } as const;
  return (
    <>
      <Popover
        width={240}
        trigger={() => (
          <button className="flex h-8 w-40 items-center justify-between rounded-md border px-2 text-sm" style={{ fontFamily: el.fontFamily }}>
            <span className="truncate">{el.fontFamily}</span>
            <ChevronDown size={14} />
          </button>
        )}
      >
        {(close) => (
          <div className="space-y-0.5">
            {FONTS.map((f) => (
              <button
                key={f}
                className={`block w-full rounded px-2 py-1.5 text-left text-base hover:bg-gray-100 ${f === el.fontFamily ? 'bg-brand/10' : ''}`}
                style={{ fontFamily: f }}
                onClick={() => {
                  set({ fontFamily: f });
                  close();
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <div className="ml-1 flex items-center rounded-md border">
        <ToolButton onClick={() => set((e) => ({ fontSize: Math.max(1, Math.round((e as TextElement).fontSize) - 1) }))}>
          <Minus size={14} />
        </ToolButton>
        <input
          className="w-12 text-center text-sm outline-none"
          value={Math.round(el.fontSize)}
          onFocus={start}
          onChange={(e) => Number(e.target.value) > 0 && live({ fontSize: Number(e.target.value) })}
        />
        <ToolButton onClick={() => set((e) => ({ fontSize: Math.round((e as TextElement).fontSize) + 1 }))}>
          <Plus size={14} />
        </ToolButton>
      </div>
      <Popover title="Text colour" trigger={() => (
        <button title="Text colour" className="flex h-8 w-8 flex-col items-center justify-center rounded-md hover:bg-gray-100">
          <span className="text-base font-bold leading-none">A</span>
          <span className="mt-0.5 h-1 w-5 rounded" style={{ background: el.color }} />
        </button>
      )}>
        <ColorPicker value={el.color} onChange={(c) => set({ color: c })} />
      </Popover>
      <ToolButton title="Bold" active={el.fontWeight >= 700} onClick={() => set({ fontWeight: el.fontWeight >= 700 ? 400 : 700 })}><Bold size={16} /></ToolButton>
      <ToolButton title="Italic" active={el.italic} onClick={() => set({ italic: !el.italic })}><Italic size={16} /></ToolButton>
      <ToolButton title="Underline" active={el.underline} onClick={() => set({ underline: !el.underline })}><Underline size={16} /></ToolButton>
      <ToolButton title="Strikethrough" active={el.strike} onClick={() => set({ strike: !el.strike })}><Strikethrough size={16} /></ToolButton>
      <ToolButton title="Uppercase" active={el.uppercase} onClick={() => set({ uppercase: !el.uppercase })}><CaseUpper size={16} /></ToolButton>
      <ToolButton title="Alignment" onClick={() => set({ align: nextAlign[el.align] })}><AlignIcon size={16} /></ToolButton>
      <ToolButton title="List" active={!!el.list && el.list !== 'none'} onClick={() => set({ list: nextList[el.list ?? 'none'] })}>
        {el.list === 'number' ? <ListOrdered size={16} /> : <List size={16} />}
      </ToolButton>
      <Popover title="Spacing" trigger={() => <ToolButton title="Spacing">Spacing</ToolButton>}>
        <Slider label="Letter spacing" value={el.letterSpacing} min={-10} max={60} step={0.5} onStart={start} onChange={(v) => live({ letterSpacing: v })} />
        <Slider label="Line height" value={el.lineHeight} min={0.5} max={3} step={0.05} onStart={start} onChange={(v) => live({ lineHeight: v })} />
      </Popover>
      <Popover title="Effects" width={280} trigger={() => <ToolButton title="Effects">Effects</ToolButton>}>
        <div className="grid grid-cols-3 gap-2">
          {(['none', 'lift', 'hollow', 'outline', 'neon'] as const).map((fx) => (
            <button
              key={fx}
              className={`rounded-lg border p-2 text-sm capitalize ${el.effect === fx || (!el.effect && fx === 'none') ? 'border-brand bg-brand/5' : ''}`}
              onClick={() => set({ effect: fx })}
            >
              {fx}
            </button>
          ))}
          <button className={`rounded-lg border p-2 text-sm ${el.background ? 'border-brand bg-brand/5' : ''}`} onClick={() => set({ background: el.background ? undefined : '#ffde59' })}>
            Background
          </button>
        </div>
        {el.background && (
          <div className="mt-3">
            <ColorPicker value={el.background} onChange={(c) => set({ background: c })} />
          </div>
        )}
      </Popover>
    </>
  );
}

function ShapeTools({ el }: { el: ShapeElement }) {
  return (
    <>
      <Popover title="Colour" trigger={() => <ColorButton title="Fill colour" color={el.fill.color} gradient={fillCss(el.fill)} />}>
        <ColorPicker value={el.fill.color} onChange={(c) => set({ fill: { type: 'solid', color: c } })} allowGradient fill={el.fill} onFill={(f) => set({ fill: f })} />
      </Popover>
      <Popover title="Border" width={280} trigger={() => <ToolButton title="Border style">Border</ToolButton>}>
        <div className="mb-2 flex gap-2">
          {(['solid', 'dashed', 'dotted'] as const).map((d) => (
            <button key={d} className={`flex-1 rounded border p-1 text-xs capitalize ${el.strokeDash === d ? 'border-brand' : ''}`} onClick={() => set({ strokeDash: d, strokeWidth: el.strokeWidth || 4 })}>
              {d}
            </button>
          ))}
        </div>
        <Slider label="Border weight" value={el.strokeWidth} min={0} max={60} onStart={start} onChange={(v) => live({ strokeWidth: v })} />
        {el.shape === 'rect' && <Slider label="Corner rounding" value={el.radius} min={0} max={Math.min(el.w, el.h) / 2} onStart={start} onChange={(v) => live({ radius: v })} />}
        <div className="mt-2">
          <ColorPicker value={el.stroke} onChange={(c) => set({ stroke: c, strokeWidth: el.strokeWidth || 4 })} />
        </div>
      </Popover>
      <Popover title="Change shape" width={240} trigger={() => <ToolButton title="Change shape">Shape</ToolButton>}>
        <div className="grid grid-cols-4 gap-2">
          {SHAPE_KINDS.map((k) => (
            <button key={k} className={`rounded border p-1 text-[10px] capitalize ${el.shape === k ? 'border-brand' : ''}`} onClick={() => set({ shape: k })}>
              {k}
            </button>
          ))}
        </div>
      </Popover>
      {el.text !== undefined && (
        <>
          <Sep />
          <Popover title="Text colour" trigger={() => <ColorButton title="Text colour" color={el.textColor ?? '#000'} />}>
            <ColorPicker value={el.textColor ?? '#000000'} onChange={(c) => set({ textColor: c })} />
          </Popover>
          <input
            className="w-12 rounded border text-center text-sm"
            value={el.fontSize ?? 28}
            onFocus={start}
            onChange={(e) => Number(e.target.value) > 0 && live({ fontSize: Number(e.target.value) })}
          />
        </>
      )}
    </>
  );
}

const FILTER_PRESETS: { name: string; f: Partial<ImageElement['filters']> }[] = [
  { name: 'None', f: { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0 } },
  { name: 'Mono', f: { grayscale: 100, contrast: 110 } },
  { name: 'Vintage', f: { sepia: 50, contrast: 90, saturation: 80 } },
  { name: 'Vivid', f: { saturation: 160, contrast: 115 } },
  { name: 'Fade', f: { contrast: 80, brightness: 110, saturation: 80 } },
  { name: 'Cool', f: { hue: 200, saturation: 90 } },
  { name: 'Warm', f: { sepia: 25, saturation: 130 } },
  { name: 'Drama', f: { contrast: 150, brightness: 90, saturation: 70 } },
];

function ImageTools({ el, cropping }: { el: ImageElement; cropping: boolean }) {
  const f = el.filters;
  const setF = (patch: Partial<ImageElement['filters']>) => live((e) => ({ filters: { ...(e as ImageElement).filters, ...patch } }));
  return (
    <>
      <Popover title="Edit photo" width={300} trigger={() => <ToolButton title="Edit photo">Edit photo</ToolButton>}>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {FILTER_PRESETS.map((p) => (
            <button
              key={p.name}
              className="flex flex-col items-center gap-1 text-[11px]"
              onClick={() => set((e) => ({ filters: { ...FILTER_PRESETS[0].f, ...(e as ImageElement).filters, ...FILTER_PRESETS[0].f, ...p.f } as ImageElement['filters'] }))}
            >
              <img
                src={el.src}
                crossOrigin="anonymous"
                alt=""
                className="h-12 w-12 rounded object-cover"
                style={{ filter: `grayscale(${p.f.grayscale ?? 0}%) sepia(${p.f.sepia ?? 0}%) saturate(${p.f.saturation ?? 100}%) contrast(${p.f.contrast ?? 100}%) hue-rotate(${p.f.hue ?? 0}deg)` }}
              />
              {p.name}
            </button>
          ))}
        </div>
        <Slider label="Brightness" value={f.brightness} min={0} max={200} onStart={start} onChange={(v) => setF({ brightness: v })} />
        <Slider label="Contrast" value={f.contrast} min={0} max={200} onStart={start} onChange={(v) => setF({ contrast: v })} />
        <Slider label="Saturation" value={f.saturation} min={0} max={300} onStart={start} onChange={(v) => setF({ saturation: v })} />
        <Slider label="Blur" value={f.blur} min={0} max={30} onStart={start} onChange={(v) => setF({ blur: v })} />
        <Slider label="Hue" value={f.hue} min={0} max={360} onStart={start} onChange={(v) => setF({ hue: v })} />
        <Slider label="Grayscale" value={f.grayscale} min={0} max={100} onStart={start} onChange={(v) => setF({ grayscale: v })} />
        <Slider label="Sepia" value={f.sepia} min={0} max={100} onStart={start} onChange={(v) => setF({ sepia: v })} />
      </Popover>
      <ToolButton
        title="Crop (or double-click the image)"
        active={cropping}
        onClick={() => {
          const s = useEditor.getState();
          if (cropping) s.setEditing(null);
          else {
            s.checkpoint();
            s.setEditing(el.id);
          }
        }}
      >
        Crop
      </ToolButton>
      {cropping && (
        <div className="flex w-48 items-center gap-2 text-xs" data-crop-ui>
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            className="flex-1 accent-brand"
            value={Math.min(el.crop.w, el.crop.h)}
            onChange={(e) => {
              const z = Number(e.target.value);
              live((cur) => {
                const c = (cur as ImageElement).crop;
                const k = z / Math.min(c.w, c.h);
                const w = c.w * k;
                const h = c.h * k;
                const cx = c.x + c.w / 2;
                const cy = c.y + c.h / 2;
                return {
                  crop: {
                    w,
                    h,
                    x: Math.min(0, Math.max(1 - w, cx - w / 2)),
                    y: Math.min(0, Math.max(1 - h, cy - h / 2)),
                  },
                };
              });
            }}
          />
          <button className="rounded bg-brand px-2 py-1 text-white" onClick={() => useEditor.getState().setEditing(null)}>
            Done
          </button>
        </div>
      )}
      <ToolButton title="Flip horizontal" onClick={() => useEditor.getState().flip('x')}><FlipHorizontal2 size={16} /></ToolButton>
      <ToolButton title="Flip vertical" onClick={() => useEditor.getState().flip('y')}><FlipVertical2 size={16} /></ToolButton>
      <Popover title="Frame & corners" width={260} trigger={() => <ToolButton title="Frame">Frame</ToolButton>}>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(['none', 'circle', 'heart', 'star', 'hexagon', 'triangle'] as const).map((fr) => (
            <button key={fr} className={`rounded border p-1 text-xs capitalize ${(el.frame ?? 'none') === fr ? 'border-brand' : ''}`} onClick={() => set({ frame: fr })}>
              {fr}
            </button>
          ))}
        </div>
        <Slider label="Corner rounding" value={el.radius} min={0} max={Math.min(el.w, el.h) / 2} onStart={start} onChange={(v) => live({ radius: v })} />
        <Slider label="Border width" value={el.border?.width ?? 0} min={0} max={40} onStart={start} onChange={(v) => live({ border: { color: el.border?.color ?? '#ffffff', width: v } })} />
        {(el.border?.width ?? 0) > 0 && <ColorPicker value={el.border!.color} onChange={(c) => set({ border: { width: el.border!.width, color: c } })} />}
      </Popover>
      <ToolButton
        title="Use as page background"
        onClick={() => {
          const s = useEditor.getState();
          s.setBackground(s.page().background, el.src);
          s.deleteSelected();
        }}
      >
        Set as background
      </ToolButton>
    </>
  );
}

function LineTools({ el }: { el: LineElement }) {
  return (
    <>
      <Popover title="Colour" trigger={() => <ColorButton title="Line colour" color={el.color} />}>
        <ColorPicker value={el.color} onChange={(c) => set({ color: c })} />
      </Popover>
      <Popover title="Line style" trigger={() => <ToolButton>Style</ToolButton>}>
        <div className="mb-2 flex gap-2">
          {(['solid', 'dashed', 'dotted'] as const).map((d) => (
            <button key={d} className={`flex-1 rounded border p-1 text-xs capitalize ${el.dash === d ? 'border-brand' : ''}`} onClick={() => set({ dash: d })}>
              {d}
            </button>
          ))}
        </div>
        <Slider label="Weight" value={el.strokeWidth} min={1} max={60} onStart={start} onChange={(v) => live({ strokeWidth: v, h: Math.max(20, v * 4) })} />
      </Popover>
      {(['startCap', 'endCap'] as const).map((k) => (
        <select key={k} className="h-8 rounded border px-1 text-sm" value={el[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<LineElement>)}>
          <option value="none">{k === 'startCap' ? 'Start: none' : 'End: none'}</option>
          <option value="arrow">{k === 'startCap' ? 'Start: arrow' : 'End: arrow'}</option>
          <option value="circle">{k === 'startCap' ? 'Start: circle' : 'End: circle'}</option>
        </select>
      ))}
    </>
  );
}

function IconTools({ el }: { el: IconElement }) {
  return (
    <>
      <Popover title="Colour" trigger={() => <ColorButton title="Icon colour" color={el.color} />}>
        <ColorPicker value={el.color} onChange={(c) => set({ color: c })} />
      </Popover>
      <div className="w-40">
        <Slider label="Stroke" value={el.strokeWidth} min={0.5} max={4} step={0.25} onStart={start} onChange={(v) => live({ strokeWidth: v })} />
      </div>
    </>
  );
}

function DrawTools({ el }: { el: DrawElement }) {
  return (
    <>
      <Popover title="Colour" trigger={() => <ColorButton title="Stroke colour" color={el.color} />}>
        <ColorPicker value={el.color} onChange={(c) => set({ color: c })} />
      </Popover>
      <div className="w-40">
        <Slider label="Weight" value={el.strokeWidth} min={1} max={80} onStart={start} onChange={(v) => live({ strokeWidth: v })} />
      </div>
    </>
  );
}

function TableTools({ el }: { el: TableElement }) {
  const rows = el.rows;
  const cols = rows[0]?.length ?? 0;
  const setRows = (next: string[][], dh = 0, dw = 0) => set({ rows: next, h: el.h + dh, w: el.w + dw });
  return (
    <>
      <ToolButton onClick={() => setRows([...rows, Array(cols).fill('')], el.h / rows.length)}>+ Row</ToolButton>
      <ToolButton disabled={rows.length < 2} onClick={() => setRows(rows.slice(0, -1), -el.h / rows.length)}>− Row</ToolButton>
      <ToolButton onClick={() => setRows(rows.map((r, i) => [...r, i === 0 ? `Heading ${cols + 1}` : '']), 0, el.w / cols)}>+ Column</ToolButton>
      <ToolButton disabled={cols < 2} onClick={() => setRows(rows.map((r) => r.slice(0, -1)), 0, -el.w / cols)}>− Column</ToolButton>
      <Sep />
      {(
        [
          ['headerColor', 'Header'],
          ['cellColor', 'Cells'],
          ['borderColor', 'Borders'],
          ['textColor', 'Text'],
        ] as const
      ).map(([k, label]) => (
        <Popover key={k} title={label} trigger={() => <ColorButton title={label} color={el[k]} />}>
          <ColorPicker value={el[k]} onChange={(c) => set({ [k]: c } as Partial<TableElement>)} />
        </Popover>
      ))}
      <span className="ml-2 text-xs text-gray-400">Click a selected table to edit its cells</span>
    </>
  );
}

function ChartTools({ el }: { el: ChartElement }) {
  return (
    <>
      <select className="h-8 rounded border px-1 text-sm" value={el.chart} onChange={(e) => set({ chart: e.target.value as ChartElement['chart'] })}>
        <option value="bar">Bar chart</option>
        <option value="line">Line chart</option>
        <option value="pie">Pie chart</option>
        <option value="donut">Donut chart</option>
      </select>
      <Popover title="Data" width={300} trigger={() => <ToolButton>Edit data</ToolButton>}>
        <div className="space-y-1">
          {el.labels.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                type="color"
                value={el.colors[i % el.colors.length]}
                className="h-7 w-7 rounded border"
                onChange={(e) => set({ colors: el.colors.map((c, j) => (j === i % el.colors.length ? e.target.value : c)) })}
              />
              <input className="flex-1 rounded border px-2 py-1 text-sm" value={label} onChange={(e) => set({ labels: el.labels.map((l, j) => (j === i ? e.target.value : l)) })} />
              <input
                type="number"
                className="w-20 rounded border px-2 py-1 text-sm"
                value={el.values[i] ?? 0}
                onChange={(e) => set({ values: el.values.map((v, j) => (j === i ? Number(e.target.value) : v)) })}
              />
              <button className="px-1 text-gray-400 hover:text-red-500" onClick={() => set({ labels: el.labels.filter((_, j) => j !== i), values: el.values.filter((_, j) => j !== i) })}>
                ×
              </button>
            </div>
          ))}
          <button className="mt-1 w-full rounded border border-dashed py-1 text-sm" onClick={() => set({ labels: [...el.labels, `Item ${el.labels.length + 1}`], values: [...el.values, 10] })}>
            + Add row
          </button>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={el.showValues} onChange={(e) => set({ showValues: e.target.checked })} /> Show values
          </label>
        </div>
      </Popover>
      <Popover title="Label colour" trigger={() => <ColorButton title="Label colour" color={el.textColor} />}>
        <ColorPicker value={el.textColor} onChange={(c) => set({ textColor: c })} />
      </Popover>
    </>
  );
}

function QrTools({ el }: { el: QrElement }) {
  return (
    <>
      <input
        className="h-8 w-72 rounded border px-2 text-sm"
        value={el.value}
        onFocus={start}
        onChange={(e) => live({ value: e.target.value })}
        placeholder="https://"
      />
      <Popover title="Foreground" trigger={() => <ColorButton title="Foreground" color={el.color} />}>
        <ColorPicker value={el.color} onChange={(c) => set({ color: c })} />
      </Popover>
      <Popover title="Background" trigger={() => <ColorButton title="Background" color={el.background} />}>
        <ColorPicker value={el.background} onChange={(c) => set({ background: c })} />
      </Popover>
    </>
  );
}

const ANIMATIONS: AnimationKind[] = ['none', 'fade', 'rise', 'pan', 'pop', 'wipe'];

function CommonTools({ selected }: { selected: DesignElement[] }) {
  const s = useEditor.getState();
  const el = selected[0];
  const locked = selected.every((e) => e.locked);
  const grouped = selected.length > 1 && selected.every((e) => e.groupId && e.groupId === el.groupId);
  const one = selected.length === 1;
  return (
    <>
      <Popover title="Animate" width={220} align="right" trigger={() => <ToolButton title="Animate (plays in Present mode)">Animate</ToolButton>}>
        <div className="grid grid-cols-2 gap-2">
          {ANIMATIONS.map((a) => (
            <button key={a} className={`rounded border p-2 text-sm capitalize ${(el.animation ?? 'none') === a ? 'border-brand bg-brand/5' : ''}`} onClick={() => set({ animation: a })}>
              {a}
            </button>
          ))}
        </div>
      </Popover>
      <Popover title="Position" width={300} align="right" trigger={() => <ToolButton title="Position">Position</ToolButton>}>
        <PositionPanel one={one} />
      </Popover>
      <Popover title="Shadow" width={260} align="right" trigger={() => <ToolButton title="Shadow">Shadow</ToolButton>}>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!el.shadow} onChange={(e) => set({ shadow: e.target.checked ? { x: 0, y: 8, blur: 16, color: 'rgba(0,0,0,0.35)' } : undefined })} />
          Drop shadow
        </label>
        {el.shadow && (
          <>
            <Slider label="Offset X" value={el.shadow.x} min={-50} max={50} onStart={start} onChange={(v) => live((e) => ({ shadow: { ...e.shadow!, x: v } }))} />
            <Slider label="Offset Y" value={el.shadow.y} min={-50} max={50} onStart={start} onChange={(v) => live((e) => ({ shadow: { ...e.shadow!, y: v } }))} />
            <Slider label="Blur" value={el.shadow.blur} min={0} max={80} onStart={start} onChange={(v) => live((e) => ({ shadow: { ...e.shadow!, blur: v } }))} />
          </>
        )}
      </Popover>
      <Popover title="Transparency" width={240} align="right" trigger={() => <ToolButton title="Transparency">◐</ToolButton>}>
        <Slider label="Opacity" value={Math.round(el.opacity * 100)} min={0} max={100} onStart={start} onChange={(v) => live({ opacity: v / 100 })} />
      </Popover>
      <Sep />
      {selected.length > 1 && (
        <ToolButton title={grouped ? 'Ungroup' : 'Group'} onClick={grouped ? s.ungroup : s.group}>
          {grouped ? <Ungroup size={16} /> : <Group size={16} />}
        </ToolButton>
      )}
      <ToolButton title={locked ? 'Unlock' : 'Lock'} onClick={s.toggleLock}>{locked ? <Lock size={16} /> : <LockOpen size={16} />}</ToolButton>
      <ToolButton title="Duplicate" onClick={s.duplicateSelected}><Copy size={16} /></ToolButton>
      <ToolButton title="Delete" onClick={s.deleteSelected} disabled={locked}><Trash2 size={16} /></ToolButton>
    </>
  );
}

function PositionPanel({ one }: { one: boolean }) {
  const s = useEditor.getState();
  const el = useEditor((st) => st.selected()[0]);
  const b = (label: string, onClick: () => void, icon?: ReactNode) => (
    <button key={label} className="flex items-center justify-center gap-1 rounded border px-2 py-1.5 text-xs hover:bg-gray-50" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
  if (!el) return null;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 text-xs font-medium text-gray-500">Layer</div>
        <div className="grid grid-cols-2 gap-1.5">
          {b('Forward', () => s.reorder('forward'))}
          {b('Backward', () => s.reorder('backward'))}
          {b('To front', () => s.reorder('front'), <ArrowUpToLine size={12} />)}
          {b('To back', () => s.reorder('back'), <ArrowDownToLine size={12} />)}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-gray-500">Align {one ? 'to page' : 'elements'}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {b('Left', () => s.align('left'))}
          {b('Center', () => s.align('center'))}
          {b('Right', () => s.align('right'))}
          {b('Top', () => s.align('top'))}
          {b('Middle', () => s.align('middle'))}
          {b('Bottom', () => s.align('bottom'))}
        </div>
      </div>
      {!one && (
        <div className="grid grid-cols-2 gap-1.5">
          {b('Space horizontally', () => s.distribute('h'))}
          {b('Space vertically', () => s.distribute('v'))}
        </div>
      )}
      {one && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">Advanced</div>
          <div className="grid grid-cols-2 gap-2">
            {(['w', 'h', 'x', 'y', 'rotation'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1 text-xs">
                <span className="w-12 text-gray-500">{{ w: 'Width', h: 'Height', x: 'X', y: 'Y', rotation: 'Rotate' }[k]}</span>
                <input
                  type="number"
                  className="w-full rounded border px-1 py-0.5"
                  value={Math.round(el[k] * 10) / 10}
                  disabled={k === 'h' && el.type === 'text'}
                  onFocus={start}
                  onChange={(e) => live({ [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
