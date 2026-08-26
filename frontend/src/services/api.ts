import axios, { AxiosError, AxiosInstance } from 'axios';
import toast from 'react-hot-toast';
import type { ApiError } from '../types';

const STORAGE_KEYS = {
  ACCESS: 'chatapp_access_token',
  REFRESH: 'chatapp_refresh_token',
};

export const tokenStorage = {
  getAccess(): string | null { return localStorage.getItem(STORAGE_KEYS.ACCESS); },
  getRefresh(): string | null { return localStorage.getItem(STORAGE_KEYS.REFRESH); },
  set(access: string, refresh: string) {
    localStorage.setItem(STORAGE_KEYS.ACCESS, access);
    localStorage.setItem(STORAGE_KEYS.REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.REFRESH);
  },
};

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 60_000,
});

// Attach Authorization header on every request
api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh on 401 with retry-once logic
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function refreshTokens(): Promise<string | null> {
  const access = tokenStorage.getAccess();
  const refresh = tokenStorage.getRefresh();
  if (!access || !refresh) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', { accessToken: access, refreshToken: refresh });
    tokenStorage.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original._retry && !original.url.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token) return reject(error);
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      original._retry = true;
      isRefreshing = true;
      const newToken = await refreshTokens();
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb(newToken));
      refreshQueue = [];
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Could not refresh → redirect to login
      window.location.href = '/login';
    }
    // Normalize error message
    const apiError = error.response?.data;
    const message = apiError?.message || error.message || 'خطای شبکه';
    // Don't toast on 404 or 403 unless explicitly wanted; let callers handle
    if (error.response?.status && error.response.status >= 500) {
      toast.error('خطای داخلی سرور. لطفاً دوباره تلاش کنید.');
    }
    return Promise.reject(error);
  }
);

export default api;
