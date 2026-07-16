import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--cbl-bg)",
        surface: "var(--cbl-surface)",
        text: "var(--cbl-text)",
        muted: "var(--cbl-text-muted)",
        border: "var(--cbl-border)",
        accent: "var(--cbl-accent)",
        "accent-contrast": "var(--cbl-accent-contrast)",
      },
      borderRadius: { token: "var(--cbl-radius)" },
      boxShadow: { token: "var(--cbl-shadow)" },
    },
  },
} satisfies Config;
