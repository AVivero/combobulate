import type { ReactNode } from "react";
import { useCombobulateContext } from "../core/context";
import type { CombobulateFloating } from "./types";

/** Props for {@link Popover}. `className`/`style` and other attributes are
 * forwarded to the popover element, so you can style the dropdown card directly
 * here (no wrapper needed). combobulate's positioning and the flex-column /
 * overflow chain that keeps the list scrolling win over any conflicting style. */
export type PopoverProps = {
  /** The value from `useCombobulateFloating`. */
  floating: CombobulateFloating;
} & React.HTMLAttributes<HTMLDivElement>;

/**
 * Positioned, self-dismissing dropdown container. Put `Combobulate.List` in it.
 * Renders nothing while the combobox is closed. The `size` middleware caps its
 * height to the available viewport space; it's a flex column whose content
 * flex-shrinks to fit so the inner list scrolls rather than being clipped when
 * the popover flips into a tighter space. Style the card via `className`/`style`.
 */
export function Popover<T>({ floating, children, style, ...rest }: PopoverProps) {
  const store = useCombobulateContext<T>();
  if (!store.useState("isOpen")) return null;
  return (
    <div
      {...rest}
      {...floating.floatingProps}
      ref={floating.floating}
      style={{
        // Consumer theme (vars, radius, shadow, background) first; combobulate's
        // positioning and the flex-column/overflow chain below win — so the
        // popover stays anchored and the list scrolls instead of clipping.
        ...style,
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
