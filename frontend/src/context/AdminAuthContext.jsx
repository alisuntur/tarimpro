/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { ADMIN_AUTH_EVENT, clearStoredAdminAuth, getStoredAdminAuth, setStoredAdminAuth } from '../lib/adminAuth';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyStoredAuth = useCallback((payload) => {
    if (!payload?.token || !payload?.admin) {
      setAdmin(null);
      setToken(null);
      return;
    }

    setAdmin(payload.admin);
    setToken(payload.token);
  }, []);

  const syncSession = useCallback(async () => {
    const stored = getStoredAdminAuth();
    if (!stored?.token) {
      setAdmin(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const payload = await apiFetch('/api/admin/me', { token: stored.token, clearOn401: false });
      const nextAuth = { token: stored.token, admin: payload.admin };
      setStoredAdminAuth(nextAuth);
      applyStoredAuth(nextAuth);
    } catch {
      clearStoredAdminAuth();
      setAdmin(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [applyStoredAuth]);

  useEffect(() => {
    syncSession();

    const handleAuthChange = () => {
      applyStoredAuth(getStoredAdminAuth());
    };

    window.addEventListener(ADMIN_AUTH_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(ADMIN_AUTH_EVENT, handleAuthChange);
    };
  }, [applyStoredAuth, syncSession]);

  const login = useCallback(async (credentials) => {
    const response = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: credentials,
      auth: false,
      clearOn401: false,
    });

    const nextAuth = { token: response.token, admin: response.admin };
    setStoredAdminAuth(nextAuth);
    applyStoredAuth(nextAuth);
    return response;
  }, [applyStoredAuth]);

  const logout = useCallback(async () => {
    try {
      const stored = getStoredAdminAuth();
      if (stored?.token) {
        await apiFetch('/api/admin/logout', {
          method: 'POST',
          auth: false,
          token: stored.token,
          clearOn401: false,
        });
      }
    } catch {
      // Server-side token may already be gone; local cleanup is enough.
    } finally {
      clearStoredAdminAuth();
      setAdmin(null);
      setToken(null);
    }
  }, []);

  const value = useMemo(() => ({
    admin,
    token,
    loading,
    isAuthenticated: Boolean(admin && token),
    login,
    logout,
    refreshSession: syncSession,
  }), [admin, token, loading, login, logout, syncSession]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const value = useContext(AdminAuthContext);
  if (!value) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return value;
};
