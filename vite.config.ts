import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rendererPort = Number(process.env.GITPILOT_RENDERER_PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  // Electron loads the packaged renderer through file://, so assets must be relative.
  base: "./",
  server: {
    host: "127.0.0.1",
    port: rendererPort,
    strictPort: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
