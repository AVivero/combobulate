import { type KeyboardEvent, useCallback, useId, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem } from "./item-utils";
import type { AutocompleteApi, UseAutocompleteOptions } from "./types";

/** Convert the selected items to the value type expected by the `onChange` callback. */
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
    loading = false,
  } = options;

  const listId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeIndex, setActiveIndexState] = useState(-1);
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
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
      /** Deliberate: re-highlight the first result on every keystroke so a
       * quick Enter after typing selects the top match.
       */
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
    (item: T, index: number) => (getItemId ? getItemId(item) : String(index)),
    [getItemId],
  );

  /** Generate the live-region announcement string. */
  const announcement = loading
    ? "Loading…"
    : !isOpen
      ? ""
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;

  // Prop getters. Kept inline (rather than a separate factory) because they are
  // this hook's only caller and close directly over the state above; the DOM id
  // is namespaced with `listId` so multiple comboboxes on one page never
  // produce colliding ids (which would make `aria-activedescendant` ambiguous).
  const domId = (item: T, index: number) => `${listId}-${getItemIdCb(item, index)}`;

  const activeId =
    isOpen && filteredItems[activeIndex] !== undefined
      ? domId(filteredItems[activeIndex] as T, activeIndex)
      : undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          setOpen(true);
          if (activeIndex < 0) setActiveIndex(0);
        } else {
          moveActive(1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          setOpen(true);
          if (activeIndex < 0) setActiveIndex(0);
        } else {
          moveActive(-1);
        }
        break;
      case "Enter": {
        const item = filteredItems[activeIndex];
        if (isOpen && item !== undefined) {
          event.preventDefault();
          select(item);
        }
        break;
      }
      case "Escape":
        setOpen(false);
        break;
    }
  };

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
    getInputProps: () => ({
      role: "combobox" as const,
      "aria-controls": listId,
      "aria-expanded": isOpen,
      "aria-activedescendant": activeId,
      value: inputValue,
      onChange: (e: { target: { value: string } }) => {
        setInputValue(e.target.value);
        if (!isOpen) setOpen(true);
      },
      onKeyDown,
      onFocus: () => setOpen(true),
    }),
    getListProps: () => ({ id: listId, role: "listbox" as const }),
    getLiveRegionProps: () => ({
      role: "status" as const,
      "aria-live": "polite" as const,
      "aria-atomic": true as const,
    }),
    getItemProps: (item: T, index: number) => {
      const isActive = index === activeIndex;
      const selected = isSelected(item);
      return {
        id: domId(item, index),
        role: "option" as const,
        "aria-selected": selected,
        "aria-setsize": filteredItems.length,
        "aria-posinset": index + 1,
        "data-active": (isActive ? "" : undefined) as "" | undefined,
        "data-selected": (selected ? "" : undefined) as "" | undefined,
        onClick: () => select(item),
        onPointerMove: () => setActiveIndex(index),
      };
    },
  };
}
