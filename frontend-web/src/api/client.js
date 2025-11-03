// src/api/client.js
import axios from "axios";
import { getToken } from "../state/auth";

// ===============================
// 🔧 Configuración del cliente API
// ===============================
export const api = axios.create({
  // En desarrollo usa el proxy de Vite ("/api"),
  // en producción puedes definir VITE_API_URL en el .env
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
});

// ==========================================
// 🧩 Interceptor para adjuntar token JWT
// ==========================================
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
