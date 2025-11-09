// src/api/http.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: false,
});

/* ===== LABS ===== */
export const labsApi = {
  // admite filtro q opcional
  list:   (params = {})            => api.get("/labs", { params }),
  create: (data)                   => api.post("/labs", data),
  update: (id, data)               => api.put(`/labs/${id}`, data),
  toggleActive: (id)               => api.patch(`/labs/${id}/activo`),
  remove: (id)                     => api.delete(`/labs/${id}`),
};

/* ===== PERIODOS ===== */
export const periodosApi = {
  // usa includeDeleted: 0/1 si lo necesitas
  list:        (params = {})       => api.get("/periodos", { params }),
  create:      (data)              => api.post("/periodos", data),
  update:      (id, data)          => api.put(`/periodos/${id}`, data),
  toggleActive:(id)                => api.patch(`/periodos/${id}/activo`),
  remove:      (id)                => api.delete(`/periodos/${id}`),        // soft-delete
  restore:     (id)                => api.patch(`/periodos/${id}/restaurar`),
};

/* ===== HORARIOS ===== */
export const horariosApi = {
  semana:      (params)            => api.get("/horarios/semana", { params }),          // { periodo_id, lab_id }
  resumen:     (params)            => api.get("/horarios/resumen", { params }),         // { periodo_id, includeDeleted }
  bulk:        (payload)           => api.post("/horarios/bulk", payload),
  remove:      (id)                => api.delete(`/horarios/${id}`),
  removeAll:   (params)            => api.delete("/horarios/todo", { params }),         // { periodo_id, lab_id }
  restoreAll:  (params)            => api.patch("/horarios/restaurar-todo", null, { params }),
  pdf:         (params)            => api.get("/horarios/pdf", { params, responseType:"blob" }),
};

/* ===== USERS ===== */
export const usersApi = {
  list:   (params = {})            => api.get("/users", { params }),
  create: (data)                   => api.post("/users", data),
  update: (id, data)               => api.put(`/users/${id}`, data),
  remove: (id)                     => api.delete(`/users/${id}`),
};

export default api;
