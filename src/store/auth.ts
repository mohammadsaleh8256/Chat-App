'use client';

import { create } from 'zustand';
import type { SafeUser } from '@/types';
import { api } from '@/lib/api';

interface AuthState {
  user: SafeUser | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  login: (phone: string, password: string) => Promise<SafeUser>;
  register: (data: {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
  }) => Promise<SafeUser>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    set({ loading: true });
    try {
      const data = await api<{ user: SafeUser | null }>('/api/auth/me');
      set({ user: data.user, initialized: true, loading: false });
    } catch {
      set({ user: null, initialized: true, loading: false });
    }
  },

  login: async (phone, password) => {
    const data = await api<{ user: SafeUser }>('/api/auth/login', {
      method: 'POST',
      json: { phone, password },
    });
    set({ user: data.user });
    return data.user;
  },

  register: async (data) => {
    const res = await api<{ user: SafeUser }>('/api/auth/register', {
      method: 'POST',
      json: data,
    });
    set({ user: res.user });
    return res.user;
  },

  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' });
    set({ user: null });
  },
}));
