import type { CSSProperties, RefCallback } from "react";

/** Options for {@link useAutocompleteFloating}. */
export type UseFloatingOptions = {
  /** Close the dropdown when a selection is made (single-select). Default false. */
  closeOnSelect?: boolean;
};

/** Wiring returned by {@link useAutocompleteFloating}. */
export type AutocompleteFloating = {
  /**
   * Ref callback for the anchor — spread straight onto `Combobulate.Input`'s
   * `ref` (typed as an `HTMLElement` ref so no cast is needed at the call site).
   */
  reference: RefCallback<HTMLElement>;
  floating: (el: HTMLElement | null) => void;
  floatingStyles: CSSProperties;
  referenceProps: Record<string, unknown>;
  floatingProps: Record<string, unknown>;
};
