import {
  type Placement,
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
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";
import type { AutocompleteFloating, UseFloatingOptions } from "./types";

/**
 * Opt-in floating behavior for a Combobulate combobox. Wraps Floating UI so the
 * dropdown anchors to the input, flips/shifts to stay on screen, and dismisses
 * on outside-click/Escape — driving the combo's own open state.
 */
export function useAutocompleteFloating<T>(
  api: AutocompleteVirtualApi<T>,
  options: UseFloatingOptions = {},
): AutocompleteFloating {
  const {
    placement = "bottom-start" as Placement,
    offset: offsetPx = 4,
    padding = 8,
    matchWidth = true,
    dismissOnOutsideClick = true,
    closeOnSelect = false,
  } = options;

  const { refs, floatingStyles, context } = useFloating({
    open: api.isOpen,
    onOpenChange: (open) => api.setOpen(open),
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offsetMw(offsetPx),
      flip({ padding }),
      shift({ padding }),
      size({
        padding,
        apply({ rects, elements, availableHeight }) {
          const style: Record<string, string> = { maxHeight: `${availableHeight}px` };
          if (matchWidth) style.width = `${rects.reference.width}px`;
          Object.assign(elements.floating.style, style);
        },
      }),
    ],
  });

  const dismiss = useDismiss(context, { outsidePress: dismissOnOutsideClick });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // Close on select (single-select): fire when the selection signature changes
  // to a non-empty value. Kept in the floating layer so the core stays untouched.
  const signature = api.selectedItems.map((item, i) => api.getItemId(item, i)).join("|");
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
