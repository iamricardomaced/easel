import { create } from 'zustand';
import type { AnimationKind } from '../types';

// Side-panel routing. The first group are the rail tabs; the second are contextual
// panels the toolbar opens for the current selection (as Canva does).
export type PanelId =
  | 'templates' | 'elements' | 'text' | 'brand' | 'uploads' | 'photos' | 'draw' | 'layers' | 'charts'
  | 'position' | 'animate' | 'effects' | 'photo';

export const CONTEXT_PANELS: PanelId[] = ['position', 'animate', 'effects', 'photo'];

interface UiState {
  panel: PanelId | null;
  setPanel: (p: PanelId | null) => void;
  togglePanel: (p: PanelId) => void;
  // Plays an animation once on a canvas element, to preview it.
  preview: { id: string; kind: AnimationKind; nonce: number } | null;
  playPreview: (id: string, kind: AnimationKind) => void;
}

export const useUi = create<UiState>((set, get) => ({
  panel: 'templates',
  setPanel: (panel) => set({ panel }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p }),
  preview: null,
  playPreview: (id, kind) => {
    const nonce = Date.now();
    set({ preview: { id, kind, nonce } });
    setTimeout(() => get().preview?.nonce === nonce && set({ preview: null }), 1200);
  },
}));
