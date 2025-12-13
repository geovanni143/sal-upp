// src/api/http.js
import axios from "axios";

/* ================================
   BASE URL
================================ */
const BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:3000/api";  // Asegúrate de que esta URL sea la correcta

export const http = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

/* ================================
   TOKEN GLOBAL
================================ */
http.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");

  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* ================================
   API: USERS
================================ */
export const usersApi = {
  list: (params) => http.get("/users", { params }),

  // *** NECESARIO PARA PERFIL ***
  get: (id) => http.get(`/users/${id}`),

  create: (data) => http.post("/users", data),
  update: (id, data) => http.put(`/users/${id}`, data),
  remove: (id) => http.delete(`/users/${id}`),
};

/* ================================
   API: LABS
================================ */
export const labsApi = {
  list: (params) => http.get("/labs", { params }),
  create: (data) => http.post("/labs", data),
  update: (id, data) => http.put(`/labs/${id}`, data),
  toggleActive: (id) => http.patch(`/labs/${id}/activo`),
  remove: (id) => http.delete(`/labs/${id}`),
  restore: (id) => http.patch(`/labs/${id}/restaurar`),
};

/* ================================
   API: PERIODOS
================================ */
export const periodosApi = {
  list: (params) => http.get("/periodos", { params }),
  create: (data) => http.post("/periodos", data),
  update: (id, data) => http.put(`/periodos/${id}`, data),
  toggleActive: (id) => http.patch(`/periodos/${id}/activo`),
  remove: (id) => http.delete(`/periodos/${id}`),
  restore: (id) => http.patch(`/periodos/${id}/restaurar`),
};

/* ================================
   API: HORARIOS
================================ */
export const horariosApi = {
  catalogo: (params) => http.get("/horarios/catalogo", { params }),
  semana: (params) => http.get("/horarios/semana", { params }),
  bulk: (body) => http.post("/horarios/bulk", body),

  activar: ({ periodo_id, lab_id }) =>
    http.patch(`/horarios/catalogo/${periodo_id}/${lab_id}/activar`),

  desactivar: ({ periodo_id, lab_id }) =>
    http.patch(`/horarios/catalogo/${periodo_id}/${lab_id}/desactivar`),

  eliminar: ({ periodo_id, lab_id }) =>
    http.delete(`/horarios/catalogo/${periodo_id}/${lab_id}`),

  eliminarHard: ({ periodo_id, lab_id }) =>
    http.delete(`/horarios/catalogo/${periodo_id}/${lab_id}/hard`),

  restore: ({ periodo_id, lab_id }) =>
    http.post(`/horarios/catalogo/${periodo_id}/${lab_id}/restore`),

  pdf: (params) =>
    http.get("/horarios/pdf", {
      params,
      responseType: "blob",
    }),
};

export default http;
