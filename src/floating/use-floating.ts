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
import type { CombobulateApi } from "../core/types";
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
 * outside-click/Escape — driving the combo's own open state.
 */
export function useCombobulateFloating<T>(
  api: CombobulateApi<T>,
  options: CombobulateFloatingOptions = {},
): CombobulateFloating {
  const { closeOnSelect = false } = options;

  const { refs, floatingStyles, context } = useFloating({
    open: api.isOpen,
    onOpenChange: (open) => api.setOpen(open),
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

  // Close on select (single-select): fire when the selection signature changes
  // to a non-empty value. Kept in the floating layer so the core stays untouched.
  const signature = api.selectedItems.map((item, i) => api.itemValue(item, i)).join("|");
  const prevSignature = useRef(signature);
  useEffect(() => {
    if (closeOnSelect && signature !== prevSignature.current && api.selectedItems.length > 0) {
      api.setOpen(false);
    }
    prevSignature.current = signature;
  }, [signature, closeOnSelect, api]);

  return {
    reference: refs.setReference,
    floating: refs.setFloating,
    floatingStyles,
    referenceProps: getReferenceProps(),
    floatingProps: getFloatingProps(),
  };
}
