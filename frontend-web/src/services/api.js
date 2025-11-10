// src/services/api.js
import axios from "axios";
import { getToken, clearSession } from "../state/auth";

// Base URL
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: false,
});

/* ================== INTERCEPTORES ================== */
// Adjunta JWT
api.interceptors.request.use(
  (config) => {
    const token = typeof getToken === "function" ? getToken() : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// Manejo de errores
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      try { typeof clearSession === "function" && clearSession(); } catch {}
      if (!/\/login/.test(location.pathname)) {
        const back = encodeURIComponent(location.pathname + location.search);
        location.replace(`/login?back=${back}`);
      }
    }
    if (status === 500) {
      console.error("[API 500]", err?.response?.data);
      alert(err?.response?.data?.message || "Error interno del servidor");
    }
    return Promise.reject(err);
  }
);

/* ================== ENDPOINTS ================== */
// LABS
export const labsApi = {
  list:   (params = {}) => api.get("/labs", { params }),
  create: (data)        => api.post("/labs", data),
  update: (id, data)    => api.put(`/labs/${id}`, data),
  toggleActive: (id)    => api.patch(`/labs/${id}/activo`),
  restore: (id)         => api.patch(`/labs/${id}/restaurar`),
  remove: (id)          => api.delete(`/labs/${id}`),
};

// PERIODOS
export const periodosApi = {
  list:         (params = {}) => api.get("/periodos", { params }),
  create:       (data)        => api.post("/periodos", data),
  update:       (id, data)    => api.put(`/periodos/${id}`, data),
  toggleActive: (id)          => api.patch(`/periodos/${id}/active`),
  remove:       (id)          => api.delete(`/periodos/${id}`),
};

// HORARIOS
export const horariosApi = {
  list:   (params = {}) => api.get("/horarios", { params }),
  create: (data)        => api.post("/horarios", data),
  update: (id, data)    => api.put(`/horarios/${id}`, data),
  toggle: (id)          => api.patch(`/horarios/${id}/activo`),
  remove: (id)          => api.delete(`/horarios/${id}`),
  matriz: (params = {}) => api.get("/horarios/matriz", { params }),
  pdf:    (params = {}) => api.get("/horarios/export.pdf", { params, responseType: "blob" }),
};

// USERS
export const usersApi = {
  list:         (params = {})   => api.get("/users", { params }),
  create:       (data)          => api.post("/users", data),
  update:       (id, data)      => api.put(`/users/${id}`, data),
  remove:       (id)            => api.delete(`/users/${id}`),
  toggleActivo: (id, activo)    => api.patch(`/users/${id}/activo`, { activo }),
};

// Export explícito para evitar “no provide export named …” por caché
export default api;
export { usersApi as _usersApiEcho, labsApi as _labsApiEcho, periodosApi as _periodosApiEcho, horariosApi as _horariosApiEcho };
