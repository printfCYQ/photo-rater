import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Detect whether we're running under Tauri (`tauri dev` / `tauri build`)
// vs plain Vite (`pnpm dev` for browser debugging).
// TAURI_DEV_HOST is set for mobile/custom-host scenarios.
// TAURI_ENV_PLATFORM is set by Tauri v2 CLI for ALL dev/build runs.
const isTauri = !!host || !!process.env.TAURI_ENV_PLATFORM;
const mockAlias = isTauri
  ? {}
  : {
      "@tauri-apps/api/core": path.resolve(__dirname, "src/mock/tauri-core.ts"),
      "@tauri-apps/api/event": path.resolve(__dirname, "src/mock/tauri-event.ts"),
      "@tauri-apps/api/window": path.resolve(__dirname, "src/mock/tauri-window.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(__dirname, "src/mock/tauri-dialog.ts"),
    };

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: mockAlias,
  },
}));
