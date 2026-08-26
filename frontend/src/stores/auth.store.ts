import { create } from 'zustand';
import type { User } from '../types';
import { tokenStorage } from '../services/api';
import api from '../services/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (u: User | null) => void;
  loadCurrentUser: () => Promise<User | null>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  setUser: (u) => set({ user: u }),
  loadCurrentUser: async () => {
    const token = tokenStorage.getAccess();
    if (!token) {
      set({ initialized: true });
      return null;
    }
    try {
      const { data } = await api.get<User>('/users/me');
      set({ user: data, initialized: true });
      return data;
    } catch {
      tokenStorage.clear();
      set({ user: null, initialized: true });
      return null;
    }
  },
  logout: async () => {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      try { await api.post('/auth/logout', { refreshToken: refresh }); } catch {}
    }
    tokenStorage.clear();
    set({ user: null });
  },
}));
