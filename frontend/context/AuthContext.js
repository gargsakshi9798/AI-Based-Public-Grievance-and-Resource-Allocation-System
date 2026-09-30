'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, getAccessToken, setTokens } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    setTokens(data);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
    });
    setTokens(data);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* still clear local session */
    }
    clearTokens();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, ready, login, register, logout, reload: loadUser, setUser }),
    [user, ready, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function hasRole(user, roles) {
  if (!user) return false;
  return roles.includes(user.role);
}
