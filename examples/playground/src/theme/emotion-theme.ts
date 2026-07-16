export const emotionTheme = {
  color: {
    bg: "var(--cbl-bg)",
    surface: "var(--cbl-surface)",
    text: "var(--cbl-text)",
    muted: "var(--cbl-text-muted)",
    border: "var(--cbl-border)",
    accent: "var(--cbl-accent)",
    accentContrast: "var(--cbl-accent-contrast)",
  },
  shadow: "var(--cbl-shadow)",
  radius: "var(--cbl-radius)",
} as const;
export type EmotionTheme = typeof emotionTheme;
