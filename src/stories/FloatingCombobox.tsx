import type { InputHTMLAttributes, ReactNode } from "react";
import { Combobulate, type CombobulateApi, useAutocompleteFloating } from "../index";

/**
 * The demos' shared floating shell — the pattern real-world comboboxes use, and
 * combobulate's default in Storybook. Wires `useAutocompleteFloating` +
 * `Combobulate.Popover` once so each story doesn't repeat it. `closeOnSelect`
 * defaults to single-select behavior (multi-select keeps the list open to pick
 * more). Selection/filter behavior lives in `useDemoCombobox`, whose
 * `inputProps` you spread here. Not a library export — just demo glue.
 */
export function FloatingCombobox<T>({
  api,
  label,
  placeholder,
  inputProps,
  children,
  emptyMessage,
  maxHeight,
}: {
  api: CombobulateApi<T>;
  label: string;
  placeholder?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  children: (item: T, index: number) => ReactNode;
  emptyMessage?: ReactNode;
  maxHeight?: number;
}) {
  const floating = useAutocompleteFloating(api, { closeOnSelect: !api.multiple });
  return (
    <Combobulate.Root api={api} label={label}>
      <Combobulate.Input
        ref={floating.reference}
        {...floating.referenceProps}
        {...inputProps}
        aria-label={label}
        placeholder={placeholder}
      />
      <Combobulate.Popover floating={floating}>
        <div className="cbl-panel">
          <Combobulate.List<T> maxHeight={maxHeight}>{children}</Combobulate.List>
          {emptyMessage === undefined ? null : (
            <Combobulate.Empty>{emptyMessage}</Combobulate.Empty>
          )}
        </div>
      </Combobulate.Popover>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  );
}
