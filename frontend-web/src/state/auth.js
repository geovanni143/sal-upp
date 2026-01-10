// frontend-web/src/state/auth.js

const LS_TOKEN = "token";
const LS_USER = "user";
const LS_ROLE = "role";

/**
 * Guarda en localStorage si remember=true, si no en sessionStorage.
 * Si localStorage falla (Edge/Políticas), hace fallback a sessionStorage.
 */
export function saveSession({ token, user }, { remember = true } = {}) {
  const storage = remember ? window.localStorage : window.sessionStorage;

  try {
    if (token) storage.setItem(LS_TOKEN, token);

    // Guarda user completo
    if (user) storage.setItem(LS_USER, JSON.stringify(user));

    // Normaliza rol
    const role = user?.rol || user?.role || "";
    if (role) storage.setItem(LS_ROLE, role);

    // Limpia el storage contrario para evitar conflictos
    const other = remember ? window.sessionStorage : window.localStorage;
    other.removeItem(LS_TOKEN);
    other.removeItem(LS_USER);
    other.removeItem(LS_ROLE);
  } catch (e) {
    // fallback: Edge a veces bloquea localStorage por políticas
    try {
      window.sessionStorage.setItem(LS_TOKEN, token || "");
      window.sessionStorage.setItem(LS_USER, JSON.stringify(user || {}));
      window.sessionStorage.setItem(LS_ROLE, user?.rol || user?.role || "");
    } catch (e2) {
      console.error("No se pudo guardar sesión en ningún storage:", e2);
    }
  }
}

export function clearSession() {
  [window.localStorage, window.sessionStorage].forEach((s) => {
    try {
      s.removeItem(LS_TOKEN);
      s.removeItem(LS_USER);
      s.removeItem(LS_ROLE);
    } catch (e) {
      // no-op
    }
  });
}

export function getToken() {
  try {
    return (
      window.localStorage.getItem(LS_TOKEN) ||
      window.sessionStorage.getItem(LS_TOKEN) ||
      ""
    );
  } catch (e) {
    // si localStorage truena por políticas, intenta sessionStorage
    try {
      return window.sessionStorage.getItem(LS_TOKEN) || "";
    } catch {
      return "";
    }
  }
}

export function getUser() {
  let raw = null;

  try {
    raw =
      window.localStorage.getItem(LS_USER) ||
      window.sessionStorage.getItem(LS_USER);
  } catch (e) {
    try {
      raw = window.sessionStorage.getItem(LS_USER);
    } catch {
      raw = null;
    }
  }

  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getRole() {
  let role = "";

  try {
    role =
      window.localStorage.getItem(LS_ROLE) ||
      window.sessionStorage.getItem(LS_ROLE) ||
      "";
  } catch (e) {
    try {
      role = window.sessionStorage.getItem(LS_ROLE) || "";
    } catch {
      role = "";
    }
  }

  if (role) return role;

  // fallback: leer de user si por algo no se guardó role
  const user = getUser();
  return user?.rol || user?.role || "";
}
