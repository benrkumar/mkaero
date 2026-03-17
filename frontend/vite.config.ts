import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": "http://localhost:8003",
      "/webhooks": "http://localhost:8003",
    },
  },
  build: {
    outDir: "dist",
  },
});
