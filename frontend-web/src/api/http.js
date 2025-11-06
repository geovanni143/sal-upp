import axios from "axios";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: false
});

/* ===== LABS ===== */
export const labsApi = {
  list:   (params={})     => api.get("/labs", { params }),
  create: (data)          => api.post("/labs", data),
  update: (id, data)      => api.put(`/labs/${id}`, data),
  toggleActive: (id)      => api.patch(`/labs/${id}/activo`),
  restore: (id)           => api.patch(`/labs/${id}/restaurar`),   // <---
  remove: (id)            => api.delete(`/labs/${id}`),            // soft-delete
};
/* ===== PERIODOS ===== */
export const periodosApi = {
  list: (params={}) => api.get("/periodos", { params }),
  create: (data) => api.post("/periodos", data),
  update: (id, data) => api.put(`/periodos/${id}`, data),
  remove: (id) => api.delete(`/periodos/${id}`),
  toggleActive: (id) => api.patch(`/periodos/${id}/active`)
};
/* ===== HORARIOS ===== */
export const horariosApi = {
  list: (params={}) => api.get("/horarios",{ params }),
  create: (data) => api.post("/horarios", data),
  update: (id,data) => api.put(`/horarios/${id}`, data),
  remove: (id) => api.delete(`/horarios/${id}`)
};

/* ===== USERS ===== */
export const usersApi = {
  list: (params={}) => api.get("/users",{ params }),
  create: (data) => api.post("/users", data),
  update: (id,data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`)
};

export default api;
