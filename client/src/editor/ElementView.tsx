import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { icons } from 'lucide-react';
import QRCode from 'qrcode';
import type {
  ChartElement,
  DesignElement,
  DrawElement,
  Fill,
  ImageElement,
  LineElement,
  Page,
  QrElement,
  ShapeElement,
  TableElement,
  TextElement,
  VideoElement,
} from '../types';
import { frameStyle, shapePath } from '../lib/shapes';
import { animationOrder, clipTime, elementMotion, motionCss, pageSeconds } from '../lib/motion';

export function fillCss(fill: Fill): string {
  if (fill.type === 'linear') return `linear-gradient(${fill.angle ?? 135}deg, ${fill.color}, ${fill.color2 ?? fill.color})`;
  return fill.color;
}

function SvgFill({ id, fill }: { id: string; fill: Fill }) {
  if (fill.type !== 'linear') return null;
  // Convert a CSS gradient angle to SVG x1/y1/x2/y2 in the unit box.
  const a = (((fill.angle ?? 135) - 90) * Math.PI) / 180;
  const x = Math.cos(a) / 2;
  const y = Math.sin(a) / 2;
  return (
    <defs>
      <linearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
        <stop offset="0" stopColor={fill.color} />
        <stop offset="1" stopColor={fill.color2 ?? fill.color} />
      </linearGradient>
    </defs>
  );
}

const dashArray = (dash: string | undefined, w: number) =>
  dash === 'dashed' ? `${w * 3} ${w * 2}` : dash === 'dotted' ? `0 ${w * 2}` : undefined;

export function textStyle(el: TextElement): CSSProperties {
  const deco = [el.underline && 'underline', el.strike && 'line-through'].filter(Boolean).join(' ');
  const s: CSSProperties = {
    fontFamily: `'${el.fontFamily}', sans-serif`,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.italic ? 'italic' : 'normal',
    textDecoration: deco || 'none',
    textTransform: el.uppercase ? 'uppercase' : 'none',
    color: el.color,
    textAlign: el.align,
    lineHeight: el.lineHeight,
    letterSpacing: `${el.letterSpacing}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    width: '100%',
    background: el.background,
    padding: el.background ? `${el.fontSize * 0.1}px ${el.fontSize * 0.2}px` : undefined,
    borderRadius: el.background ? el.fontSize * 0.15 : undefined,
  };
  switch (el.effect) {
    case 'outline':
      s.WebkitTextStroke = `${Math.max(1, el.fontSize / 30)}px #000`;
      break;
    case 'hollow':
      s.WebkitTextStroke = `${Math.max(1, el.fontSize / 30)}px ${el.color}`;
      s.color = 'transparent';
      break;
    case 'neon':
      s.textShadow = `0 0 ${el.fontSize * 0.1}px ${el.color}, 0 0 ${el.fontSize * 0.3}px ${el.color}, 0 0 ${el.fontSize * 0.6}px ${el.color}`;
      s.color = '#ffffff';
      break;
    case 'lift':
      s.textShadow = `0 ${el.fontSize * 0.08}px ${el.fontSize * 0.25}px rgba(0,0,0,0.35)`;
      break;
    case 'shadow': {
      const d = el.fontSize * 0.06;
      s.textShadow = `${d}px ${d}px 0 ${el.effectColor ?? 'rgba(0,0,0,0.4)'}`;
      break;
    }
    case 'echo': {
      const d = el.fontSize * 0.05;
      const c = el.effectColor ?? el.color;
      s.textShadow = [1, 2, 3].map((k) => `${d * k}px ${d * k}px 0 ${alpha(c, 0.5 / k)}`).join(', ');
      break;
    }
    case 'splice': {
      const d = el.fontSize * 0.05;
      s.WebkitTextStroke = `${Math.max(1, el.fontSize / 40)}px ${el.color}`;
      s.color = 'transparent';
      s.textShadow = `${d}px ${d}px 0 ${el.effectColor ?? '#ffb347'}`;
      break;
    }
    case 'glitch': {
      const d = el.fontSize * 0.04;
      s.textShadow = `${-d}px 0 ${el.effectColor ?? '#00e5ff'}, ${d}px 0 #ff2d75`;
      break;
    }
  }
  return s;
}

// #rrggbb plus an alpha, for effect colours.
function alpha(color: string, a: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return `${color}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(el: TextElement, text: string) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * el.fontSize * 0.6;
  measureCtx.font = `${el.italic ? 'italic ' : ''}${el.fontWeight} ${el.fontSize}px '${el.fontFamily}', sans-serif`;
  return measureCtx.measureText(text).width + el.letterSpacing * text.length;
}

// Text bent along a circular arc, like Canva's Curve effect.
function CurvedText({ el }: { el: TextElement }) {
  const text = (el.uppercase ? el.text.toUpperCase() : el.text).replace(/\n/g, ' ');
  const fs = el.fontSize;
  const tw = Math.max(fs, textWidth(el, text));
  const k = Math.max(-100, Math.min(100, el.curve ?? 0)) / 100;
  const a = Math.abs(k) * Math.PI * 1.9; // arc angle the text covers
  const r = tw / a;
  const W = el.w;
  const cx = W / 2;
  const up = k > 0;
  const cy = up ? fs + r : fs - r * Math.cos(a / 2);
  const h = up ? fs * 1.4 + r * (1 - Math.cos(a / 2)) : cy + r + fs * 0.4;
  const t1 = up ? -Math.PI / 2 - a / 2 : Math.PI / 2 + a / 2;
  const t2 = up ? -Math.PI / 2 + a / 2 : Math.PI / 2 - a / 2;
  const p = (t: number) => `${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`;
  const d = `M${p(t1)} A${r},${r} 0 ${a > Math.PI ? 1 : 0} ${up ? 1 : 0} ${p(t2)}`;
  const id = `curve-${el.id}`;
  const hollow = el.effect === 'hollow' || el.effect === 'splice';
  return (
    <svg width={W} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <path id={id} d={d} />
      </defs>
      <text
        fontFamily={`'${el.fontFamily}', sans-serif`}
        fontSize={fs}
        fontWeight={el.fontWeight}
        fontStyle={el.italic ? 'italic' : 'normal'}
        letterSpacing={el.letterSpacing}
        fill={hollow ? 'none' : el.color}
        stroke={hollow || el.effect === 'outline' ? (el.effect === 'outline' ? '#000' : el.color) : undefined}
        strokeWidth={hollow || el.effect === 'outline' ? Math.max(1, fs / 30) : undefined}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}

export function textContent(el: TextElement) {
  if (!el.list || el.list === 'none') return el.text;
  return el.text
    .split('\n')
    .map((line, i) => (line.trim() ? `${el.list === 'bullet' ? '•' : `${i + 1}.`} ${line}` : line))
    .join('\n');
}

function TextBody({ el }: { el: TextElement }) {
  if (el.curve) return <CurvedText el={el} />;
  return <div style={textStyle(el)}>{textContent(el)}</div>;
}

function ShapeBody({ el }: { el: ShapeElement }) {
  const gid = `g-${el.id}`;
  const sw = el.strokeWidth;
  const paint = el.fill.type === 'linear' ? `url(#${gid})` : el.fill.color;
  const common = {
    fill: paint,
    stroke: sw ? el.stroke : 'none',
    strokeWidth: sw,
    strokeDasharray: dashArray(el.strokeDash, sw),
    strokeLinecap: 'round' as const,
  };
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${el.w} ${el.h}`} style={{ overflow: 'visible', display: 'block' }}>
        <SvgFill id={gid} fill={el.fill} />
        {el.shape === 'rect' ? (
          <rect x={sw / 2} y={sw / 2} width={Math.max(0, el.w - sw)} height={Math.max(0, el.h - sw)} rx={el.radius} {...common} />
        ) : el.shape === 'ellipse' ? (
          <ellipse cx={el.w / 2} cy={el.h / 2} rx={Math.max(0, el.w / 2 - sw / 2)} ry={Math.max(0, el.h / 2 - sw / 2)} {...common} />
        ) : (
          <path d={shapePath(el.shape, el.w, el.h)} {...common} strokeLinejoin="round" />
        )}
      </svg>
      {el.text ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '8%',
            color: el.textColor ?? '#000',
            fontSize: el.fontSize ?? 28,
            fontFamily: `'${el.fontFamily ?? 'Inter'}', sans-serif`,
            whiteSpace: 'pre-wrap',
          }}
        >
          {el.text}
        </div>
      ) : null}
    </div>
  );
}

export function imageFilterCss(f: ImageElement['filters']) {
  return [
    f.brightness !== 100 && `brightness(${f.brightness}%)`,
    f.contrast !== 100 && `contrast(${f.contrast}%)`,
    f.saturation !== 100 && `saturate(${f.saturation}%)`,
    f.blur && `blur(${f.blur}px)`,
    f.grayscale && `grayscale(${f.grayscale}%)`,
    f.sepia && `sepia(${f.sepia}%)`,
    f.hue && `hue-rotate(${f.hue}deg)`,
  ]
    .filter(Boolean)
    .join(' ');
}

function ImageBody({ el }: { el: ImageElement }) {
  const c = el.crop;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: el.radius,
        boxShadow: el.border?.width ? `inset 0 0 0 ${el.border.width}px ${el.border.color}` : undefined,
        ...frameStyle(el.frame),
      }}
    >
      <img
        src={el.src}
        crossOrigin="anonymous"
        draggable={false}
        alt=""
        style={{
          position: 'absolute',
          left: `${c.x * 100}%`,
          top: `${c.y * 100}%`,
          width: `${c.w * 100}%`,
          height: `${c.h * 100}%`,
          objectFit: 'cover',
          maxWidth: 'none',
          filter: imageFilterCss(el.filters) || undefined,
          transform: `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      {el.border?.width ? (
        <div style={{ position: 'absolute', inset: 0, borderRadius: el.radius, boxShadow: `inset 0 0 0 ${el.border.width}px ${el.border.color}` }} />
      ) : null}
    </div>
  );
}

// How a video element shows: a still frame (thumbnails, image exports), paused at a
// point in time (timeline scrubbing) or playing.
export interface MediaMode {
  mode: 'still' | 'paused' | 'playing';
  time: number; // seconds since the element's page started
}

function VideoBody({ el, media }: { el: VideoElement; media?: MediaMode }) {
  const ref = useRef<HTMLVideoElement>(null);
  const mode = media?.mode ?? 'still';
  const t = media?.time ?? 0;
  const target = clipTime(el, t);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, el.volume));
    v.muted = el.muted || mode !== 'playing';
    if (mode === 'paused') {
      v.pause();
      if (Math.abs(v.currentTime - target) > 0.04) v.currentTime = target;
    } else if (mode === 'playing') {
      if (Math.abs(v.currentTime - target) > 0.35) v.currentTime = target;
      if (v.paused) v.play().catch(() => {});
    }
  }, [mode, target, el.volume, el.muted]);
  useEffect(() => () => ref.current?.pause(), []);
  // Keep native playback inside the trimmed range.
  const onTime = () => {
    const v = ref.current;
    if (!v || mode !== 'playing' || v.currentTime < el.trimEnd) return;
    if (el.loop) v.currentTime = el.trimStart;
    else v.pause();
  };
  const c = el.crop;
  const media_ = {
    position: 'absolute' as const,
    left: `${c.x * 100}%`,
    top: `${c.y * 100}%`,
    width: `${c.w * 100}%`,
    height: `${c.h * 100}%`,
    objectFit: 'cover' as const,
    maxWidth: 'none',
    transform: `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
  };
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', borderRadius: el.radius, background: '#000', ...frameStyle(el.frame) }}>
      {mode === 'still' ? (
        <img src={el.poster} alt="" draggable={false} style={media_} />
      ) : (
        <video ref={ref} src={el.src} poster={el.poster} crossOrigin="anonymous" playsInline preload="auto" muted style={media_} onTimeUpdate={onTime} />
      )}
    </div>
  );
}

function LineBody({ el }: { el: LineElement }) {
  const y = el.h / 2;
  const sw = el.strokeWidth;
  const cap = sw * 3;
  const x1 = el.startCap === 'none' ? 0 : cap;
  const x2 = el.endCap === 'none' ? el.w : el.w - cap;
  const marker = (kind: string, x: number, dir: 1 | -1) =>
    kind === 'arrow' ? (
      <path d={`M${x},${y} l${-dir * cap},${-cap * 0.7} l0,${cap * 1.4}z`} fill={el.color} />
    ) : kind === 'circle' ? (
      <circle cx={x - (dir * cap) / 2} cy={y} r={cap / 2} fill={el.color} />
    ) : null;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${el.w} ${el.h}`} style={{ overflow: 'visible', display: 'block' }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={el.color} strokeWidth={sw} strokeDasharray={dashArray(el.dash, sw)} strokeLinecap="round" />
      {marker(el.startCap, 0, -1)}
      {marker(el.endCap, el.w, 1)}
    </svg>
  );
}

function IconBody({ el }: { el: DesignElement & { type: 'icon' } }) {
  const Icon = icons[el.icon as keyof typeof icons];
  if (!Icon) return null;
  return <Icon width="100%" height="100%" color={el.color} strokeWidth={el.strokeWidth} absoluteStrokeWidth={false} />;
}

function DrawBody({ el }: { el: DrawElement }) {
  const sx = el.w / el.baseW;
  const sy = el.h / el.baseH;
  const d = el.points.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * sx).toFixed(1)},${(y * sy).toFixed(1)}`).join('');
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${el.w} ${el.h}`} style={{ overflow: 'visible', display: 'block' }}>
      <path d={d} fill="none" stroke={el.color} strokeWidth={el.strokeWidth * Math.min(sx, sy)} strokeLinecap={el.highlighter ? 'square' : 'round'} strokeLinejoin="round" />
    </svg>
  );
}

function TableBody({ el, editing, onCell }: { el: TableElement; editing?: boolean; onCell?: (r: number, c: number, v: string) => void }) {
  return (
    <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: `'${el.fontFamily}', sans-serif`, fontSize: el.fontSize, color: el.textColor }}>
      <tbody>
        {el.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td
                key={c}
                contentEditable={editing}
                suppressContentEditableWarning
                onBlur={(e) => onCell?.(r, c, e.currentTarget.innerText)}
                onPointerDown={(e) => editing && e.stopPropagation()}
                style={{
                  border: `1px solid ${el.borderColor}`,
                  background: r === 0 ? el.headerColor : el.cellColor,
                  fontWeight: r === 0 ? 700 : 400,
                  padding: '0.3em 0.5em',
                  verticalAlign: 'middle',
                  outline: 'none',
                  cursor: editing ? 'text' : undefined,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartBody({ el }: { el: ChartElement }) {
  const W = el.w;
  const H = el.h;
  const fs = Math.max(10, Math.min(W, H) / 18);
  const max = Math.max(1, ...el.values);
  const color = (i: number) => el.colors[i % el.colors.length];
  if (el.chart === 'pie' || el.chart === 'donut') {
    const total = el.values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const r = Math.min(W * 0.6, H) / 2 - 4;
    const cx = r + 4;
    const cy = H / 2;
    let a0 = -Math.PI / 2;
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {el.values.map((v, i) => {
          const a1 = a0 + (Math.max(0, v) / total) * Math.PI * 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}Z`;
          a0 = a1;
          return <path key={i} d={d} fill={color(i)} />;
        })}
        {el.chart === 'donut' && <circle cx={cx} cy={cy} r={r * 0.55} fill="#fff" />}
        {el.labels.map((l, i) => (
          <g key={i} transform={`translate(${cx + r + 20}, ${cy - (el.labels.length * fs * 1.5) / 2 + i * fs * 1.5})`}>
            <rect width={fs} height={fs} fill={color(i)} rx={2} />
            <text x={fs * 1.4} y={fs * 0.85} fontSize={fs} fill={el.textColor} fontFamily="Inter, sans-serif">
              {l}
              {el.showValues ? ` (${el.values[i] ?? 0})` : ''}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  const padL = fs * 2.5;
  const padB = fs * 2;
  const cw = W - padL - 8;
  const ch = H - padB - fs;
  const n = Math.max(1, el.values.length);
  const step = cw / n;
  const pts = el.values.map((v, i) => [padL + step * i + step / 2, fs + ch - (v / max) * ch] as const);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} fontFamily="Inter, sans-serif">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 8} y1={fs + ch - t * ch} y2={fs + ch - t * ch} stroke="#e5e5e5" />
          <text x={padL - 6} y={fs + ch - t * ch + fs * 0.35} fontSize={fs * 0.8} textAnchor="end" fill={el.textColor}>
            {Math.round(max * t)}
          </text>
        </g>
      ))}
      {el.chart === 'bar'
        ? el.values.map((v, i) => (
            <g key={i}>
              <rect x={padL + step * i + step * 0.15} y={fs + ch - (v / max) * ch} width={step * 0.7} height={(v / max) * ch} fill={color(i)} rx={3} />
              {el.showValues && (
                <text x={padL + step * i + step / 2} y={fs + ch - (v / max) * ch - 4} fontSize={fs * 0.8} textAnchor="middle" fill={el.textColor}>
                  {v}
                </text>
              )}
            </g>
          ))
        : (
          <>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color(0)} strokeWidth={Math.max(2, fs / 5)} strokeLinejoin="round" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r={fs / 3} fill={color(0)} />
                {el.showValues && (
                  <text x={p[0]} y={p[1] - fs * 0.6} fontSize={fs * 0.8} textAnchor="middle" fill={el.textColor}>
                    {el.values[i]}
                  </text>
                )}
              </g>
            ))}
          </>
        )}
      {el.labels.map((l, i) => (
        <text key={i} x={padL + step * i + step / 2} y={H - fs * 0.5} fontSize={fs} textAnchor="middle" fill={el.textColor}>
          {l}
        </text>
      ))}
    </svg>
  );
}

function QrBody({ el }: { el: QrElement }) {
  const modules = useMemo(() => {
    try {
      return QRCode.create(el.value || ' ', { errorCorrectionLevel: 'M' }).modules;
    } catch {
      return null;
    }
  }, [el.value]);
  if (!modules) return null;
  const n = modules.size;
  const rects: string[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(x, y)) rects.push(`M${x + 2},${y + 2}h1v1h-1z`);
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" preserveAspectRatio="none">
      <rect width={n + 4} height={n + 4} fill={el.background} />
      <path d={rects.join('')} fill={el.color} />
    </svg>
  );
}

export function ElementBody({
  el,
  editing,
  onTableCell,
  media,
}: {
  el: DesignElement;
  editing?: boolean;
  onTableCell?: (r: number, c: number, v: string) => void;
  media?: MediaMode;
}) {
  switch (el.type) {
    case 'video':
      return <VideoBody el={el} media={media} />;
    case 'text':
      return <TextBody el={el} />;
    case 'shape':
      return <ShapeBody el={el} />;
    case 'image':
      return <ImageBody el={el} />;
    case 'line':
      return <LineBody el={el} />;
    case 'icon':
      return <IconBody el={el} />;
    case 'draw':
      return <DrawBody el={el} />;
    case 'table':
      return <TableBody el={el} editing={editing} onCell={onTableCell} />;
    case 'chart':
      return <ChartBody el={el} />;
    case 'qr':
      return <QrBody el={el} />;
  }
}

export function elementBoxStyle(el: DesignElement): CSSProperties {
  return {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.type === 'text' ? 'auto' : el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity,
    filter: el.shadow ? `drop-shadow(${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${el.shadow.color})` : undefined,
  };
}

// Clickable elements in Present and on shared links.
function linkProps(el: DesignElement, onLink?: (link: string) => void) {
  if (!el.link || !onLink) return {};
  return {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onLink(el.link!);
    },
    title: el.link,
    'data-link': el.link,
    style: { ...elementBoxStyle(el), cursor: 'pointer' },
  };
}

export function openLink(link: string, goToPage?: (index: number) => void) {
  const m = /^#(\d+)$/.exec(link);
  if (m) goToPage?.(Number(m[1]) - 1);
  else window.open(link, '_blank', 'noopener');
}

// Static, non-interactive render of a page at its natural size. Used for thumbnails,
// export, presenting and the read-only share view.
export const StaticPage = memo(function StaticPage({
  page,
  width,
  height,
  animate,
  onLink,
}: {
  page: Page;
  width: number;
  height: number;
  animate?: boolean;
  onLink?: (link: string) => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        background: fillCss(page.background),
      }}
    >
      {page.backgroundImage && (
        <img src={page.backgroundImage} crossOrigin="anonymous" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {page.elements.map((el, i) => (
        <div key={el.id} style={elementBoxStyle(el)} {...linkProps(el, onLink)}>
          <div
            style={{
              width: '100%',
              height: '100%',
              animation:
                animate && el.animation && el.animation !== 'none'
                  ? `anim-${el.animation} 700ms ${i * 90}ms linear both`
                  : undefined,
            }}
          >
            <ElementBody el={el} />
          </div>
        </div>
      ))}
    </div>
  );
});

// A page at a moment in time: entrance/exit animations applied and videos synced.
// Used by the timeline player and Present.
export function TimedPage({
  page,
  width,
  height,
  time,
  playing,
  onLink,
}: {
  page: Page;
  width: number;
  height: number;
  time: number;
  playing: boolean;
  onLink?: (link: string) => void;
}) {
  const order = useMemo(() => animationOrder(page), [page]);
  const secs = pageSeconds(page);
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', background: fillCss(page.background) }}>
      {page.backgroundImage && (
        <img src={page.backgroundImage} crossOrigin="anonymous" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {page.elements.map((el) => (
        <div key={el.id} style={elementBoxStyle(el)} {...linkProps(el, onLink)}>
          <div style={{ width: '100%', height: '100%', ...motionCss(elementMotion(el, order.get(el.id) ?? -1, time, secs)) }}>
            <ElementBody el={el} media={{ mode: playing ? 'playing' : 'paused', time }} />
          </div>
        </div>
      ))}
    </div>
  );
}
