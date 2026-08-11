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
import type { Virtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, type RefObject, useSyncExternalStore } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem, toChangeValue } from "./item-utils";
import { PAGE_SIZE, nextIndex } from "./navigation";
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
    /**
     * Committed-value model (single-select, opt-in via `itemToInputValue`):
     * if the input was edited away from the committed selection's display
     * value and not re-committed by a new selection, restore it. `setOpen`
     * calls this synchronously on `open -> false`. Exposed so a later task's
     * effect (e.g. closing via an outside interaction that bypasses `setOpen`)
     * can call it too. No-op when the committed-value model isn't active.
     */
    commitOrRevert: () => void;
    /**
     * The scroll-then-set bridge target of `onInputKeyDown`'s navigation math
     * (see `./navigation`'s `nextIndex`): make `target` (an index into
     * `filteredItems`) the active item. The default here is a safe, immediate
     * `setActiveId` — correct whenever `target` is already mounted (or there
     * is no virtualized window at all, e.g. this store used headless in a
     * test). The hook (`useCombobulate`) overwrites this field with the real
     * bridge: scroll unmounted targets into view first, deferring the
     * `setActiveId` until the target's row actually mounts. Mutable (not
     * readonly) so that override can happen after the store is created.
     */
    requestActive: (target: number) => void;
    /**
     * The virtualizer and its scroll container ref. Created in React by the
     * hook (they can't exist outside it) and injected here so the `List`
     * primitive can drive the virtual window from the store handle alone.
     * `null`/empty until the hook injects them (e.g. a headless store).
     */
    virtualizer: Virtualizer<HTMLElement, Element> | null;
    scrollRef: RefObject<HTMLElement | null>;
    /**
     * Push changed `items`/`loading` props into the store. `createCombobulateStore`
     * captures the initial values, so the hook calls these when the consumer
     * passes new ones. Both notify subscribers (a plain items/loading change
     * touches no Ariakit state, so it wouldn't otherwise re-render React), and
     * `setItems` rebuilds the value->item map and busts the filter cache.
     */
    setItems: (items: T[]) => void;
    setLoading: (loading: boolean) => void;
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
    getItemId,
    getSearchText = defaultGetSearchText as (item: T) => string,
    filterItems,
    itemToInputValue,
    multiple = false,
    defaultValue = null,
    onChange,
    onInputChange,
    onOpenChange,
    defaultOpen = false,
  } = options;

  /**
   * `items`/`loading` are mutable: the hook pushes changed props in via
   * `_internal.setItems`/`setLoading` (see below), so every derivation reads
   * these current values rather than the captured initial ones.
   */
  let currentItems = options.items;
  let currentLoading = options.loading ?? false;

  /** Notified on items/loading changes (which touch no Ariakit state). */
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of listeners) listener();
  };

  /**
   * Stable fallback ids when the consumer doesn't supply `getItemId`. Keyed by
   * object REFERENCE (WeakMap) or primitive VALUE (Map) so an item keeps the same
   * id for the store's lifetime, independent of its position. A positional index
   * would shift as the list is filtered/reordered — and since the rendered option
   * used its FILTERED index while the store mapped values by the UNFILTERED index,
   * the same id string could denote different items in different filter states,
   * desyncing selection and the active highlight. Reference/value keys remove that
   * ambiguity entirely. (An async re-fetch that returns fresh object references
   * still needs `getItemId` to be recognised as the same item — nothing can span
   * a new reference without an id accessor.)
   */
  const objectIds = new WeakMap<object, string>();
  const primitiveIds = new Map<unknown, string>();
  let fallbackCounter = 0;
  const fallbackId = (item: T): string => {
    if (item !== null && (typeof item === "object" || typeof item === "function")) {
      const obj = item as object;
      const existing = objectIds.get(obj);
      if (existing !== undefined) return existing;
      const id = `cbl-${fallbackCounter++}`;
      objectIds.set(obj, id);
      return id;
    }
    const existing = primitiveIds.get(item);
    if (existing !== undefined) return existing;
    const id = `cbl-${fallbackCounter++}`;
    primitiveIds.set(item, id);
    return id;
  };

  // The option's stable value/id. Doubles as the Ariakit option id, so
  // `activeId` === this value. Independent of position (see `fallbackId`).
  const itemValue = (item: T): string => (getItemId ? getItemId(item) : fallbackId(item));
  const valueOfItem = itemValue;

  /** Reverse map value -> item, for turning `selectedValue` back into items. */
  const buildItemByValue = (list: T[]): Map<string, T> => {
    const map = new Map<string, T>();
    for (const item of list) map.set(itemValue(item), item);
    return map;
  };
  let itemByValue = buildItemByValue(currentItems);
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

  /**
   * The committed-value model (single-select, opt-in via `itemToInputValue`):
   * what the input should show for the current selection, or "" when the
   * model isn't active or nothing is selected.
   */
  const committedValue = (): string => {
    const selected = selectedItems();
    return itemToInputValue && !multiple && selected[0] !== undefined
      ? itemToInputValue(selected[0])
      : "";
  };

  /**
   * Cache `filteredItems` behind (input value, `selectedItems` reference) so
   * repeated `getState()`/`useState` reads return an identity-stable array
   * when neither input has changed — required for `useSyncExternalStore`
   * (a fresh array reference on every call would loop it).
   */
  let cachedFilterValue: string | undefined;
  let cachedFilterSelectedItems: T[] | undefined;
  let cachedFilteredItems: T[] = currentItems;
  const filteredItems = (): T[] => {
    const value = combobox.getState().value;
    const selected = selectedItems();
    if (value === cachedFilterValue && selected === cachedFilterSelectedItems) {
      return cachedFilteredItems;
    }
    cachedFilterValue = value;
    cachedFilterSelectedItems = selected;
    const committed = committedValue();
    // While the input still shows the committed selection it's a display
    // value, not a search — show the whole list instead of filtering to it.
    const isShowingSelection = committed !== "" && value === committed;
    cachedFilteredItems = isShowingSelection
      ? currentItems
      : filterItems
        ? filterItems(currentItems, value)
        : defaultFilterItems(currentItems, value, getSearchText);
    return cachedFilteredItems;
  };

  const getState = (): CombobulateState<T> => {
    const state = combobox.getState();
    const activeValue = state.activeId ?? "";
    const filteredItemsSnapshot = filteredItems();
    const activeIndex =
      activeValue === ""
        ? -1
        : filteredItemsSnapshot.findIndex((item) => itemValue(item) === activeValue);
    return {
      isOpen: state.open,
      inputValue: state.value,
      activeValue,
      activeIndex,
      selectedItems: selectedItems(),
      filteredItems: filteredItemsSnapshot,
      loading: currentLoading,
      multiple,
    };
  };

  const subscribeToStore = (onStoreChange: () => void): (() => void) => {
    // Subscribe to BOTH the Ariakit store (open/input/active/selection) and
    // our local emitter (items/loading), so a change on either re-renders.
    const unsubscribe = subscribe(combobox, null, onStoreChange);
    listeners.add(onStoreChange);
    return () => {
      unsubscribe?.();
      listeners.delete(onStoreChange);
    };
  };

  const useState = <K extends keyof CombobulateState<T>>(key: K): CombobulateState<T>[K] => {
    const getSnapshot = () => getState()[key];
    return useSyncExternalStore(subscribeToStore, getSnapshot, getSnapshot);
  };

  /**
   * Revert-on-close (committed-value model): if the user typed a search but
   * didn't pick, restore the input to the committed selection (or "" if none).
   * Raw setter (`combobox.setState` directly, not `setInputValue`), so
   * `onInputChange` does NOT fire — this is a programmatic change, not user
   * typing. A clean input (already equal to the committed value, e.g. right
   * after a fill-on-select) is left untouched, so close-on-select never
   * double-handles. No-op when the committed-value model isn't active.
   */
  const commitOrRevert = (): void => {
    if (!itemToInputValue || multiple) return;
    const committed = committedValue();
    if (combobox.getState().value !== committed) {
      combobox.setState("value", committed);
    }
  };

  const setOpen = (open: boolean): void => {
    // Only act on a genuine transition: blur + closeOnSelect can both drive
    // `setOpen(false)` for the same close, and a consumer mirroring open
    // state via `onOpenChange` must not see a duplicate call with no
    // intervening open. Guarding here also protects revert-on-close below —
    // it must fire once per real open -> false transition, not once per call.
    if (combobox.getState().open === open) return;
    if (!open) commitOrRevert();
    combobox.setState("open", open);
    onOpenChange?.(open);
  };

  const setInputValue = (value: string): void => {
    combobox.setState("value", value);
    onInputChange?.(value);
    // Committed-value model: the input represents the selection, so clearing
    // it to empty means "nothing selected" — drop the selection. Single-select
    // only (multi-select keeps its chips). This runs only on user edits: the
    // programmatic fill/revert use the raw `combobox.setState`, not this.
    if (value === "" && itemToInputValue && !multiple && selectedItems().length > 0) {
      combobox.setState("selectedValue", "");
      onChange?.(toChangeValue([], multiple));
    }
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
      // Fill-on-select (committed-value model): show the pick in the input,
      // via the raw setter so `onInputChange` does NOT fire — this is a
      // programmatic change, not user typing, and a remote-search consumer
      // must not re-fetch for the label. Written BEFORE `onChange` fires (like
      // `setInputValue`'s clear-to-unselect branch) so a consumer reading
      // `getState().inputValue` synchronously inside `onChange` sees the fill.
      if (itemToInputValue) combobox.setState("value", itemToInputValue(item));
      onChange?.(toChangeValue(itemsForValues([value]), false));
    }
  };

  const isSelected = (item: T): boolean =>
    toValueArray(combobox.getState().selectedValue).includes(valueOfItem(item));

  /**
   * `_internal` is built as a standalone, mutable object (not inlined into
   * the return statement) so `requestActive` can be overwritten in place —
   * `onInputKeyDown` below closes over this exact object and always reads
   * its CURRENT `requestActive`, so a later override (the hook's real
   * scroll-then-set bridge) takes effect without re-creating the store.
   */
  const internal: CombobulateStoreInternal<T>["_internal"] = {
    combobox,
    config: {
      items: currentItems,
      getItemId,
      getSearchText,
      filterItems,
      itemToInputValue,
      multiple,
      loading: currentLoading,
    },
    commitOrRevert,
    // Safe default: jump straight to `target`, no virtualized window to wait
    // on. Correct standalone (this store used headlessly, e.g. in tests) and
    // whenever `target` is already mounted.
    requestActive: (target: number): void => {
      const item = filteredItems()[target];
      if (item === undefined) return;
      combobox.setState("activeId", itemValue(item));
    },
    // Injected by the hook (see `useCombobulate`); null/empty headlessly.
    virtualizer: null,
    scrollRef: { current: null },
    setItems: (next: T[]): void => {
      if (next === currentItems) return;
      /**
       * Compare by CONTENT, not reference: a consumer that passes a fresh
       * inline `items` array on every render must not trigger a re-render each
       * time (that would loop through the hook's sync effect). Adopt the new
       * reference regardless so the cheap `===` fast-path holds next time, but
       * only rebuild + notify when the contents actually changed.
       */
      const sameContent =
        next.length === currentItems.length &&
        next.every((item, index) => item === currentItems[index]);
      currentItems = next;
      if (sameContent) return;
      internal.config.items = next;
      itemByValue = buildItemByValue(next);
      // The item universe changed: force the derived caches to recompute.
      cachedFilterValue = undefined;
      cachedFilterSelectedItems = undefined;
      cachedSelectedValue = undefined;
      emit();
    },
    setLoading: (next: boolean): void => {
      if (next === currentLoading) return;
      currentLoading = next;
      internal.config.loading = next;
      emit();
    },
  };

  /**
   * combobulate owns ALL keyboard navigation over the full filtered list
   * (not just Ariakit's mounted/virtualized window) — see `./navigation`'s
   * `nextIndex` for the exact key ownership. A `null` target means the key
   * isn't ours (e.g. bare Home/End move the caret); we return without
   * touching the event, letting the browser/Ariakit handle it.
   */
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const state = getState();
    const target = nextIndex(state.activeIndex, event, {
      count: state.filteredItems.length,
      page: PAGE_SIZE,
    });
    if (target === null) return;
    event.preventDefault();
    event.stopPropagation();
    internal.requestActive(target);
  };

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
    _internal: internal,
  };
}
