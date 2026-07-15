import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-bundle Phaser to avoid slow cold-start in dev
  optimizeDeps: {
    include: ["phaser"],
  },
  server: {
    port: 5173,
    host: "0.0.0.0",   // Listen on all interfaces — accessible via LAN IP
  },
});
