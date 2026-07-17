import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem } from "./item-utils";
import type { CombobulateApi, UseCombobulateOptions } from "./types";

/** Convert the selected items to the value type expected by `onChange`. */
function toChangeValue<T>(items: T[], multiple: boolean): T | T[] | null {
  return multiple ? items : (items[0] ?? null);
}

/**
 * Orchestration hook for a cmdk-backed, virtualized combobox.
 *
 * cmdk owns arrow-key navigation, option roles, and the highlighted item
 * (surfaced here as `activeValue`/`setActiveValue`, wired to `<Command>`'s
 * controlled `value`). This hook owns everything cmdk does not: filtering,
 * selection, input/open state, the virtualizer, and the bridge that keeps the
 * highlighted row mounted so cmdk's `aria-activedescendant` always resolves.
 */
export function useCombobulate<T>(options: UseCombobulateOptions<T>): CombobulateApi<T> {
  const {
    items,
    getSearchText = defaultGetSearchText as (item: T) => string,
    getItemId,
    filterItems,
    multiple = false,
    onChange,
    onInputChange,
    onOpenChange,
    defaultOpen = false,
    defaultValue = null,
    loading = false,
    estimateSize = () => 32,
    overscan = 8,
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeValue, setActiveValue] = useState("");
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  const filteredItems = useMemo(() => {
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText]);

  const getItemIdCb = useCallback(
    (item: T, index: number) => (getItemId ? getItemId(item) : String(index)),
    [getItemId],
  );

  // Used verbatim: cmdk round-trips `value` through `onValueChange` unchanged
  // (pinned by cmdk-behavior.test.tsx), so no normalization is needed — and
  // lowercasing would make ids differing only in case collide in the map below.
  const itemValue = useCallback(
    (item: T, index: number) => getItemIdCb(item, index),
    [getItemIdCb],
  );

  /** Reverse index for the bridge: cmdk's value string -> position in `filteredItems`. */
  const valueToIndex = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item, index) => {
      map.set(itemValue(item, index), index);
    });
    return map;
  }, [filteredItems, itemValue]);

  const activeIndex = valueToIndex.get(activeValue) ?? -1;

  const scrollRef = useRef<HTMLElement | null>(null);
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  /**
   * The bridge. cmdk moves the highlight among *mounted* rows; scrolling the
   * new active index into view mounts it (and its neighbours), so the next
   * keystroke always has a real row to move to and `aria-activedescendant`
   * always points at a node that exists.
   */
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [isOpen, activeIndex, virtualizer]);

  const setOpen = useCallback(
    (next: boolean) => {
      setIsOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const setInputValue = useCallback(
    (value: string) => {
      setInputValueState(value);
      onInputChange?.(value);
    },
    [onInputChange],
  );

  // `onChange` fires OUTSIDE the state updater. React invokes updater
  // functions twice in StrictMode, so a side effect inside one would fire the
  // consumer's callback twice in dev (StrictMode is on by default in Next.js
  // and every Vite React template). Mirrors `setSelectedItems` below.
  const select = useCallback(
    (item: T) => {
      const next = multiple
        ? selectedItems.some((i) => isSameItem(i, item, getItemId))
          ? selectedItems.filter((i) => !isSameItem(i, item, getItemId))
          : [...selectedItems, item]
        : [item];
      setSelectedItemsState(next);
      onChange?.(toChangeValue(next, multiple));
    },
    [multiple, onChange, getItemId, selectedItems],
  );

  const setSelectedItems = useCallback(
    (next: T[]) => {
      const clamped = multiple ? [...next] : next.slice(0, 1);
      setSelectedItemsState(clamped);
      onChange?.(toChangeValue(clamped, multiple));
    },
    [multiple, onChange],
  );

  const isSelected = useCallback(
    (item: T) => selectedItems.some((i) => isSameItem(i, item, getItemId)),
    [selectedItems, getItemId],
  );

  // Closed is checked first: a closed combobox announces nothing, even while
  // `loading` — its live region is not on screen to narrate.
  const announcement = !isOpen
    ? ""
    : loading
      ? "Loading…"
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;

  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    setOpen,
    inputValue,
    setInputValue,
    filteredItems,
    activeValue,
    setActiveValue,
    activeIndex,
    selectedItems,
    select,
    setSelectedItems,
    isSelected,
    getItemId: getItemIdCb,
    itemValue,
    announcement,
    loading,
    multiple,
    virtualizer,
    scrollRef,
  };
}
