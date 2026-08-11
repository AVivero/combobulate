import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // The scroll-then-set bridge (jump/arrow/activedescendant) is timing-sensitive
  // under real-browser load; a couple of retries absorb transient flake, and a
  // trace captured on the first retry makes any real failure debuggable.
  retries: 2,
  // The virtualized far-jump (Ctrl+Home/End over ~3,300 rows) scrolls the target
  // into the DOM then commits it active; on a loaded CI runner that round-trip can
  // exceed the 5s default before the polled `aria-posinset` settles. Give the
  // polled assertions more headroom so a slow-but-correct jump isn't a false fail.
  expect: { timeout: 10_000 },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5173", trace: "on-first-retry" },
  // Run the suite on two independent engines so the Ariakit bridge is validated
  // beyond a single browser's quirks.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
