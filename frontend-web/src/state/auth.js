// frontend-web/src/state/auth.js
export function saveSession({ token, user }, { remember = false } = {}) {
  const store = remember ? localStorage : sessionStorage;
  store.setItem("token", token);
  store.setItem("user", JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function getUser() {
  const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function getRole() {
  const u = getUser();
  return u?.rol || u?.role || null; // compat
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}
