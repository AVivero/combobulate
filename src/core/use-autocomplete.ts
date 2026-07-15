import { useCallback, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, resolveItemId } from "./item-utils";
import type { AutocompleteApi, UseAutocompleteOptions } from "./types";

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
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeIndex, setActiveIndexState] = useState(-1);
  const [selectedItems, setSelectedItems] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  const filteredItems = useMemo(() => {
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText]);

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
      setSelectedItems((prev) => {
        let next: T[];
        if (multiple) {
          next = prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
        } else {
          next = [item];
        }
        onChange?.(multiple ? next : (next[0] ?? null));
        return next;
      });
    },
    [multiple, onChange],
  );

  const getItemIdCb = useCallback(
    (item: T, index: number) => resolveItemId(item, index, getItemId),
    [getItemId],
  );

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
    getItemId: getItemIdCb,
  };
}
