import { type FocusEvent, useRef } from "react";
import {
  type CombobulateApi,
  type UseCombobulateOptions,
  defaultFilterItems,
  defaultGetSearchText,
  useCombobulate,
} from "../index";
import { useSelectionInInput } from "./useSelectionInInput";

type DemoOptions<T> = UseCombobulateOptions<T> & {
  /** Fills the input on single-select. Defaults to `String(item)`. */
  getLabel?: (item: T) => string;
};

/**
 * Assembles the headless primitives into a real-combobox experience for the
 * demos — this is the pattern a consumer would write, gathered in one place:
 *
 * - **Filtering** defaults to the library's normalized "includes" match; pass
 *   `filterItems` to swap in your own (the Fuzzy Search story injects Fuse).
 * - **Fill on select** — a single-select pick fills the input with its label.
 * - **Show, don't re-filter, a committed selection** — while the input still
 *   holds the label of what you picked, it's a display value, not a search, so
 *   reopening shows the whole list instead of an empty "no match".
 * - **Focus to retype** — focusing selects the committed text so a keystroke
 *   replaces it.
 *
 * Returns the `api` plus `inputProps` to spread onto `Combobulate.Input`.
 */
export function useDemoCombobox<T>(options: DemoOptions<T>): {
  api: CombobulateApi<T>;
  inputProps: { onFocus: (event: FocusEvent<HTMLInputElement>) => void };
} {
  const { getLabel, filterItems, getSearchText, ...rest } = options;
  const committedRef = useRef<string | null>(null);

  const baseFilter =
    filterItems ??
    ((items: T[], query: string) =>
      defaultFilterItems(
        items,
        query,
        getSearchText ?? (defaultGetSearchText as (item: T) => string),
      ));

  const api = useCombobulate<T>({
    ...rest,
    getSearchText,
    filterItems: (items, query) =>
      query !== "" && query === committedRef.current ? items : baseFilter(items, query),
  });

  const onFocus = useSelectionInInput(api, getLabel, committedRef);
  return { api, inputProps: { onFocus } };
}
