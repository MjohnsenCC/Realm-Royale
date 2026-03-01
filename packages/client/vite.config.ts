import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve shared package to TypeScript source for proper ESM handling
      "@rotmg-lite/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy WebSocket connections to the Colyseus server in dev
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
