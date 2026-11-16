import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite con sondeo (polling) activo para reflejar cambios instantáneamente en Docker y Windows
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});
