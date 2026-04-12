/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, AUTH_EVENT, clearStoredAuth, getStoredAuth, setStoredAuth } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyStoredAuth = useCallback((payload) => {
    if (!payload?.token || !payload?.user) {
      setUser(null);
      setToken(null);
      return;
    }
    setUser(payload.user);
    setToken(payload.token);
  }, []);

  const syncSession = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored?.token) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const payload = await apiFetch('/api/auth/me');
      const nextAuth = { token: stored.token, user: payload.user };
      setStoredAuth(nextAuth);
      applyStoredAuth(nextAuth);
    } catch {
      clearStoredAuth();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [applyStoredAuth]);

  useEffect(() => {
    syncSession();

    const handleAuthChange = () => {
      applyStoredAuth(getStoredAuth());
    };

    window.addEventListener(AUTH_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
    };
  }, [applyStoredAuth, syncSession]);

  const login = useCallback(async (credentials) => {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    });
    setStoredAuth(response, Boolean(credentials.rememberMe));
    applyStoredAuth(response);
    return response;
  }, [applyStoredAuth]);

  const register = useCallback(async (payload) => {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    });
    setStoredAuth(response, Boolean(payload.rememberMe));
    applyStoredAuth(response);
    return response;
  }, [applyStoredAuth]);
  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Session may already be invalid; local cleanup is enough.
    } finally {
      clearStoredAuth();
      setUser(null);
      setToken(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    register,
    logout,
    refreshSession: syncSession,
  }), [user, token, loading, login, register, logout, syncSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
};
