// frontend-web/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Usa variable de entorno para backend (opcional)
const BACKEND = process.env.VITE_BACKEND || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
