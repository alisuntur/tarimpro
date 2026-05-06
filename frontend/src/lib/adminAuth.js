const ADMIN_AUTH_STORAGE_KEY = 'tarimpro.admin.auth';
const ADMIN_AUTH_EVENT = 'tarimpro-admin-auth-changed';

export function getStoredAdminAuth() {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAdminAuth(payload) {
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(ADMIN_AUTH_EVENT));
}

export function clearStoredAdminAuth() {
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(ADMIN_AUTH_EVENT));
}

export { ADMIN_AUTH_EVENT, ADMIN_AUTH_STORAGE_KEY };
