/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // Served from https://<user>.github.io/frap-analyzer/ on GitHub Pages.
  base: command === "build" ? "/frap-analyzer/" : "/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
