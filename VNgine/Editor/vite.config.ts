import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_EDITOR_BASE_PATH ?? "/",
  server: { host: "127.0.0.1", port: 5173 },
  resolve: {
    alias: {
      "@vngine/shared": fileURLToPath(new URL("../Shared/src/index.ts", import.meta.url))
    }
  }
});
