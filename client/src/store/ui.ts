import { create } from 'zustand';
import type { AnimationKind } from '../types';

// Side-panel routing. The first group are the rail tabs; the second are contextual
// panels the toolbar opens for the current selection (as Canva does).
export type PanelId =
  | 'templates' | 'elements' | 'text' | 'brand' | 'uploads' | 'photos' | 'videos' | 'audio' | 'draw' | 'layers' | 'charts'
  | 'position' | 'animate' | 'effects' | 'photo' | 'video' | 'transition';

export const CONTEXT_PANELS: PanelId[] = ['position', 'animate', 'effects', 'photo', 'video', 'transition'];

interface UiState {
  panel: PanelId | null;
  setPanel: (p: PanelId | null) => void;
  togglePanel: (p: PanelId) => void;
  // Plays an animation once on a canvas element, to preview it.
  preview: { id: string; kind: AnimationKind; nonce: number } | null;
  playPreview: (id: string, kind: AnimationKind) => void;
  // Timeline playback. `time` is seconds from the start of the design.
  playing: boolean;
  time: number;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  // Page whose transition the Transitions panel is editing.
  transitionPage: number;
  openTransition: (pageIndex: number) => void;
  // Video element playing inline on the canvas.
  videoPreview: string | null;
  setVideoPreview: (id: string | null) => void;
  recorder: boolean;
  setRecorder: (open: boolean) => void;
}

export const useUi = create<UiState>((set, get) => ({
  panel: 'templates',
  setPanel: (panel) => set({ panel }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p }),
  preview: null,
  playPreview: (id, kind) => {
    const nonce = Date.now();
    set({ preview: { id, kind, nonce } });
    setTimeout(() => get().preview?.nonce === nonce && set({ preview: null }), 1600);
  },
  playing: false,
  time: 0,
  setTime: (time) => set({ time }),
  setPlaying: (playing) => set({ playing }),
  transitionPage: 1,
  openTransition: (transitionPage) => set({ transitionPage, panel: 'transition' }),
  videoPreview: null,
  setVideoPreview: (videoPreview) => set({ videoPreview }),
  recorder: false,
  setRecorder: (recorder) => set({ recorder }),
}));
