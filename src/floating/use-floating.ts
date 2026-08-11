import {
  autoUpdate,
  flip,
  offset as offsetMw,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { useEffect, useRef } from "react";
import type { CombobulateStore } from "../core/types";
import type { CombobulateFloating, CombobulateFloatingOptions } from "./types";

// Fixed positioning defaults for the combobox dropdown. These were once
// options; nothing ever overrode them, so they're inlined.
const PLACEMENT = "bottom-start";
const OFFSET_PX = 4;
const PADDING = 8;

/**
 * Opt-in floating behavior for a Combobulate combobox. Wraps Floating UI so the
 * dropdown anchors below the input, flips/shifts to stay on screen, matches the
 * input width, caps its height to the viewport, and dismisses on
 * outside-click/Escape — driving the store's own open state.
 */
export function useCombobulateFloating<T>(
  store: CombobulateStore<T>,
  options: CombobulateFloatingOptions = {},
): CombobulateFloating {
  const { closeOnSelect = false } = options;

  const isOpen = store.useState("isOpen");

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: store.setOpen,
    placement: PLACEMENT,
    whileElementsMounted: autoUpdate,
    middleware: [
      offsetMw(OFFSET_PX),
      flip({ padding: PADDING }),
      shift({ padding: PADDING }),
      size({
        padding: PADDING,
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${availableHeight}px`,
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ],
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  /**
   * Close on select (single-select): fire when the selection actually
   * changes to a non-empty value. Kept in the floating layer so core stays
   * untouched.
   *
   * Diffed by the `selectedItems` array's own reference, not a recomputed
   * "signature" string. The store caches `selectedItems` behind its internal
   * `selectedValue` (required so `useSyncExternalStore` doesn't loop), which
   * means the reference is stable across re-renders that don't touch
   * selection and gets a fresh reference on every real selection change —
   * including a single-select re-pick of a *different* item, where the
   * array's length never changes. (Diffing a recomputed "signature" string
   * here would mean reconstructing item identity in the floating layer — the
   * store's job — so we lean on its reference instead.)
   */
  const selectedItems = store.useState("selectedItems");
  const prevSelectedItemsRef = useRef(selectedItems);
  useEffect(() => {
    const changed = selectedItems !== prevSelectedItemsRef.current;
    prevSelectedItemsRef.current = selectedItems;
    if (closeOnSelect && changed && selectedItems.length > 0) {
      store.setOpen(false);
    }
  }, [selectedItems, closeOnSelect, store]);

  return {
    reference: refs.setReference,
    floating: refs.setFloating,
    floatingStyles,
    referenceProps: getReferenceProps(),
    floatingProps: getFloatingProps(),
  };
}
