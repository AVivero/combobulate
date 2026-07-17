import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem } from "./item-utils";
import type { CombobulateApi, UseCombobulateOptions } from "./types";

/** Convert the selected items to the value type expected by `onChange`. */
function toChangeValue<T>(items: T[], multiple: boolean): T | T[] | null {
  return multiple ? items : (items[0] ?? null);
}

/** Rows moved per PageUp/PageDown. A fixed page keeps the jump predictable
 *  across variable-height rows, where a measured "viewport of rows" would not. */
const PAGE_SIZE = 10;

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
  //
  // Reads render-scoped `selectedItems` rather than the updater's `prev`, so
  // it is intended to be called ONCE PER USER EVENT — two `select()` calls
  // batched in the same tick would drop the first. A caller that needs to
  // batch several changes at once should use `setSelectedItems` instead,
  // which takes the whole array.
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

  const filteredRef = useRef(filteredItems);
  filteredRef.current = filteredItems;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const rows = filteredRef.current;
      if (rows.length === 0) return;
      const current = activeIndexRef.current;
      const last = rows.length - 1;

      let target: number | null = null;
      if (event.key === "Home") target = 0;
      else if (event.key === "End") target = last;
      else if (event.key === "PageDown")
        target = Math.min((current < 0 ? 0 : current) + PAGE_SIZE, last);
      else if (event.key === "PageUp")
        target = Math.max((current < 0 ? 0 : current) - PAGE_SIZE, 0);
      if (target === null) return;

      const item = rows[target];
      if (item === undefined) return;

      // cmdk binds Home/End on the <Command> root and would otherwise move the
      // highlight to the first/last *mounted* row. Our handler sits on the
      // input, which fires first, so stopping propagation preempts it.
      event.preventDefault();
      event.stopPropagation();

      // Scroll first so the target row mounts, then hand cmdk the value: once
      // the row is in the DOM cmdk resolves it through its normal controlled
      // `value` path and re-points aria-activedescendant at it.
      virtualizer.scrollToIndex(target, { align: "center" });
      setActiveValue(itemValue(item, target));
    },
    [virtualizer, itemValue],
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
    onInputKeyDown,
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
