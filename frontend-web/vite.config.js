// frontend-web/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Usa variable de entorno para backend (opcional)
const BACKEND = process.env.VITE_BACKEND || "http://localhost:4000";

export default defineConfig({
  plugins: [react()],

  // 🔑 CLAVE para Render
  base: "/",

  // 🔧 SOLO para desarrollo local
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      }
    }
  }
});