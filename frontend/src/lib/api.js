const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const AUTH_STORAGE_KEY = 'tarimpro.auth';
const AUTH_EVENT = 'tarimpro-auth-changed';
const ALERTS_EVENT = 'tarimpro-alerts-changed';

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) ?? sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(payload, remember = false) {
  const storage = remember ? localStorage : sessionStorage;
  const staleStorage = remember ? sessionStorage : localStorage;

  staleStorage.removeItem(AUTH_STORAGE_KEY);
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export async function apiFetch(path, options = {}) {
  const auth = options.auth !== false;
  const storedAuth = getStoredAuth();
  const token = options.token || (auth ? storedAuth?.token : null);
  const clearOn401 = options.clearOn401 ?? true;

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const requestPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(`${API_BASE}${requestPath}`, {
    ...options,
    headers,
    body:
      options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (response.status === 401 && clearOn401) {
    clearStoredAuth();
  }

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.detail || payload?.message || 'API isteği başarısız oldu';
    throw new Error(message);
  }

  return payload;
}

export { API_BASE, ALERTS_EVENT, AUTH_EVENT, AUTH_STORAGE_KEY };
