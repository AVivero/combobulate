import type { Placement } from "@floating-ui/react";
import type { CSSProperties } from "react";

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
  reference: (el: Element | null) => void;
  floating: (el: HTMLElement | null) => void;
  floatingStyles: CSSProperties;
  referenceProps: Record<string, unknown>;
  floatingProps: Record<string, unknown>;
};
