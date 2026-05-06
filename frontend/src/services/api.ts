import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const TOKEN_STORAGE_KEY = 'cbt_auth_token';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Inject JWT Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor - Handle Global Errors
// IMPORTANT: Do NOT clear localStorage or redirect on 401 here.
// The AuthContext handles session management. Redirecting from the
// interceptor causes race conditions on page refresh (F5) when
// multiple API calls fire simultaneously.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          // Don't auto-redirect. Let AuthContext handle this via validateToken.
          console.warn('[API] 401 - Token invalido ou expirado');
          break;
        case 403:
          console.error('[API] 403 - Permissao negada');
          break;
        case 500:
          console.error('[API] 500 - Erro interno do servidor');
          break;
      }
    }
    return Promise.reject(error);
  }
);

export const saveToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export default api;
