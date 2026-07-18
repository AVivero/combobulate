import { useEffect } from "react";
import type { CombobulateApi } from "../index";

const defaultLabel = (item: unknown) => String(item);

/**
 * Demo glue: reflect a single-select choice by filling the input with the
 * chosen item's label — what a normal combobox does. cmdk-headless keeps
 * `inputValue` (search text) separate from `selectedItems` on purpose, so this
 * bridge is the consumer's to wire; the demos show one way.
 *
 * No-op for multi-select (chips carry the selection there; the input stays a
 * search box). `getLabel` must be stable — a module-level function or a
 * memoized one — so the effect fires only when the selected item changes, not
 * on every keystroke.
 */
export function useSelectionInInput<T>(
  api: CombobulateApi<T>,
  getLabel: (item: T) => string = defaultLabel,
) {
  const selected = api.multiple ? undefined : api.selectedItems[0];
  const { setInputValue } = api;
  useEffect(() => {
    if (selected !== undefined) setInputValue(getLabel(selected));
  }, [selected, getLabel, setInputValue]);
}
