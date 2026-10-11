import { create } from 'zustand';
import type { BrandKit } from '../types';
import { api } from '../api';

interface BrandState {
  kit: BrandKit;
  loaded: boolean;
  load: () => Promise<void>;
  save: (kit: BrandKit) => Promise<void>;
}

export const useBrandKit = create<BrandState>((set) => ({
  kit: { colors: [], fonts: { heading: 'Montserrat', body: 'Open Sans' } },
  loaded: false,
  load: async () => {
    try {
      set({ kit: await api.getBrandKit(), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save: async (kit) => {
    set({ kit });
    await api.saveBrandKit(kit);
  },
}));
