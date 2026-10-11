import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useEditor } from '../store/editor';
import type { DesignElement, ImageElement, ShapeElement, TextElement } from '../types';
import { ElementBody, elementBoxStyle, fillCss, textStyle } from './ElementView';
import { elementAABB, intersects, resizeBox, selectionBox, snapBox, type Box, type Guide, type Handle } from '../lib/geometry';
import { makeDraw, makeImage } from '../lib/factory';
import { uploadImageFile } from '../lib/upload';
import { ContextMenu } from './ContextMenu';
import { useUi } from '../store/ui';

const EMPTY: string[] = [];
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_POS: Record<Handle, [number, number]> = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};
const CURSORS: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const cursorFor = (h: Handle, rotation: number) => {
  const idx = (CURSORS.indexOf(h) + Math.round((((rotation % 360) + 360) % 360) / 45)) % 8;
  const c = CURSORS[idx];
  return c === 'n' || c === 's' ? 'ns-resize' : c === 'e' || c === 'w' ? 'ew-resize' : c === 'ne' || c === 'sw' ? 'nesw-resize' : 'nwse-resize';
};

// Track a pointer drag on window until release.
function drag(onMove: (e: PointerEvent) => void, onUp?: (e: PointerEvent) => void) {
  const move = (e: PointerEvent) => onMove(e);
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onUp?.(e);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function Canvas() {
  const pages = useEditor((s) => s.doc.pages.length);
  const zoom = useEditor((s) => s.zoom);
  const tool = useEditor((s) => s.tool);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [spacePan, setSpacePan] = useState(false);

  // Ctrl/⌘ + wheel zooms around the pointer.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const s = useEditor.getState();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left + el.scrollLeft;
      const py = e.clientY - rect.top + el.scrollTop;
      const next = Math.min(5, Math.max(0.05, s.zoom * Math.exp(-e.deltaY * 0.01)));
      const k = next / s.zoom;
      s.setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = px * k - (e.clientX - rect.left);
        el.scrollTop = py * k - (e.clientY - rect.top);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === 'Space' && !t.isContentEditable && !['INPUT', 'TEXTAREA'].includes(t.tagName)) {
        e.preventDefault();
        setSpacePan(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpacePan(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const panning = spacePan || tool === 'hand';
  const startPan = (e: RPointerEvent) => {
    if (!panning) return;
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current!;
    const sx = e.clientX;
    const sy = e.clientY;
    const sl = el.scrollLeft;
    const st = el.scrollTop;
    drag((m) => {
      el.scrollLeft = sl - (m.clientX - sx);
      el.scrollTop = st - (m.clientY - sy);
    });
  };

  return (
    <div
      ref={scrollRef}
      className="relative flex-1 overflow-auto bg-paper"
      style={{ cursor: panning ? 'grab' : undefined }}
      onPointerDownCapture={startPan}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) useEditor.getState().select([]);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex min-w-fit flex-col items-center gap-10 px-16 py-12" onPointerDown={(e) => e.target === e.currentTarget && useEditor.getState().select([])}>
        {Array.from({ length: pages }, (_, i) => (
          <PageFrame key={i} index={i} zoom={zoom} onMenu={(x, y) => setMenu({ x, y })} />
        ))}
        <button
          className="w-full max-w-[560px] rounded-md border border-dashed border-gray-400 bg-white/60 py-2 text-sm text-gray-600 hover:bg-white"
          onClick={() => useEditor.getState().addPage(pages - 1)}
        >
          + Add page
        </button>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}

function PageFrame({ index, zoom, onMenu }: { index: number; zoom: number; onMenu: (x: number, y: number) => void }) {
  const page = useEditor((s) => s.doc.pages[index]);
  const width = useEditor((s) => s.doc.width);
  const height = useEditor((s) => s.doc.height);
  const active = useEditor((s) => s.pageIndex === index);
  const selectedIds = useEditor((s) => (s.pageIndex === index ? s.selectedIds : EMPTY));
  const editingId = useEditor((s) => s.editingId);
  const tool = useEditor((s) => s.tool);
  const showGrid = useEditor((s) => s.showGrid);
  const pageCount = useEditor((s) => s.doc.pages.length);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [livePath, setLivePath] = useState<[number, number][] | null>(null);
  const [hud, setHud] = useState<{ x: number; y: number; text: string } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const toPage = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const r = surfaceRef.current!.getBoundingClientRect();
      return [(clientX - r.left) / zoom, (clientY - r.top) / zoom];
    },
    [zoom],
  );

  const activate = () => {
    if (useEditor.getState().pageIndex !== index) useEditor.getState().setPageIndex(index);
  };

  // ---------- Background: marquee / draw ----------
  const onSurfaceDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    activate();
    const s = useEditor.getState();
    const [sx, sy] = toPage(e.clientX, e.clientY);
    if (tool === 'draw' || tool === 'highlighter') {
      e.preventDefault();
      const pts: [number, number][] = [[sx, sy]];
      setLivePath(pts);
      drag(
        (m) => {
          pts.push(toPage(m.clientX, m.clientY));
          setLivePath([...pts]);
        },
        () => {
          setLivePath(null);
          const st = useEditor.getState();
          const el = makeDraw(pts, st.penColor, tool === 'highlighter' ? st.penWidth * 3 : st.penWidth, tool === 'highlighter');
          if (el) st.mutate((d) => d.pages[index].elements.push(el));
        },
      );
      return;
    }
    if (tool === 'eraser') return;
    if (s.editingId) s.setEditing(null);
    if (!e.shiftKey) s.select([]);
    const base = e.shiftKey ? s.selectedIds : [];
    drag(
      (m) => {
        const [x, y] = toPage(m.clientX, m.clientY);
        const box = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        setMarquee(box);
        const hits = useEditor.getState().doc.pages[index].elements.filter((el) => !el.locked && intersects(elementAABB(el), box)).map((el) => el.id);
        useEditor.getState().select([...new Set([...base, ...hits])]);
      },
      () => setMarquee(null),
    );
  };

  // ---------- Element move ----------
  const onElementDown = (e: RPointerEvent, el: DesignElement) => {
    if (e.button === 2) {
      e.stopPropagation();
      activate();
      if (!useEditor.getState().selectedIds.includes(el.id)) useEditor.getState().select([el.id]);
      return;
    }
    if (e.button !== 0) return;
    if (tool === 'draw' || tool === 'highlighter') return;
    e.stopPropagation();
    activate();
    const s = useEditor.getState();
    if (tool === 'eraser') {
      if (el.type === 'draw') s.mutate((d) => (d.pages[index].elements = d.pages[index].elements.filter((x) => x.id !== el.id)));
      return;
    }
    if (s.editingId === el.id) return;
    if (s.editingId) s.setEditing(null);
    const wasSelected = s.selectedIds.includes(el.id);
    if (e.shiftKey) s.select([el.id], true);
    else if (!wasSelected) s.select([el.id]);
    if (el.locked) return;

    const st = useEditor.getState();
    const els = st.doc.pages[index].elements;
    const moving = els.filter((x) => st.selectedIds.includes(x.id) && !x.locked);
    if (!moving.length) return;
    const starts = new Map(moving.map((x) => [x.id, { x: x.x, y: x.y }]));
    const startBox = selectionBox(moving)!;
    const targets = els.filter((x) => !starts.has(x.id)).map(elementAABB);
    const [px, py] = toPage(e.clientX, e.clientY);
    let moved = false;

    drag(
      (m) => {
        const [x, y] = toPage(m.clientX, m.clientY);
        let dx = x - px;
        let dy = y - py;
        if (!moved) {
          if (Math.hypot(dx, dy) * zoom < 3) return;
          moved = true;
          useEditor.getState().checkpoint();
        }
        if (useEditor.getState().snapping && !m.altKey) {
          const snap = snapBox({ ...startBox, x: startBox.x + dx, y: startBox.y + dy }, targets, { w: width, h: height }, 6 / zoom);
          dx += snap.dx;
          dy += snap.dy;
          setGuides(snap.guides);
        }
        useEditor.getState().mutate((d) => {
          for (const it of d.pages[index].elements) {
            const s0 = starts.get(it.id);
            if (s0) {
              it.x = s0.x + dx;
              it.y = s0.y + dy;
            }
          }
        }, false);
        setHud({ x: m.clientX, y: m.clientY, text: `x ${Math.round(startBox.x + dx)} · y ${Math.round(startBox.y + dy)}` });
      },
      () => {
        setGuides([]);
        setHud(null);
        // Clicking an already-selected text box starts editing, like Canva.
        if (!moved && wasSelected && !e.shiftKey && (el.type === 'text' || el.type === 'table')) {
          useEditor.getState().checkpoint();
          useEditor.getState().setEditing(el.id);
        }
      },
    );
  };

  const onElementDouble = (el: DesignElement) => {
    if (el.locked) return;
    const s = useEditor.getState();
    if (['text', 'table', 'image', 'shape'].includes(el.type)) {
      s.checkpoint();
      if (el.type === 'shape' && el.text === undefined) s.updateElement(el.id, { text: '', textColor: '#000000', fontSize: 28 } as Partial<ShapeElement>, false);
      s.select([el.id]);
      s.setEditing(el.id);
    }
  };

  // ---------- Resize ----------
  const onHandleDown = (e: RPointerEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    const s = useEditor.getState();
    const sel = s.selected().filter((x) => !x.locked);
    if (!sel.length) return;
    s.checkpoint();
    const starts = sel.map((x) => structuredClone(x));
    const single = starts.length === 1 ? starts[0] : null;
    const box = single ? { ...single } : { ...selectionBox(starts)!, rotation: 0 };
    const [px, py] = toPage(e.clientX, e.clientY);
    const corner = handle.length === 2;

    drag((m) => {
      const [x, y] = toPage(m.clientX, m.clientY);
      const dx = x - px;
      const dy = y - py;
      const keep =
        !single ||
        (corner && (['image', 'text', 'icon', 'qr', 'chart', 'table', 'draw'].includes(single.type) ? true : !m.shiftKey));
      const nb = resizeBox(box, handle, dx, dy, keep);
      useEditor.getState().mutate((d) => {
        const els = d.pages[index].elements;
        if (single) {
          const it = els.find((q) => q.id === single.id);
          if (!it) return;
          Object.assign(it, nb);
          if (it.type === 'text') {
            const s0 = single as TextElement;
            if (corner) it.fontSize = Math.max(4, s0.fontSize * (nb.w / s0.w));
          } else if (it.type === 'image' && !corner) {
            // Side handles crop instead of stretching.
            const s0 = single as ImageElement;
            const imgW = s0.crop.w * s0.w;
            const imgH = s0.crop.h * s0.h;
            const imgLeft = s0.x + s0.crop.x * s0.w;
            const imgTop = s0.y + s0.crop.y * s0.h;
            let cw = imgW / nb.w;
            let ch = imgH / nb.h;
            let cx = (imgLeft - nb.x) / nb.w;
            let cy = (imgTop - nb.y) / nb.h;
            const k = Math.max(1, 1 / cw, 1 / ch);
            if (k > 1) {
              cx = cx - (cw * (k - 1)) / 2;
              cy = cy - (ch * (k - 1)) / 2;
              cw *= k;
              ch *= k;
            }
            cx = Math.min(0, Math.max(1 - cw, cx));
            cy = Math.min(0, Math.max(1 - ch, cy));
            it.crop = { x: cx, y: cy, w: cw, h: ch };
          } else if (it.type === 'table' && corner) {
            it.fontSize = Math.max(4, (single as typeof it).fontSize * (nb.w / single.w));
          }
        } else {
          const k = nb.w / box.w;
          for (const s0 of starts) {
            const it = els.find((q) => q.id === s0.id);
            if (!it) continue;
            it.x = nb.x + (s0.x - box.x) * k;
            it.y = nb.y + (s0.y - box.y) * k;
            it.w = s0.w * k;
            it.h = s0.h * k;
            if (it.type === 'text') it.fontSize = (s0 as TextElement).fontSize * k;
          }
        }
      }, false);
      setHud({ x: m.clientX, y: m.clientY, text: `w ${Math.round(nb.w)} · h ${Math.round(nb.h)}` });
    }, () => setHud(null));
  };

  // ---------- Rotate ----------
  const onRotateDown = (e: RPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const s = useEditor.getState();
    const sel = s.selected().filter((x) => !x.locked);
    if (sel.length !== 1) return;
    s.checkpoint();
    const el = sel[0];
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    drag((m) => {
      const [x, y] = toPage(m.clientX, m.clientY);
      let deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI - 90;
      deg = ((deg % 360) + 360) % 360;
      if (m.shiftKey) deg = Math.round(deg / 15) * 15;
      else {
        const near = Math.round(deg / 45) * 45;
        if (Math.abs(near - deg) < 3) deg = near;
      }
      deg = deg % 360;
      useEditor.getState().updateElement(el.id, { rotation: deg }, false);
      setHud({ x: m.clientX, y: m.clientY, text: `${Math.round(deg)}°` });
    }, () => setHud(null));
  };

  // ---------- Drop ----------
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    activate();
    const [x, y] = toPage(e.clientX, e.clientY);
    const s = useEditor.getState();
    const imageUnder = [...s.doc.pages[index].elements]
      .reverse()
      .find((el) => el.type === 'image' && !el.locked && intersects(elementAABB(el), { x, y, w: 1, h: 1 })) as ImageElement | undefined;

    const raw = e.dataTransfer.getData('application/x-design-element');
    if (raw) {
      const el = JSON.parse(raw) as DesignElement;
      if (el.type === 'image' && imageUnder) {
        s.updateElement(imageUnder.id, { src: el.src, crop: { x: 0, y: 0, w: 1, h: 1 } });
        return;
      }
      el.x = x - el.w / 2;
      el.y = y - el.h / 2;
      s.addElement(el, { center: false });
      return;
    }
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      const up = await uploadImageFile(file);
      if (!up) continue;
      if (imageUnder && files.length === 1) {
        s.updateElement(imageUnder.id, { src: up.url, crop: { x: 0, y: 0, w: 1, h: 1 } });
        continue;
      }
      const k = Math.min(1, (width * 0.6) / up.width, (height * 0.6) / up.height);
      const el = makeImage(up.url, up.width * k, up.height * k);
      el.x = x - el.w / 2;
      el.y = y - el.h / 2;
      s.addElement(el, { center: false });
    }
  };

  const selected = page.elements.filter((el) => selectedIds.includes(el.id));
  const single = selected.length === 1 ? selected[0] : null;
  const box = single ? single : selected.length ? { ...selectionBox(selected)!, rotation: 0 } : null;
  const anyLocked = selected.some((el) => el.locked);
  const editing = single && editingId === single.id;
  const cursor = tool === 'draw' || tool === 'highlighter' ? 'crosshair' : tool === 'eraser' ? 'cell' : undefined;

  return (
    <div className="flex flex-col gap-1.5" style={{ width: width * zoom }}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className={active ? 'font-semibold text-gray-700' : ''}>
          Page {index + 1}
          {page.title ? ` – ${page.title}` : ''}
        </span>
        <PageActions index={index} count={pageCount} />
      </div>
      <div
        ref={surfaceRef}
        data-page-index={index}
        className={`relative shadow-[0_2px_8px_rgba(0,0,0,0.12)] ${active ? 'ring-2 ring-brand/30' : ''}`}
        style={{ width: width * zoom, height: height * zoom, cursor }}
        onPointerDown={onSurfaceDown}
        onContextMenu={(e) => {
          e.preventDefault();
          activate();
          onMenu(e.clientX, e.clientY);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {/* Page content at natural size, scaled. */}
        <div
          className="absolute left-0 top-0 origin-top-left overflow-hidden"
          style={{ width, height, transform: `scale(${zoom})`, background: fillCss(page.background) }}
        >
          {page.backgroundImage && (
            <img src={page.backgroundImage} crossOrigin="anonymous" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          )}
          {page.elements.map((el) => (
            <ElementNode
              key={el.id}
              el={el}
              index={index}
              editing={editingId === el.id}
              onDown={onElementDown}
              onDouble={onElementDouble}
              onHover={setHoverId}
            />
          ))}
          {showGrid && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,92,57,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,92,57,.18) 1px, transparent 1px)',
                backgroundSize: `${width / 12}px ${width / 12}px`,
              }}
            />
          )}
          {livePath && (
            <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
              <polyline
                points={livePath.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke={useEditor.getState().penColor}
                strokeOpacity={tool === 'highlighter' ? 0.4 : 1}
                strokeWidth={tool === 'highlighter' ? useEditor.getState().penWidth * 3 : useEditor.getState().penWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Screen-space overlays */}
        {hoverId && !selectedIds.includes(hoverId) && tool === 'select' && (() => {
          const h = page.elements.find((el) => el.id === hoverId);
          return h ? <Outline box={h} zoom={zoom} className="border-brand/70" /> : null;
        })()}
        {!single && selected.map((el) => <Outline key={el.id} box={el} zoom={zoom} className="border-brand/60 border-dashed" />)}
        {box && !editing && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: box.x * zoom,
              top: box.y * zoom,
              width: box.w * zoom,
              height: box.h * zoom,
              transform: `rotate(${box.rotation}deg)`,
            }}
          >
            <div className={`absolute inset-0 border-2 ${anyLocked ? 'border-gray-400' : 'border-brand'}`} />
            {!anyLocked &&
              HANDLES.filter((h) => {
                if (single?.type === 'text') return h !== 'n' && h !== 's';
                if (single?.type === 'line') return h === 'e' || h === 'w';
                if (!single) return h.length === 2;
                return true;
              }).map((h) => {
                const [fx, fy] = HANDLE_POS[h];
                const side = h.length === 1;
                const vertical = h === 'e' || h === 'w';
                return (
                  <div
                    key={h}
                    onPointerDown={(e) => onHandleDown(e, h)}
                    className="pointer-events-auto absolute border border-gray-300 bg-white shadow"
                    style={{
                      left: `${fx * 100}%`,
                      top: `${fy * 100}%`,
                      width: side ? (vertical ? 8 : 22) : 14,
                      height: side ? (vertical ? 22 : 8) : 14,
                      borderRadius: 999,
                      transform: 'translate(-50%, -50%)',
                      cursor: cursorFor(h, box.rotation),
                    }}
                  />
                );
              })}
            {!anyLocked && single && (
              <div
                onPointerDown={onRotateDown}
                className="pointer-events-auto absolute left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow"
                style={{ top: '100%', marginTop: 14, cursor: 'grab' }}
                title="Rotate"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </div>
            )}
          </div>
        )}
        {guides.map((g, i) => (
          <div
            key={i}
            className="pointer-events-none absolute bg-sky-500"
            style={g.orientation === 'v' ? { left: g.pos * zoom, top: 0, width: 1, height: '100%' } : { top: g.pos * zoom, left: 0, height: 1, width: '100%' }}
          />
        ))}
        {marquee && (
          <div
            className="pointer-events-none absolute border border-brand bg-brand/10"
            style={{ left: marquee.x * zoom, top: marquee.y * zoom, width: marquee.w * zoom, height: marquee.h * zoom }}
          />
        )}
      </div>
      {hud && (
        <div className="pointer-events-none fixed z-50 rounded bg-gray-900 px-2 py-1 text-xs text-white" style={{ left: hud.x + 16, top: hud.y + 16 }}>
          {hud.text}
        </div>
      )}
    </div>
  );
}

function Outline({ box, zoom, className }: { box: DesignElement; zoom: number; className: string }) {
  return (
    <div
      className={`pointer-events-none absolute border-2 ${className}`}
      style={{ left: box.x * zoom, top: box.y * zoom, width: box.w * zoom, height: box.h * zoom, transform: `rotate(${box.rotation}deg)` }}
    />
  );
}

function PageActions({ index, count }: { index: number; count: number }) {
  const s = useEditor.getState();
  const btn = 'rounded px-1.5 py-0.5 hover:bg-gray-200';
  return (
    <div className="flex items-center gap-0.5">
      <button className={btn} title="Move up" disabled={index === 0} onClick={() => s.movePage(index, index - 1)}>↑</button>
      <button className={btn} title="Move down" disabled={index === count - 1} onClick={() => s.movePage(index, index + 1)}>↓</button>
      <button className={btn} title="Duplicate page" onClick={() => s.duplicatePage(index)}>⧉</button>
      <button className={btn} title="Delete page" disabled={count === 1} onClick={() => s.deletePage(index)}>🗑</button>
      <button className={btn} title="Add page" onClick={() => s.addPage(index)}>＋</button>
    </div>
  );
}

function ElementNode({
  el,
  index,
  editing,
  onDown,
  onDouble,
  onHover,
}: {
  el: DesignElement;
  index: number;
  editing: boolean;
  onDown: (e: RPointerEvent, el: DesignElement) => void;
  onDouble: (el: DesignElement) => void;
  onHover: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const preview = useUi((s) => (s.preview?.id === el.id ? s.preview : null));

  // Text boxes grow with their content; keep the stored height in sync.
  useLayoutEffect(() => {
    if (el.type !== 'text' || !ref.current) return;
    const node = ref.current;
    const sync = () => {
      const h = node.offsetHeight;
      const cur = useEditor.getState().doc.pages[index]?.elements.find((x) => x.id === el.id);
      if (cur && Math.abs(cur.h - h) > 0.5) {
        useEditor.setState((s) => {
          const doc = structuredClone(s.doc);
          const t = doc.pages[index].elements.find((x) => x.id === el.id);
          if (t) t.h = h;
          return { doc };
        });
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => ro.disconnect();
  }, [el.type, el.id, el.h, index]);

  return (
    <div
      ref={ref}
      style={{ ...elementBoxStyle(el), cursor: el.locked ? 'default' : editing ? 'text' : 'move' }}
      onPointerDown={(e) => onDown(e, el)}
      onDoubleClick={() => onDouble(el)}
      onPointerEnter={() => onHover(el.id)}
      onPointerLeave={() => onHover(null)}
    >
      <div
        key={preview?.nonce ?? 0}
        style={{
          width: '100%',
          height: el.type === 'text' ? 'auto' : '100%',
          animation: preview ? `anim-${preview.kind} 700ms both cubic-bezier(.2,.8,.2,1)` : undefined,
        }}
      >
      {editing && el.type === 'text' ? (
        <TextEditor el={el} />
      ) : editing && el.type === 'shape' ? (
        <>
          <ElementBody el={{ ...el, text: '' }} />
          <ShapeTextEditor el={el} />
        </>
      ) : editing && el.type === 'image' ? (
        <CropEditor el={el} index={index} />
      ) : (
        <ElementBody
          el={el}
          editing={editing}
          onTableCell={(r, c, v) => {
            if (el.type !== 'table') return;
            useEditor.getState().updateElement(el.id, { rows: el.rows.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? v : cell))) }, false);
          }}
        />
      )}
      </div>
    </div>
  );
}

function useEditable(initial: string, onChange: (v: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerText = initial;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    ref,
    contentEditable: 'plaintext-only' as unknown as boolean,
    suppressContentEditableWarning: true,
    onInput: (e: React.FormEvent<HTMLDivElement>) => onChange(e.currentTarget.innerText.replace(/\n$/, '')),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') (e.currentTarget as HTMLElement).blur();
      e.stopPropagation();
    },
  };
}

function TextEditor({ el }: { el: TextElement }) {
  const props = useEditable(el.text, (text) => useEditor.getState().updateElement(el.id, { text }, false));
  return (
    <div
      {...props}
      onBlur={(e) => {
        const s = useEditor.getState();
        s.setEditing(null);
        if (!e.currentTarget.innerText.trim()) {
          s.mutate((d) => d.pages.forEach((p) => (p.elements = p.elements.filter((x) => x.id !== el.id))), false);
          s.select([]);
        }
      }}
      style={{ ...textStyle(el), outline: 'none', cursor: 'text', minHeight: el.fontSize * el.lineHeight }}
    />
  );
}

function ShapeTextEditor({ el }: { el: ShapeElement }) {
  const props = useEditable(el.text ?? '', (text) => useEditor.getState().updateElement(el.id, { text }, false));
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ padding: '8%' }}>
      <div
        {...props}
        onBlur={() => useEditor.getState().setEditing(null)}
        style={{
          outline: 'none',
          minWidth: 20,
          textAlign: 'center',
          color: el.textColor ?? '#000',
          fontSize: el.fontSize ?? 28,
          fontFamily: `'${el.fontFamily ?? 'Inter'}', sans-serif`,
          whiteSpace: 'pre-wrap',
        }}
      />
    </div>
  );
}

// Double-clicking an image enters crop mode: drag to pan the photo inside its frame,
// use the toolbar slider to zoom it. Click outside to finish.
function CropEditor({ el, index }: { el: ImageElement; index: number }) {
  const zoom = useEditor((s) => s.zoom);
  useEffect(() => {
    const done = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-crop-ui]')) useEditor.getState().setEditing(null);
    };
    window.addEventListener('pointerdown', done);
    return () => window.removeEventListener('pointerdown', done);
  }, []);
  const c = el.crop;
  return (
    <div
      data-crop-ui
      className="relative h-full w-full"
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => {
        e.stopPropagation();
        const sx = e.clientX;
        const sy = e.clientY;
        const c0 = { ...c };
        drag((m) => {
          const dx = (m.clientX - sx) / zoom / el.w;
          const dy = (m.clientY - sy) / zoom / el.h;
          const x = Math.min(0, Math.max(1 - c0.w, c0.x + dx));
          const y = Math.min(0, Math.max(1 - c0.h, c0.y + dy));
          useEditor.getState().mutate((d) => {
            const it = d.pages[index].elements.find((q) => q.id === el.id) as ImageElement | undefined;
            if (it) it.crop = { ...it.crop, x, y };
          }, false);
        });
      }}
    >
      {/* Faded full image outside the frame */}
      <img
        src={el.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none opacity-40"
        style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, objectFit: 'cover' }}
      />
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={el.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, objectFit: 'cover' }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 outline outline-2 outline-brand" />
    </div>
  );
}
