import { type FocusEvent, useCallback } from "react";
import { type CombobulateStore, type UseCombobulateOptions, useCombobulate } from "../src/index";

/**
 * Assembles the headless primitives into a real-combobox experience for the
 * demos. The committed-value model (fill on select, show-all for a committed
 * selection, revert on close, highlight on open) is now the library's job —
 * opt in by passing `itemToInputValue`. This hook adds only the one bit the
 * library deliberately leaves to consumers: select-all on focus, so a committed
 * value is ready to be replaced by the next keystroke.
 */
export function useDemoCombobox<T>(options: UseCombobulateOptions<T>): {
  store: CombobulateStore<T>;
  inputProps: { onFocus: (event: FocusEvent<HTMLInputElement>) => void };
} {
  const store = useCombobulate<T>(options);
  const { itemToInputValue, multiple } = options;
  const selectedItems = store.useState("selectedItems");
  const selected = !multiple && itemToInputValue ? selectedItems[0] : undefined;
  const committed = selected === undefined ? null : (itemToInputValue?.(selected) ?? null);

  const onFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (committed !== null && event.currentTarget.value === committed) {
        event.currentTarget.select();
      }
    },
    [committed],
  );

  return { store, inputProps: { onFocus } };
}
