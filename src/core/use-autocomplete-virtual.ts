import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import type { AutocompleteApi, UseAutocompleteOptions } from "./types";
import { useAutocomplete } from "./use-autocomplete";

/** Extra options for the virtualized variant of {@link useAutocomplete}. */
export interface UseAutocompleteVirtualOptions<T> extends UseAutocompleteOptions<T> {
  /** Estimated row height in px. Required by TanStack Virtual. */
  estimateSize?: (index: number) => number;
  /** Rows to render above/below the viewport. Default 8. */
  overscan?: number;
}

/** Return type of {@link useAutocompleteVirtual}. */
export interface AutocompleteVirtualApi<T> extends AutocompleteApi<T> {
  virtualizer: Virtualizer<HTMLElement, Element>;
  getScrollProps: () => { ref: React.RefObject<HTMLElement | null> };
}

/**
 * Virtualized autocomplete. Wraps {@link useAutocomplete} and bridges the
 * state-owned active index to TanStack Virtual: whenever the active index
 * changes we call `scrollToIndex`, which mounts the active row so that
 * `aria-activedescendant` always resolves to a real DOM node.
 */
export function useAutocompleteVirtual<T>(
  options: UseAutocompleteVirtualOptions<T>,
): AutocompleteVirtualApi<T> {
  const { estimateSize = () => 32, overscan = 8, ...rest } = options;
  const api = useAutocomplete(rest);
  const scrollRef = useRef<HTMLElement | null>(null);

  const virtualizer = useVirtualizer({
    count: api.filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  // Bridge: keep the active row mounted whenever the active index changes.
  // Guarded on a valid (non-negative) active index so we never call
  // scrollToIndex(-1), which is the initial value before anything is
  // highlighted.
  useEffect(() => {
    if (api.isOpen && api.activeIndex >= 0 && api.filteredItems.length > 0) {
      virtualizer.scrollToIndex(api.activeIndex, { align: "auto" });
    }
  }, [api.activeIndex, api.isOpen, api.filteredItems.length, virtualizer]);

  return { ...api, virtualizer, getScrollProps: () => ({ ref: scrollRef }) };
}
