import { defineConfig } from "tsup";

export default defineConfig({
  // Object form so the CSS entry's output basename is `styles.css` at the
  // root of `dist/` (matching the `"./styles.css"` package export) instead
  // of tsup mirroring its source path as `dist/presets/styles.css`.
  entry: { index: "src/index.ts", styles: "src/presets/styles.css" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@tanstack/react-virtual"],
});
