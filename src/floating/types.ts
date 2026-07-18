import type { Placement } from "@floating-ui/react";
import type { CSSProperties, RefCallback } from "react";

/** Options for {@link useAutocompleteFloating}. */
export type UseFloatingOptions = {
  /** Anchor placement. Default "bottom-start". */
  placement?: Placement;
  /** Gap (px) between input and dropdown. Default 4. */
  offset?: number;
  /** Viewport padding (px) for flip/shift/size. Default 8. */
  padding?: number;
  /** Match the dropdown width to the input. Default true. */
  matchWidth?: boolean;
  /** Dismiss when the user clicks outside. Default true. */
  dismissOnOutsideClick?: boolean;
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
