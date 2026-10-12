export type ShapeKind =
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'heart'
  | 'arrow'
  | 'speech'
  | 'cross';

export interface Fill {
  type: 'solid' | 'linear';
  color: string;
  color2?: string;
  angle?: number;
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

interface BaseElement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  groupId?: string;
  name?: string;
  shadow?: Shadow;
  hidden?: boolean;
  animation?: AnimationKind;
  // Play the entrance animation in reverse when the page ends.
  animateOut?: boolean;
  link?: string;
}

export type AnimationKind =
  | 'none' | 'fade' | 'rise' | 'pan' | 'pop' | 'wipe' | 'drop' | 'zoom' | 'spin' | 'blur' | 'bounce' | 'tumble';

export type TransitionKind = 'none' | 'dissolve' | 'slide' | 'push' | 'wipe' | 'zoom' | 'circle' | 'flip';

export interface Transition {
  kind: TransitionKind;
  duration: number; // seconds
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  uppercase: boolean;
  color: string;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  list?: 'none' | 'bullet' | 'number';
  background?: string;
  effect?: 'none' | 'outline' | 'neon' | 'lift' | 'hollow' | 'shadow' | 'echo' | 'splice' | 'glitch';
  effectColor?: string;
  curve?: number; // -100..100; bends a single line of text along an arc
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill: Fill;
  stroke: string;
  strokeWidth: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  radius: number;
  text?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  hue: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  flipX: boolean;
  flipY: boolean;
  radius: number;
  filters: ImageFilters;
  // Crop: the image is drawn at (cropX, cropY) with size (cropW, cropH) relative to the
  // frame, in fractions of the frame size. 0,0,1,1 = no crop.
  crop: { x: number; y: number; w: number; h: number };
  frame?: 'none' | 'circle' | 'star' | 'heart' | 'hexagon' | 'triangle';
  border?: { color: string; width: number };
  originalSrc?: string; // set after background removal, to undo it
}

export interface LineElement extends BaseElement {
  type: 'line';
  color: string;
  strokeWidth: number;
  dash: 'solid' | 'dashed' | 'dotted';
  startCap: 'none' | 'arrow' | 'circle';
  endCap: 'none' | 'arrow' | 'circle';
}

export interface IconElement extends BaseElement {
  type: 'icon';
  icon: string;
  color: string;
  strokeWidth: number;
}

export interface DrawElement extends BaseElement {
  type: 'draw';
  // Points in the element's own coordinate space, normalised to the original w/h.
  points: [number, number][];
  baseW: number;
  baseH: number;
  color: string;
  strokeWidth: number;
  highlighter?: boolean;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: string[][];
  headerColor: string;
  cellColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
}

export interface ChartElement extends BaseElement {
  type: 'chart';
  chart: 'bar' | 'line' | 'pie' | 'donut';
  labels: string[];
  values: number[];
  colors: string[];
  textColor: string;
  showValues: boolean;
}

export interface QrElement extends BaseElement {
  type: 'qr';
  value: string;
  color: string;
  background: string;
}

export interface VideoElement extends BaseElement {
  type: 'video';
  src: string;
  poster: string; // still frame used in static renders and exports to images
  duration: number; // length of the source clip in seconds
  trimStart: number;
  trimEnd: number; // seconds into the source where playback stops
  volume: number; // 0..1
  muted: boolean;
  loop: boolean;
  flipX: boolean;
  flipY: boolean;
  radius: number;
  crop: { x: number; y: number; w: number; h: number };
  frame?: ImageElement['frame'];
}

export type DesignElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | LineElement
  | IconElement
  | DrawElement
  | TableElement
  | ChartElement
  | QrElement
  | VideoElement;

export type ElementType = DesignElement['type'];

export interface Page {
  id: string;
  background: Fill;
  backgroundImage?: string;
  elements: DesignElement[];
  notes?: string;
  duration?: number; // seconds this page plays for in videos and autoplay
  transition?: Transition; // how this page enters from the previous one
  hidden?: boolean; // skipped when presenting and downloading
  title?: string;
}

export interface AudioTrack {
  id: string;
  src: string;
  name: string;
  duration: number; // source length in seconds
  start: number; // where it begins on the design timeline, seconds
  trimStart: number;
  trimEnd: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop?: boolean;
}

export interface DesignDoc {
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
  pages: Page[];
  audio?: AudioTrack[];
  guides?: { x: number[]; y: number[] };
}

export interface DesignSummary {
  id: string;
  title: string;
  thumbnail: string | null;
  starred: boolean;
  trashedAt: number | null;
  shareToken: string | null;
  shareMode: 'view' | 'template' | null;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Design extends DesignSummary {
  doc: DesignDoc;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UploadItem {
  id: string;
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
  kind: 'image' | 'video' | 'audio';
  duration: number | null;
  poster: string | null;
}

export interface BrandKit {
  colors: string[];
  fonts: { heading: string; body: string };
}

export interface Folder {
  id: string;
  name: string;
  count: number;
  createdAt: number;
}

export interface VersionSummary {
  id: string;
  title: string;
  name: string | null;
  thumbnail: string | null;
  createdAt: number;
}

export interface Comment {
  id: string;
  pageId: string | null;
  elementId: string | null;
  parentId: string | null;
  text: string;
  resolved: boolean;
  createdAt: number;
  author: { id: string; name: string };
}
