import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig, transformWithEsbuild } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

// The `combobulate` alias below resolves straight to the library's own
// source (not a pre-built artifact), so Vite pulls those .ts/.tsx files
// into this same module graph. `react({ jsxImportSource: "@emotion/react" })`
// reconfigures Vite's *project-wide* esbuild JSX handling (not just this
// plugin's own babel pass), so without intervention every .tsx file in the
// project - including the library's own source - would be forced onto
// Emotion's JSX runtime. The library has no dependency on Emotion, so that
// breaks module resolution for `@emotion/react/jsx-runtime` from outside the
// playground's dependency tree.
//
// Fix: transform the aliased library source ourselves, forcing the plain
// `react` JSX runtime, and exclude it from both the React plugin's babel
// pass and Vite's built-in esbuild pass so nothing re-applies the Emotion
// pragma to it.
const librarySrcDir = resolve(here, "../../src");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const librarySrcExclude = new RegExp(`^${escapeRegExp(librarySrcDir)}/`);

function librarySourceJsx(): Plugin {
  return {
    name: "combobulate-library-source-jsx",
    enforce: "pre",
    async transform(code, id) {
      const [filepath] = id.split("?");
      if (!filepath || !librarySrcExclude.test(filepath) || !/\.tsx?$/.test(filepath)) {
        return;
      }
      const result = await transformWithEsbuild(code, filepath, {
        loader: filepath.endsWith(".tsx") ? "tsx" : "ts",
        jsx: "automatic",
        jsxImportSource: "react",
      });
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [
    librarySourceJsx(),
    react({
      jsxImportSource: "@emotion/react",
      babel: { plugins: ["@emotion/babel-plugin"] },
      exclude: [librarySrcExclude],
    }),
  ],
  server: { port: 5173 },
  esbuild: { exclude: [librarySrcExclude] },
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
