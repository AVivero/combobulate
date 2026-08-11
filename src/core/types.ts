import type { KeyboardEvent } from "react";

/**
 * Options accepted by {@link useCombobulate}. Deliberately tree-unaware.
 *
 * This hook is **uncontrolled**: selection, input text, and open state are
 * owned internally and surfaced via `onChange`/`onInputChange`/`onOpenChange`
 * callbacks plus `default*` seed values.
 */
export type UseCombobulateOptions<T> = {
  /** Full list of items to search over. */
  items: T[];
  /**
   * The text the built-in filter searches for an item. Only used when
   * `filterItems` is NOT provided: the default filter is a normalized,
   * accent-insensitive substring match over this text. String items search
   * themselves; for objects, point this at the field(s) you want searchable.
   * Read once when the store is created — pass a stable (module-level) function,
   * not an inline closure over changing state; later changes are not picked up.
   */
  getSearchText?: (item: T) => string;
  /**
   * Identity accessor — what makes two items *the same* item. Optional: when
   * omitted, items are identified structurally (by object reference, or by value
   * for primitives), which is correct for stable lists. Provide it when an item's
   * object reference can change while the item stays logically the same — async
   * re-fetches, lists rebuilt each render (`items={raw.map(...)}`), or a
   * `defaultValue` loaded from a different source than `items`; without it, those
   * cases lose the selection. The returned id must be unique and becomes the
   * Ariakit option id (see {@link CombobulateStore.itemValue}). Read once when
   * the store is created; pass a stable (module-level) function.
   */
  getItemId?: (item: T) => string;
  /**
   * Replace the filter entirely — the single door for custom filtering (fuzzy,
   * ranking, multi-field, async-shaped results). Receives the full items and the
   * query and returns the matches, in display order. When omitted, the built-in
   * normalized substring filter runs over `getSearchText(item)`. Read once when
   * the store is created — pass a stable (module-level) function, not an inline
   * closure over changing state; later changes are not picked up.
   */
  filterItems?: (items: T[], query: string) => T[];
  /** Initial selection for the uncontrolled case. */
  defaultValue?: T | T[] | null;
  /** Fired when selection changes. */
  onChange?: (value: T | T[] | null) => void;
  /** Fired synchronously on every input change. */
  onInputChange?: (value: string) => void;
  /** Initial open state for the uncontrolled case. */
  defaultOpen?: boolean;
  /** Fired when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Allow selecting multiple items. Read once when the store is created. */
  multiple?: boolean;
  /** External loading flag for async data. Drives the live-region announcement. */
  loading?: boolean;
  /** Estimated row height in px. Required by TanStack Virtual. Default 32. */
  estimateSize?: (index: number) => number;
  /** Rows to render above/below the viewport. Default 8. */
  overscan?: number;
  /**
   * Single-select only. When set, the combobox adopts the "committed value"
   * model: the input displays the selected item (via this accessor), reopening
   * a selection shows the whole list instead of filtering to it, and an
   * abandoned search reverts to the selection on close. Omit it (the default)
   * and the input stays a pure search box. Ignored when `multiple` is true.
   * Read once when the store is created; pass a stable (module-level)
   * function rather than an inline closure over changing state.
   */
  itemToInputValue?: (item: T) => string;
};

/**
 * Reactive snapshot of a {@link CombobulateStore}. Every field is derived: the
 * engine truth (open/input/active/selection) lives in the internal Ariakit
 * combobox store, and the item-shaped fields are mapped back through the
 * store's config on each read.
 */
export type CombobulateState<T> = {
  isOpen: boolean;
  inputValue: string;
  /** The highlighted item's value string (Ariakit `activeId`), or "" when none. */
  activeValue: string;
  /** Index of {@link CombobulateState.activeValue} in `filteredItems`, or -1. */
  activeIndex: number;
  selectedItems: T[];
  filteredItems: T[];
  loading: boolean;
  multiple: boolean;
};

/**
 * Store handle composed over an Ariakit combobox store. The imperative methods
 * work outside React (they read/write the Ariakit store directly); `useState`
 * is a React hook for components that subscribes to the same store.
 *
 * The internal Ariakit store, virtualizer, and scroll ref are deliberately NOT
 * on this type — they ride on the non-exported `_internal` bag returned by
 * {@link createCombobulateStore}.
 */
export type CombobulateStore<T> = {
  /** React hook: subscribe to a single derived field. */
  useState: <K extends keyof CombobulateState<T>>(key: K) => CombobulateState<T>[K];
  /** Imperative snapshot of the full derived state. */
  getState: () => CombobulateState<T>;
  setOpen: (open: boolean) => void;
  setInputValue: (value: string) => void;
  setActiveValue: (value: string) => void;
  select: (item: T) => void;
  isSelected: (item: T) => boolean;
  /**
   * The item's value string: the caller's `getItemId` (or the positional
   * index), used verbatim — no case-folding, so ids differing only in case do
   * not collide. Doubles as the Ariakit option id.
   */
  itemValue: (item: T) => string;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};
