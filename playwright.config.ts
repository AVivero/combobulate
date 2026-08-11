import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // The scroll-then-set bridge (jump/arrow/activedescendant) is timing-sensitive
  // under real-browser load; a couple of retries absorb transient flake, and a
  // trace captured on the first retry makes any real failure debuggable.
  retries: 2,
  webServer: {
    command: "bun run storybook",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:6006", trace: "on-first-retry" },
  // Run the suite on two independent engines so the Ariakit bridge is validated
  // beyond a single browser's quirks.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
