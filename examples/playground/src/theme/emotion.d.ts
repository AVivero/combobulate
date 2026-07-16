import "@emotion/react";
import type { EmotionTheme } from "./emotion-theme";

/**
 * Emotion's own `Theme` type is `{}` by default; augmenting it with the
 * shape of `emotionTheme` is what lets `ThemeProvider theme={emotionTheme}`
 * and every `css={(theme) => ...}` callback see typed `color`/`shadow`/
 * `radius` fields instead of an empty object. Standard Emotion + TypeScript
 * setup (see emotion.sh/docs/typescript#define-a-theme) — this file has no
 * runtime output, it only augments the module's ambient type.
 */
declare module "@emotion/react" {
  export interface Theme extends EmotionTheme {}
}
