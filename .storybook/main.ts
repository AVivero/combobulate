import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../examples/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  /**
   * Pre-bundle the Ariakit packages (including the deep `@ariakit/components`
   * combobox-store subpath the core imports directly). Vite's dep crawler only
   * discovers that subpath once a story loads, then re-optimizes mid-flight —
   * which serves a 504 "Outdated Optimize Dep" and leaves the story blank in the
   * dev server the e2e suite drives. Listing them here bundles them upfront so
   * the first load is stable. `@floating-ui/react` and `@tanstack/react-virtual`
   * ride along for the same reason.
   */
  async viteFinal(viteConfig) {
    return {
      ...viteConfig,
      optimizeDeps: {
        ...viteConfig.optimizeDeps,
        include: [
          ...(viteConfig.optimizeDeps?.include ?? []),
          "@ariakit/react",
          "@ariakit/store",
          "@ariakit/components/combobox/combobox-store",
          "@floating-ui/react",
          "@tanstack/react-virtual",
        ],
      },
    };
  },
};

export default config;
