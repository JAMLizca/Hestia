import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// El backend FastAPI no tiene CORS configurado, así que en desarrollo
// Vite reenvía /api/v1 al servidor de la API (mismo origen para el navegador).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/v1": {
          target: env.VITE_BACKEND_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
