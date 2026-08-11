import type { CSSProperties, RefCallback } from "react";

/** Options for {@link useCombobulateFloating}. */
export type CombobulateFloatingOptions = {
  /** Close the dropdown when a selection is made (single-select). Default false. */
  closeOnSelect?: boolean;
};

/** Wiring returned by {@link useCombobulateFloating}. */
export type CombobulateFloating = {
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
