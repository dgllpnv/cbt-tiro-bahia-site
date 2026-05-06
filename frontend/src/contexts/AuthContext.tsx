import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '@/services/authService';
import type { User, UserRole } from '@/types/user';

export type { User, UserRole };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isAssociate: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = 'cbt_auth_user';

// Restore user SYNCHRONOUSLY from localStorage to avoid flicker on F5
function getInitialUser(): User | null {
  try {
    const stored = localStorage.getItem(AUTH_USER_KEY);
    const hasToken = !!localStorage.getItem('cbt_auth_token');
    if (stored && hasToken) {
      return JSON.parse(stored);
    }
  } catch {}
  return null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => getInitialUser());
  // If we have a cached user, render immediately without loading
  const [isLoading, setIsLoading] = useState(() => !getInitialUser());

  useEffect(() => {
    // Only validate token in background if we have a cached user
    if (!user) {
      setIsLoading(false);
      return;
    }

    // Background validation — don't block rendering
    const validateToken = async () => {
      try {
        const result = await authService.getMe();
        if (result.success && result.user) {
          // Token valid — update with fresh data from server
          setUser(result.user);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
        } else if ((result as any).isAuthError) {
          // Token confirmed expired by server (401) — clear session
          setUser(null);
          localStorage.removeItem(AUTH_USER_KEY);
          localStorage.removeItem('cbt_auth_token');
        }
        // For any other error (network, 500, etc) — keep cached user
      } catch {
        // Keep cached user on unexpected errors
      }
    };

    validateToken();
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const result = await authService.login(identifier, password);
      if (result.success && result.user) {
        setUser(result.user);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
        return { success: true };
      }
      return { success: false, error: result.error || 'Erro ao fazer login' };
    } catch {
      return { success: false, error: 'Erro de conexao. Tente novamente.' };
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  const refreshUser = async () => {
    const result = await authService.getMe();
    if (result.success && result.user) {
      setUser(result.user);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        isAdmin: user?.role === 'admin',
        isAssociate: user?.role === 'associate',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve estar dentro de AuthProvider');
  }
  return context;
};
