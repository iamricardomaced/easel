import { create } from 'zustand';
import type { User } from '../types';
import { api } from '../api';

interface AuthState {
  user: User | null;
  checked: boolean;
  check: () => Promise<void>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  checked: false,
  check: async () => {
    try {
      set({ user: await api.me(), checked: true });
    } catch {
      set({ user: null, checked: true });
    }
  },
  setUser: (user) => set({ user }),
  logout: async () => {
    await api.logout().catch(() => {});
    set({ user: null });
  },
}));
