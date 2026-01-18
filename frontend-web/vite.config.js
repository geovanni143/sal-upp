// frontend-web/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // carga .env y .env.local
  const BACKEND = env.VITE_BACKEND || "http://localhost:4000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
