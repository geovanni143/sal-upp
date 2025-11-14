// src/api/http.js
import axios from "axios";

/* ===== Base Axios (anti-CORS en dev) ===== */
const DEV = import.meta.env.DEV;
let base = import.meta.env.VITE_API_URL || "/api";
if (DEV && /^https?:\/\//i.test(base)) base = "/api";
const BASE = base.replace(/\/+$/, "");

export const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

/* ====== Incluir token en cada request ====== */
api.interceptors.request.use((config) => {
  let t =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    null;

  if (t && t !== "null" && t !== "undefined" && t.trim() !== "") {
    config.headers.Authorization = `Bearer ${t}`;
  }

  return config;
});

/* ============= Catálogos ============= */
export const periodosApi = {
  list:         (params)   => api.get("/periodos", { params }),
  create:       (data)     => api.post("/periodos", data),
  update:       (id, data) => api.put(`/periodos/${id}`, data),
  toggleActive: (id)       => api.patch(`/periodos/${id}/activo`),
  remove:       (id)       => api.delete(`/periodos/${id}`),
  restore:      (id)       => api.patch(`/periodos/${id}/restaurar`),
};

export const labsApi = {
  list:         (params)   => api.get("/labs", { params }),
  create:       (data)     => api.post("/labs", data),
  update:       (id, data) => api.put(`/labs/${id}`, data),
  toggleActive: (id)       => api.patch(`/labs/${id}/activo`),
  remove:       (id)       => api.delete(`/labs/${id}`),
  restore:      (id)       => api.patch(`/labs/${id}/restaurar`),
};

export const usersApi = {
  list:   (params)   => api.get("/users", { params }), // ?roles=docente,admin,superadmin
  create: (data)     => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id)       => api.delete(`/users/${id}`),
};

/* ============= Horarios ============= */
export const horariosApi = {
  catalogo: (params) =>
    api.get("/horarios/catalogo", { params }),

  semana: (params) =>
    api.get("/horarios/semana", { params }),

  bulk: (body) =>
    api.post("/horarios/bulk", body),

  activar: ({ periodo_id, lab_id }) =>
    api.patch(`/horarios/catalogo/${periodo_id}/${lab_id}/activar`),

  desactivar: ({ periodo_id, lab_id }) =>
    api.patch(`/horarios/catalogo/${periodo_id}/${lab_id}/desactivar`),

  eliminar: ({ periodo_id, lab_id }) =>
    api.delete(`/horarios/catalogo/${periodo_id}/${lab_id}`),

  restore: ({ periodo_id, lab_id }) =>
    api.post(`/horarios/catalogo/${periodo_id}/${lab_id}/restore`),

  pdf: (params) =>
    api.get("/horarios/pdf", {
      params,
      responseType: "blob",
    }),
};

export default api;
