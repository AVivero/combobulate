import type { KeyboardEvent } from "react";

/**
 * Options accepted by {@link useAutocomplete}. Deliberately tree-unaware.
 *
 * This hook is **uncontrolled**: selection, input text, and open state are
 * owned internally and surfaced via `onChange`/`onInputChange`/`onOpenChange`
 * callbacks plus `default*` seed values. Controlled `value`, `inputValue`,
 * and `open` props are not yet supported (planned for a later release).
 */
export interface UseAutocompleteOptions<T> {
  /** Full list of items to search over. */
  items: T[];
  /** Accessor for an item's searchable/display text. */
  getSearchText?: (item: T) => string;
  /** Accessor for an item's stable id. Falls back to positional index. */
  getItemId?: (item: T) => string;
  /** Custom filter. Defaults to a normalized substring match. */
  filterItems?: (items: T[], query: string) => T[];
  /** Initial selection for the uncontrolled case. */
  defaultValue?: T | T[] | null;
  /** Fired when selection changes. */
  onChange?: (value: T | T[] | null) => void;
  /**
   * Fired synchronously on every input change. Note this is independent of
   * `debounce`, which only delays when `filteredItems` recomputes.
   */
  onInputChange?: (value: string) => void;
  /** Initial open state for the uncontrolled case. */
  defaultOpen?: boolean;
  /** Fired when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Allow selecting multiple items. */
  multiple?: boolean;
  /** Debounce (ms) applied to filtering. Default 0 (off). */
  debounce?: number;
}

/** Public API returned by {@link useAutocomplete}. */
export interface AutocompleteApi<T> {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (next: boolean) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  filteredItems: T[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  moveActive: (delta: number) => void;
  selectedItems: T[];
  select: (item: T) => void;
  /**
   * Resolve an item's **logical** id (the caller's `getItemId` accessor, or
   * the item's positional index as a fallback). This is not the rendered DOM
   * id: `getItemProps`/`getInputProps` namespace it as `${listId}-${logicalId}`
   * so multiple combobox instances on one page never collide.
   */
  getItemId: (item: T, index: number) => string;
  /** Stable id of the listbox element, used to wire `aria-controls`/`aria-activedescendant`. */
  listId: string;
  /** Props for the text input, including ARIA wiring and keyboard navigation. */
  getInputProps: () => {
    role: "combobox";
    "aria-controls": string;
    "aria-expanded": boolean;
    "aria-activedescendant": string | undefined;
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    onKeyDown: (event: KeyboardEvent) => void;
    onFocus: () => void;
  };
  /** Props for the listbox element. */
  getListProps: () => { id: string; role: "listbox" };
  /** Props for a single option element. */
  getItemProps: (
    item: T,
    index: number,
  ) => {
    id: string;
    role: "option";
    "aria-selected": boolean;
    "aria-setsize": number;
    "aria-posinset": number;
    "data-active": "" | undefined;
    "data-selected": "" | undefined;
    onClick: () => void;
    onPointerMove: () => void;
  };
}
