import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem, toChangeValue } from "./item-utils";
import { PAGE_SIZE, nextIndex } from "./navigation";
import type { CombobulateApi, UseCombobulateOptions } from "./types";

/**
 * Orchestration hook for a cmdk-backed, virtualized combobox.
 *
 * cmdk still supplies option roles and reflects the highlighted item
 * (surfaced here as `activeValue`/`setActiveValue`, wired to `<Command>`'s
 * controlled `value`), but combobulate — not cmdk — owns keyboard
 * navigation: `onInputKeyDown` computes target indices over the FULL
 * filtered list (see `./navigation`'s `nextIndex`), not just cmdk's mounted
 * window. This hook owns everything else besides: filtering, selection,
 * input/open state, the virtualizer, and the scroll-then-set bridge that
 * mounts a jump's target row before handing cmdk the new highlight.
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
    itemToInputValue,
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeValue, setActiveValue] = useState("");
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  // Committed-value model (single-select, opt-in via `itemToInputValue`).
  // `committedValue` is what the input shows for the current selection;
  // `isShowingSelection` means the input is displaying that selection rather
  // than an active search query.
  const committedValue =
    itemToInputValue && !multiple && selectedItems[0] !== undefined
      ? itemToInputValue(selectedItems[0])
      : "";
  const isShowingSelection = committedValue !== "" && inputValue === committedValue;

  const filteredItems = useMemo(() => {
    // While the input still shows the committed selection it's a display value,
    // not a search — show the whole list instead of filtering to it.
    if (isShowingSelection) return items;
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText, isShowingSelection]);

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

  // Highlight the committed selection when the list opens, so it's visible and
  // scrolled into view through the bridge above. Keyed on `isOpen` going true;
  // no-op for a plain search (isShowingSelection false).
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened || !isShowingSelection) return;
    const selected = selectedItems[0];
    if (selected === undefined) return;
    const index = filteredItems.indexOf(selected);
    if (index >= 0) setActiveValue(itemValue(selected, index));
  }, [isOpen, isShowingSelection, selectedItems, filteredItems, itemValue]);

  const setOpen = useCallback(
    (next: boolean) => {
      // Revert-on-close (committed-value model): if the user typed a search but
      // didn't pick, restore the input to the committed selection (or "" if
      // none) on close. Raw setter so `onInputChange` does not fire. A clean
      // input (already equal to the committed value, e.g. right after a
      // fill-on-select) is left untouched, so close-on-select never double-handles.
      if (!next && itemToInputValue && !multiple && inputValue !== committedValue) {
        setInputValueState(committedValue);
      }
      setIsOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, itemToInputValue, multiple, inputValue, committedValue],
  );

  const setInputValue = useCallback(
    (value: string) => {
      setInputValueState(value);
      onInputChange?.(value);
      // Committed-value model: the input represents the selection, so clearing
      // it to empty means "nothing selected" — drop the selection. Single-select
      // only (multi-select keeps its chips). This runs only on user edits: the
      // programmatic fill/revert use the raw `setInputValueState`, not this.
      if (value === "" && itemToInputValue && !multiple && selectedItems.length > 0) {
        setSelectedItemsState([]);
        onChange?.(toChangeValue([], multiple));
      }
    },
    [onInputChange, itemToInputValue, multiple, selectedItems, onChange],
  );

  // `onChange` fires OUTSIDE the state updater. React invokes updater
  // functions twice in StrictMode, so a side effect inside one would fire the
  // consumer's callback twice in dev (StrictMode is on by default in Next.js
  // and every Vite React template).
  //
  // Reads render-scoped `selectedItems` rather than the updater's `prev`, so
  // it is intended to be called ONCE PER USER EVENT — two `select()` calls
  // batched in the same tick would drop the first.
  const select = useCallback(
    (item: T) => {
      const next = multiple
        ? selectedItems.some((i) => isSameItem(i, item, getItemId))
          ? selectedItems.filter((i) => !isSameItem(i, item, getItemId))
          : [...selectedItems, item]
        : [item];
      setSelectedItemsState(next);
      // Fill-on-select (committed-value model): show the pick in the input, via
      // the RAW setter so `onInputChange` does NOT fire — this is a programmatic
      // change, not user typing, and a remote-search consumer must not re-fetch
      // for the label.
      if (itemToInputValue && !multiple) setInputValueState(itemToInputValue(item));
      onChange?.(toChangeValue(next, multiple));
    },
    [multiple, onChange, getItemId, selectedItems, itemToInputValue],
  );

  const isSelected = useCallback(
    (item: T) => selectedItems.some((i) => isSameItem(i, item, getItemId)),
    [selectedItems, getItemId],
  );

  const filteredRef = useRef(filteredItems);
  filteredRef.current = filteredItems;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  /**
   * The scroll-then-set bridge. cmdk (and, once Ariakit lands, Ariakit's
   * `activeId`) only highlights *mounted* rows, so a jump target outside the
   * current virtualized window has to be scrolled into mount BEFORE we can
   * commit it as the active value. Holds the target index between "we asked
   * the virtualizer to scroll there" and "the row actually mounted" (see the
   * effect below); `null` when no jump is pending.
   */
  const pendingActiveRef = useRef<number | null>(null);

  /**
   * Make `target` (an index into the full filtered list) the active item.
   * If it's already within the virtualizer's current mounted window, commit
   * immediately; otherwise scroll it into view and defer the commit to the
   * mount-resolving effect below, since `scrollToIndex` does not mount the
   * row synchronously (react-virtual widens its window in response to its
   * own scroll handling, not inside this call).
   */
  const requestActive = useCallback(
    (target: number) => {
      const item = filteredRef.current[target];
      if (item === undefined) return;
      const mounted = virtualizer.getVirtualItems().some((row) => row.index === target);
      if (mounted) {
        setActiveValue(itemValue(item, target));
        return;
      }
      virtualizer.scrollToIndex(target);
      pendingActiveRef.current = target;
    },
    [virtualizer, itemValue],
  );

  // Resolves a pending jump once its target row mounts. Re-checked whenever
  // the mounted window changes; a no-op whenever nothing is pending.
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const target = pendingActiveRef.current;
    if (target === null) return;
    if (!virtualItems.some((row) => row.index === target)) return;
    const item = filteredRef.current[target];
    if (item === undefined) return;
    setActiveValue(itemValue(item, target));
    pendingActiveRef.current = null;
  }, [virtualItems, itemValue]);

  /**
   * combobulate — not cmdk — owns keyboard navigation, computing target
   * indices over the FULL filtered list (see `./navigation`'s `nextIndex`),
   * not just cmdk's mounted window. A `null` target means the key isn't
   * ours (e.g. bare Home/End move the caret); we return without touching
   * the event, leaving it to cmdk/the browser.
   */
  const onInputKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = nextIndex(activeIndexRef.current, event, {
        count: filteredRef.current.length,
        page: PAGE_SIZE,
      });
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      requestActive(target);
    },
    [requestActive],
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
    isSelected,
    itemValue,
    announcement,
    loading,
    multiple,
    virtualizer,
    scrollRef,
  };
}
