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
 * Renders nothing while the combobox is closed. The `size` middleware caps the
 * height, so it's a flex column and the inner list scrolls to fill it.
 */
export function Popover<T>({ floating, children }: PopoverProps) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  return (
    <div
      ref={floating.floating}
      {...floating.floatingProps}
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
