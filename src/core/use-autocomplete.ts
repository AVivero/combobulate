import { useCallback, useId, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem, resolveItemId } from "./item-utils";
import { createPropGetters } from "./prop-getters";
import type { AutocompleteApi, UseAutocompleteOptions } from "./types";
import { useDebouncedValue } from "./use-debounced-value";

function toChangeValue<T>(items: T[], multiple: boolean): T | T[] | null {
  return multiple ? items : (items[0] ?? null);
}

/**
 * Headless state machine for a linear (non-nested) autocomplete/combobox.
 * Owns open state, input text, the active descendant index, filtering, and
 * selection. It is intentionally tree-unaware.
 */
export function useAutocomplete<T>(options: UseAutocompleteOptions<T>): AutocompleteApi<T> {
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
    debounce = 0,
    loading = false,
  } = options;

  const listId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeIndex, setActiveIndexState] = useState(-1);
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  const debouncedQuery = useDebouncedValue(inputValue, debounce);

  const filteredItems = useMemo(() => {
    if (filterItems) return filterItems(items, debouncedQuery);
    return defaultFilterItems(items, debouncedQuery, getSearchText);
  }, [items, debouncedQuery, filterItems, getSearchText]);

  const filteredRef = useRef(filteredItems);
  filteredRef.current = filteredItems;

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
      // Deliberate: re-highlight the first result on every keystroke so a
      // quick Enter after typing selects the top match.
      setActiveIndexState(0);
      onInputChange?.(value);
    },
    [onInputChange],
  );

  const setActiveIndex = useCallback((index: number) => {
    const max = Math.max(0, filteredRef.current.length - 1);
    setActiveIndexState(Math.min(Math.max(index, 0), max));
  }, []);

  const moveActive = useCallback(
    (delta: number) => setActiveIndex(activeIndex + delta),
    [activeIndex, setActiveIndex],
  );

  const select = useCallback(
    (item: T) => {
      setSelectedItemsState((prev) => {
        let next: T[];
        if (multiple) {
          next = prev.some((i) => isSameItem(i, item, getItemId))
            ? prev.filter((i) => !isSameItem(i, item, getItemId))
            : [...prev, item];
        } else {
          next = [item];
        }
        onChange?.(toChangeValue(next, multiple));
        return next;
      });
    },
    [multiple, onChange, getItemId],
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

  const getItemIdCb = useCallback(
    (item: T, index: number) => resolveItemId(item, index, getItemId),
    [getItemId],
  );

  const announcement = loading
    ? "Loading…"
    : !isOpen
      ? ""
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;

  const getters = createPropGetters({
    isOpen,
    listId,
    inputValue,
    activeIndex,
    filteredItems,
    isSelected,
    getItemId: getItemIdCb,
    setInputValue,
    setActiveIndex,
    moveActive,
    setOpen,
    select,
  });

  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    setOpen,
    inputValue,
    setInputValue,
    filteredItems,
    activeIndex,
    setActiveIndex,
    moveActive,
    selectedItems,
    select,
    setSelectedItems,
    getItemId: getItemIdCb,
    listId,
    announcement,
    ...getters,
  };
}
