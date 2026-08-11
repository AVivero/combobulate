import type { ReactNode } from "react";
import { useCombobulateContext } from "../core/context";
import type { CombobulateFloating } from "./types";

/** Props for {@link Popover}. */
export type PopoverProps = {
  /** The value from `useCombobulateFloating`. */
  floating: CombobulateFloating;
  children: ReactNode;
};

/**
 * Positioned, self-dismissing dropdown container. Wrap `Combobulate.List` in it.
 * Renders nothing while the combobox is closed. The `size` middleware caps its
 * height to the available viewport space; it's a flex column whose content
 * flex-shrinks to fit so the inner list scrolls rather than being clipped when
 * the popover flips into a tighter space.
 */
export function Popover<T>({ floating, children }: PopoverProps) {
  const store = useCombobulateContext<T>();
  const isOpen = store.useState("isOpen");
  if (!isOpen) return null;
  return (
    <div
      ref={floating.floating}
      {...floating.floatingProps}
      // Capped to the available viewport height by the size middleware; a flex
      // column whose content flex-shrinks to fit (min-height:0 down the chain) so
      // the inner list SCROLLS rather than the popover clipping it when flipped.
      // A wrapper between this and `List` must be a flex column with min-height:0
      // (or render `List` directly here) for the height to flow through.
      style={{
        ...floating.floatingStyles,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
}
