import type { ReactNode } from "react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "../primitives/combobulate";

/** Props for the batteries-included {@link Autocomplete} preset. */
export type AutocompleteProps<T> = {
  /** Full list of items to search over. */
  items: T[];
  /** Renders a single item's contents. Defaults to `String(item)`. */
  renderItem?: (item: T) => ReactNode;
  /** Accessor for an item's searchable/display text. */
  getSearchText?: (item: T) => string;
  /** Accessor for an item's stable id. Defaults to identity via index. */
  getItemId?: (item: T) => string;
  /** Custom filter. Defaults to a normalized substring match. */
  filterItems?: (items: T[], query: string) => T[];
  /** Fired when selection changes. */
  onChange?: (value: T | T[] | null) => void;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Estimated row height in px, passed through to TanStack Virtual. */
  estimateSize?: (index: number) => number;
  /** Rendered in place of the list when there are no matches. */
  emptyMessage?: ReactNode;
  /** External loading flag; drives the live-region announcement. */
  loading?: boolean;
};

/**
 * A styled, virtualized linear autocomplete built on the Combobulate
 * primitives. Ships with class names (`cbl-*`) and `data-*` attribute
 * hooks that `presets/styles.css` targets; importing that stylesheet is
 * optional but recommended for a ready-made look.
 */
export function Autocomplete<T>({
  items,
  renderItem = (item) => String(item),
  getSearchText,
  getItemId,
  filterItems,
  onChange,
  placeholder,
  estimateSize,
  emptyMessage = "No results",
  loading,
}: AutocompleteProps<T>) {
  const api = useAutocompleteVirtual({
    items,
    getSearchText,
    getItemId,
    filterItems,
    onChange,
    estimateSize,
    loading,
  });
  return (
    <div className="cbl-root">
      <Combobulate.Root api={api}>
        <Combobulate.Input className="cbl-input" placeholder={placeholder} />
        <Combobulate.List>
          {(item: T, index: number) => (
            <Combobulate.Item item={item} index={index}>
              <div className="cbl-option">{renderItem(item)}</div>
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>
          <div className="cbl-empty">{emptyMessage}</div>
        </Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}
