import type { Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";

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
  /** Accessor for an item's searchable/display text. */
  getSearchText?: (item: T) => string;
  /**
   * Accessor for an item's stable id. Falls back to the positional index.
   * Ids must be unique — they become cmdk item values (see
   * {@link CombobulateApi.itemValue}).
   */
  getItemId?: (item: T) => string;
  /** Custom filter. Defaults to a normalized substring match. */
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
  /** Allow selecting multiple items. */
  multiple?: boolean;
  /** External loading flag for async data. Drives the live-region announcement. */
  loading?: boolean;
  /** Estimated row height in px. Required by TanStack Virtual. Default 32. */
  estimateSize?: (index: number) => number;
  /** Rows to render above/below the viewport. Default 8. */
  overscan?: number;
};

/** Public API returned by {@link useCombobulate}. */
export type CombobulateApi<T> = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (next: boolean) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  filteredItems: T[];
  /** cmdk's highlighted item value (the controlled `value` on `<Command>`). */
  activeValue: string;
  setActiveValue: (value: string) => void;
  /** Index of {@link CombobulateApi.activeValue} in `filteredItems`, or -1. */
  activeIndex: number;
  selectedItems: T[];
  select: (item: T) => void;
  /** Replace the entire selection in one update. Fires `onChange` once. */
  setSelectedItems: (items: T[]) => void;
  isSelected: (item: T) => boolean;
  /** Resolve an item's logical id (caller's `getItemId`, else the index). */
  getItemId: (item: T, index: number) => string;
  /**
   * The item's cmdk `value` string: the logical id, used verbatim.
   *
   * cmdk emits `value` back through `onValueChange` unchanged — no
   * case-folding, no trimming (pinned by `cmdk-behavior.test.tsx`), so the
   * round-trip through `valueToIndex` needs no normalization. Deliberately
   * NOT lowercased: that would make ids differing only in case collide
   * silently in the map.
   */
  itemValue: (item: T, index: number) => string;
  /** Screen-reader announcement string (result count / no-results / loading). */
  announcement: string;
  /** External loading flag, forwarded so primitives can render loading states. */
  loading: boolean;
  /** Whether multi-select is enabled; drives `aria-checked` on options. */
  multiple: boolean;
  /** Internal virtualizer. Exposed for the primitives, not part of the API contract. */
  virtualizer: Virtualizer<HTMLElement, Element>;
  /** Ref for the virtualized scroll container. */
  scrollRef: RefObject<HTMLElement | null>;
};
