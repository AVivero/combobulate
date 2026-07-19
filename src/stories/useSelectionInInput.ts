import { type FocusEvent, type MutableRefObject, useCallback, useEffect } from "react";
import type { CombobulateApi } from "../index";

const defaultLabel = (item: unknown) => String(item);

/**
 * Demo glue: reflect a single-select choice by filling the input with the
 * chosen item's label — what a normal combobox does. cmdk-headless keeps
 * `inputValue` (search text) separate from `selectedItems` on purpose, so this
 * bridge is the consumer's to wire; the demos show one way. No-op for
 * multi-select (chips carry the selection; the input stays a search box).
 *
 * Returns an `onFocus` that selects the committed text so the next keystroke
 * replaces it (the real-combobox "focus to retype" behaviour). If a
 * `committedRef` is passed, it's kept pointed at the current committed label so
 * the caller's filter can tell "showing a selection" from "searching" (see
 * `useDemoCombobox`).
 *
 * `getLabel` must be stable — a module-level or memoized function — so the fill
 * effect fires only when the selected item changes, not on every keystroke.
 */
export function useSelectionInInput<T>(
  api: CombobulateApi<T>,
  getLabel: (item: T) => string = defaultLabel,
  committedRef?: MutableRefObject<string | null>,
) {
  const selected = api.multiple ? undefined : api.selectedItems[0];
  const committed = selected === undefined ? null : getLabel(selected);
  if (committedRef) committedRef.current = committed;

  const { setInputValue } = api;
  useEffect(() => {
    if (committed !== null) setInputValue(committed);
  }, [committed, setInputValue]);

  return useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (committed !== null && event.currentTarget.value === committed) {
        event.currentTarget.select();
      }
    },
    [committed],
  );
}
