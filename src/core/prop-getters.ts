import type { KeyboardEvent } from "react";

/** Internal state the prop-getters read from. */
export interface PropGetterState<T> {
  isOpen: boolean;
  listId: string;
  inputValue: string;
  activeIndex: number;
  filteredItems: T[];
  /** Identity-aware selection predicate (id-based when `getItemId` is provided, else reference equality). */
  isSelected: (item: T) => boolean;
  getItemId: (item: T, index: number) => string;
  setInputValue: (v: string) => void;
  setActiveIndex: (i: number) => void;
  moveActive: (delta: number) => void;
  setOpen: (next: boolean) => void;
  select: (item: T) => void;
}

/** Build the prop-getter functions bound to the given state. */
export function createPropGetters<T>(state: PropGetterState<T>) {
  /**
   * The DOM id for an item row. Namespaced with the instance `listId` so that
   * multiple comboboxes on one page never produce colliding ids (which would
   * make `aria-activedescendant` ambiguous). Used for both the item's `id` and
   * the input's `aria-activedescendant`, keeping the two in sync.
   */
  const domId = (item: T, index: number) => `${state.listId}-${state.getItemId(item, index)}`;

  const activeId =
    state.isOpen && state.filteredItems[state.activeIndex] !== undefined
      ? domId(state.filteredItems[state.activeIndex] as T, state.activeIndex)
      : undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!state.isOpen) {
          state.setOpen(true);
          if (state.activeIndex < 0) state.setActiveIndex(0);
        } else {
          state.moveActive(1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!state.isOpen) {
          state.setOpen(true);
          if (state.activeIndex < 0) state.setActiveIndex(0);
        } else {
          state.moveActive(-1);
        }
        break;
      case "Enter": {
        const item = state.filteredItems[state.activeIndex];
        if (state.isOpen && item !== undefined) {
          event.preventDefault();
          state.select(item);
        }
        break;
      }
      case "Escape":
        state.setOpen(false);
        break;
    }
  };

  return {
    getInputProps: () => ({
      role: "combobox" as const,
      "aria-controls": state.listId,
      "aria-expanded": state.isOpen,
      "aria-activedescendant": activeId,
      value: state.inputValue,
      onChange: (e: { target: { value: string } }) => {
        state.setInputValue(e.target.value);
        if (!state.isOpen) state.setOpen(true);
      },
      onKeyDown,
      onFocus: () => state.setOpen(true),
    }),
    getListProps: () => ({ id: state.listId, role: "listbox" as const }),
    getLiveRegionProps: () => ({
      role: "status" as const,
      "aria-live": "polite" as const,
      "aria-atomic": true as const,
    }),
    getItemProps: (item: T, index: number) => {
      const isActive = index === state.activeIndex;
      const isSelected = state.isSelected(item);
      return {
        id: domId(item, index),
        role: "option" as const,
        "aria-selected": isSelected,
        "aria-setsize": state.filteredItems.length,
        "aria-posinset": index + 1,
        "data-active": (isActive ? "" : undefined) as "" | undefined,
        "data-selected": (isSelected ? "" : undefined) as "" | undefined,
        onClick: () => state.select(item),
        onPointerMove: () => state.setActiveIndex(index),
      };
    },
  };
}
