import type { ReactNode } from "react";
import { Combobulate, type CombobulateApi, useAutocompleteFloating } from "../index";
import { useSelectionInInput } from "./useSelectionInInput";

/**
 * The demos' shared floating shell — the pattern real-world comboboxes use, and
 * combobulate's default in Storybook. Wires `useAutocompleteFloating` +
 * `Combobulate.Popover` once so each story doesn't repeat it. `closeOnSelect`
 * defaults to single-select behavior (multi-select keeps the list open to pick
 * more), and a single-select pick fills the input with `getLabel(item)` so the
 * selection is visible. Not a library export — just demo glue; a consumer would
 * inline this.
 */
export function FloatingCombobox<T>({
  api,
  label,
  placeholder,
  children,
  emptyMessage,
  getLabel,
}: {
  api: CombobulateApi<T>;
  label: string;
  placeholder?: string;
  children: (item: T, index: number) => ReactNode;
  emptyMessage?: ReactNode;
  /** Fills the input on single-select. Defaults to `String(item)`. */
  getLabel?: (item: T) => string;
}) {
  const floating = useAutocompleteFloating(api, { closeOnSelect: !api.multiple });
  useSelectionInInput(api, getLabel);
  return (
    <Combobulate.Root api={api} label={label}>
      <Combobulate.Input
        ref={floating.reference}
        {...floating.referenceProps}
        aria-label={label}
        placeholder={placeholder}
      />
      <Combobulate.Popover floating={floating}>
        <div className="cbl-panel">
          <Combobulate.List<T>>{children}</Combobulate.List>
          {emptyMessage === undefined ? null : (
            <Combobulate.Empty>{emptyMessage}</Combobulate.Empty>
          )}
        </div>
      </Combobulate.Popover>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  );
}
