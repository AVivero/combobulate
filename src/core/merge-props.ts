type UnknownRecord = Record<string, unknown>;

/**
 * Compose two optional event handlers into one that calls `first` then
 * `second`. If only one is defined, that one is returned unchanged (so a
 * no-op wrapper isn't allocated when there's nothing to compose).
 */
function composeEventHandlers<Args extends unknown[]>(
  first: ((...args: Args) => void) | undefined,
  second: ((...args: Args) => void) | undefined,
): ((...args: Args) => void) | undefined {
  if (!first) return second;
  if (!second) return first;
  return (...args: Args) => {
    first(...args);
    second(...args);
  };
}

/**
 * Merge two prop objects for a single element. For any key whose value is a
 * function in *both* `base` and `overrides` (e.g. `onKeyDown`, `onChange`,
 * `onFocus`), the merged handler calls `base`'s handler first, then
 * `overrides`'s — so, for example, a floating layer's own `onKeyDown`
 * (Escape-to-dismiss) augments rather than clobbers a combobox's own
 * arrow-key/Enter navigation. Non-function values keep plain override
 * semantics: `overrides` wins (e.g. `className`, `placeholder`, `value`).
 */
export function mergeProps<Base extends object, Overrides extends object>(
  base: Base,
  overrides: Overrides,
): Base & Overrides {
  // Named prop types (e.g. `InputHTMLAttributes`) have no index signature, so
  // reading them by dynamic key requires routing through `unknown` first —
  // this is the narrow cast, not a loosening of the public signature above.
  const baseRecord = base as unknown as UnknownRecord;
  const overridesRecord = overrides as unknown as UnknownRecord;

  const merged: UnknownRecord = { ...baseRecord, ...overridesRecord };
  for (const key of Object.keys(baseRecord)) {
    const baseValue = baseRecord[key];
    const overrideValue = overridesRecord[key];
    if (typeof baseValue === "function" && typeof overrideValue === "function") {
      merged[key] = composeEventHandlers(
        baseValue as (...args: unknown[]) => void,
        overrideValue as (...args: unknown[]) => void,
      );
    }
  }
  return merged as unknown as Base & Overrides;
}
