import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    alias: [
      {
        find: "combobulate/styles.css",
        replacement: resolve(here, "../../src/presets/styles.css"),
      },
      { find: "combobulate", replacement: resolve(here, "../../src/index.ts") },
    ],
    dedupe: ["react", "react-dom"],
  },
});
