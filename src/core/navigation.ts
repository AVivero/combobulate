/**
 * The subset of a keyboard event `nextIndex` needs. Structurally compatible
 * with React's `KeyboardEvent`, so a real event can be passed straight
 * through without construction at the call site.
 */
export type NavKey = { key: string; ctrlKey: boolean; metaKey: boolean };

/** Rows moved per PageUp/PageDown. A fixed page keeps the jump predictable
 *  across variable-height rows, where a measured "viewport of rows" would not. */
export const PAGE_SIZE = 10;

/**
 * Pure target-index math for combobulate-owned keyboard navigation over the
 * full filtered list (not just the mounted/virtualized window). Total and
 * side-effect-free: given the current active index and a key, returns the
 * index navigation should land on, or `null` if the key isn't ours to own
 * (the browser/Ariakit handle it instead — e.g. bare Home/End move the caret).
 *
 * - ArrowDown/ArrowUp: step by one, clamped to the list; `-1` (nothing
 *   active) steps to the first item on ArrowDown.
 * - PageDown/PageUp: step by `opts.page`, clamped.
 * - Ctrl/Cmd+Home -> first item, Ctrl/Cmd+End -> last item. Bare Home/End are
 *   NOT owned (they move the caret), so they return `null`.
 * - Anything else -> `null`.
 * - An empty list (`count === 0`) owns nothing.
 */
export function nextIndex(
  current: number,
  key: NavKey,
  opts: { count: number; page: number },
): number | null {
  const { count, page } = opts;
  if (count === 0) return null;
  const last = count - 1;
  const from = current < 0 ? 0 : current;

  switch (key.key) {
    case "ArrowDown":
      return Math.min(last, current + 1);
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "PageDown":
      return Math.min(last, from + page);
    case "PageUp":
      return Math.max(0, from - page);
    case "Home":
      return key.ctrlKey || key.metaKey ? 0 : null;
    case "End":
      return key.ctrlKey || key.metaKey ? last : null;
    default:
      return null;
  }
}
