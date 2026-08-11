/**
 * Ariakit's framework-agnostic store internals. At `@ariakit/react@~0.4.37` there
 * is no public `@ariakit/core`; the core combobox store lives in these packages,
 * which `@ariakit/react` pulls in transitively. We depend on them directly (and
 * must, so tsup externalizes rather than inlines a second store instance — a
 * duplicate would not share identity with the store `@ariakit/react`'s
 * `<Combobox>` components use). They disclaim semver (breaking changes land in
 * patch/minor), so they are pinned EXACT in package.json (`0.1.10`/`0.1.8`) to
 * match `@ariakit/react`'s own transitive pins. Whenever `@ariakit/react` is
 * bumped, re-verify these two together for dedup — they are load-bearing.
 */
import {
  type ComboboxStore,
  createComboboxStore,
} from "@ariakit/components/combobox/combobox-store";
import { subscribe } from "@ariakit/store";
import { type KeyboardEvent, useSyncExternalStore } from "react";
import { defaultGetSearchText, isSameItem, toChangeValue } from "./item-utils";
import type { CombobulateState, CombobulateStore, UseCombobulateOptions } from "./types";

/**
 * The store handle plus its `_internal` bag. `_internal` carries the live
 * Ariakit combobox store and the resolved config so the hook and primitives
 * (later tasks) can drive Ariakit's `<Combobox>`/`<ComboboxItem>` directly.
 * It is intentionally not re-exported from the barrel.
 */
export type CombobulateStoreInternal<T> = CombobulateStore<T> & {
  _internal: {
    combobox: ComboboxStore;
    config: {
      items: T[];
      getItemId?: (item: T) => string;
      getSearchText: (item: T) => string;
      filterItems?: (items: T[], query: string) => T[];
      itemToInputValue?: (item: T) => string;
      multiple: boolean;
      loading: boolean;
    };
  };
};

/** Ariakit `selectedValue` (string | readonly string[]) as a plain string array. */
function toValueArray(selectedValue: string | readonly string[]): string[] {
  if (Array.isArray(selectedValue)) return [...selectedValue];
  const single = selectedValue as string;
  return single === "" ? [] : [single];
}

/**
 * Build a combobulate store composed over an Ariakit combobox store. The engine
 * truth — open, input `value`, `activeId`, `selectedValue` — lives in the
 * Ariakit store; combobulate's derived, item-shaped fields are mapped back
 * through the config on each read.
 *
 * Called OUTSIDE React (tests, and the hook's initializer), so it never touches
 * Ariakit's React hooks. It reads/writes the Ariakit store's own synchronous
 * `getState`/`setState`, which persist without the store being "set up".
 */
export function createCombobulateStore<T>(
  options: UseCombobulateOptions<T>,
): CombobulateStoreInternal<T> {
  const {
    items,
    getItemId,
    getSearchText = defaultGetSearchText as (item: T) => string,
    filterItems,
    itemToInputValue,
    multiple = false,
    loading = false,
    defaultValue = null,
    onChange,
    onInputChange,
    onOpenChange,
    defaultOpen = false,
  } = options;

  /**
   * Used verbatim (no case-folding): ids differing only in case must not
   * collide. Doubles as the Ariakit option id, so `activeId` === this value.
   */
  const itemValue = (item: T, index: number): string =>
    getItemId ? getItemId(item) : String(index);

  const valueOfItem = (item: T): string => {
    const index = items.findIndex((candidate) => isSameItem(candidate, item, getItemId));
    return itemValue(item, index);
  };

  /** Reverse map value -> item, for turning `selectedValue` back into items. */
  const itemByValue = new Map<string, T>();
  items.forEach((item, index) => {
    itemByValue.set(itemValue(item, index), item);
  });
  const itemsForValues = (values: string[]): T[] => {
    const result: T[] = [];
    for (const value of values) {
      const item = itemByValue.get(value);
      if (item !== undefined) result.push(item);
    }
    return result;
  };

  const seedValues = toValueArray(
    defaultValue == null
      ? []
      : (Array.isArray(defaultValue) ? defaultValue : [defaultValue]).map((item) =>
          valueOfItem(item),
        ),
  );

  const combobox: ComboboxStore = multiple
    ? createComboboxStore({ defaultOpen, defaultSelectedValue: seedValues })
    : createComboboxStore({ defaultOpen, defaultSelectedValue: seedValues[0] ?? "" });

  /**
   * Cache the derived `selectedItems` behind the `selectedValue` reference so
   * repeated `getState()`/`useState` reads return an identity-stable array
   * (Ariakit keeps the same reference until the selection actually changes).
   */
  let cachedSelectedValue: string | readonly string[] | undefined;
  let cachedSelectedItems: T[] = [];
  const selectedItems = (): T[] => {
    const selectedValue = combobox.getState().selectedValue;
    if (selectedValue !== cachedSelectedValue) {
      cachedSelectedValue = selectedValue;
      cachedSelectedItems = itemsForValues(toValueArray(selectedValue));
    }
    return cachedSelectedItems;
  };

  const getState = (): CombobulateState<T> => {
    const state = combobox.getState();
    const activeValue = state.activeId ?? "";
    // Stub: Task 2 fills real filtering. Return the same reference each call so
    // `useState("filteredItems")` stays identity-stable.
    const filteredItems = items;
    const activeIndex =
      activeValue === ""
        ? -1
        : filteredItems.findIndex((item, index) => itemValue(item, index) === activeValue);
    return {
      isOpen: state.open,
      inputValue: state.value,
      activeValue,
      activeIndex,
      selectedItems: selectedItems(),
      filteredItems,
      loading,
      multiple,
    };
  };

  const subscribeToStore = (onStoreChange: () => void): (() => void) => {
    const unsubscribe = subscribe(combobox, null, onStoreChange);
    return () => unsubscribe?.();
  };

  const useState = <K extends keyof CombobulateState<T>>(key: K): CombobulateState<T>[K] => {
    const getSnapshot = () => getState()[key];
    return useSyncExternalStore(subscribeToStore, getSnapshot, getSnapshot);
  };

  const setOpen = (open: boolean): void => {
    combobox.setState("open", open);
    onOpenChange?.(open);
  };

  const setInputValue = (value: string): void => {
    combobox.setState("value", value);
    onInputChange?.(value);
  };

  // `activeId` === `itemValue`, so the active value is set verbatim.
  const setActiveValue = (value: string): void => {
    combobox.setState("activeId", value);
  };

  const select = (item: T): void => {
    const value = valueOfItem(item);
    const current = toValueArray(combobox.getState().selectedValue);
    // Compute the next selection (and its onChange payload) BEFORE mutating, so
    // `onChange` fires exactly once, outside any updater (StrictMode-safe).
    if (multiple) {
      const next = current.includes(value)
        ? current.filter((existing) => existing !== value)
        : [...current, value];
      combobox.setState("selectedValue", next);
      onChange?.(toChangeValue(itemsForValues(next), true));
    } else {
      combobox.setState("selectedValue", value);
      onChange?.(toChangeValue(itemsForValues([value]), false));
    }
  };

  const isSelected = (item: T): boolean =>
    toValueArray(combobox.getState().selectedValue).includes(valueOfItem(item));

  // Stub: Task 3 implements the virtualization-aware jump keys.
  const onInputKeyDown = (_event: KeyboardEvent<HTMLInputElement>): void => {};

  return {
    useState,
    getState,
    setOpen,
    setInputValue,
    setActiveValue,
    select,
    isSelected,
    itemValue,
    onInputKeyDown,
    _internal: {
      combobox,
      config: { items, getItemId, getSearchText, filterItems, itemToInputValue, multiple, loading },
    },
  };
}
