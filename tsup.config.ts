import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // react/react-dom are peers; tsup externalizes `dependencies` automatically,
  // so cmdk, @floating-ui/react and @tanstack/react-virtual stay unbundled too.
  external: ["react", "react-dom"],
});
