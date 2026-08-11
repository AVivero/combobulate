import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Client-only library (hooks/DOM/Ariakit). Emit a "use client" directive at the
  // top of both bundles so importing from a React Server Component (Next.js App
  // Router / RSC) doesn't throw. tsup strips upstream directives when re-bundling,
  // so we re-assert it here.
  banner: { js: '"use client";' },
  // react/react-dom are peers; tsup externalizes `dependencies` automatically, so
  // @ariakit/*, @floating-ui/react and @tanstack/react-virtual stay unbundled too.
  external: ["react", "react-dom"],
});
