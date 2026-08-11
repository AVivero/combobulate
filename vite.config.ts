import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Dev/preview server for the examples app (the library ships no styles; this
 * app is not published). `optimizeDeps.include` pre-bundles the Ariakit
 * packages — including the deep combobox-store subpath `src/core` imports —
 * so Vite doesn't re-optimize mid-load and 504 the page the e2e suite drives
 * (carried over from the old Storybook config).
 */
export default defineConfig({
  root: "examples",
  server: { port: 5173 },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      "@ariakit/react",
      "@ariakit/store",
      "@ariakit/components/combobox/combobox-store",
      "@floating-ui/react",
      "@tanstack/react-virtual",
    ],
  },
});
