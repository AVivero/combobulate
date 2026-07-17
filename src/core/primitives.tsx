import { Command } from "cmdk";
import { type ReactNode, forwardRef } from "react";
import { CombobulateProvider, useCombobulateContext } from "./context";
import { mergeProps } from "./merge-props";
import type { CombobulateApi } from "./types";

/** Props for {@link Combobulate}'s `Root` component. */
export type CombobulateRootProps<T> = {
  /** The value returned by `useCombobulate`. */
  api: CombobulateApi<T>;
  /** Accessible label for the command surface. */
  label?: string;
  children: ReactNode;
};

/**
 * Root provider. Renders cmdk's `<Command>` with filtering disabled (we filter
 * in `useCombobulate`) and its highlight controlled by the api, which is what
 * lets the virtualization bridge observe and drive the active row.
 */
function Root<T>({ api, label, children }: CombobulateRootProps<T>) {
  return (
    <CombobulateProvider value={api}>
      <Command
        shouldFilter={false}
        label={label}
        value={api.activeValue}
        onValueChange={api.setActiveValue}
      >
        {children}
      </Command>
    </CombobulateProvider>
  );
}

/**
 * The combobox text input. cmdk supplies `role="combobox"` and owns
 * `aria-activedescendant`.
 *
 * Handlers from the api and any same-named handler in `props` are composed
 * (ours first, then the consumer's) rather than one clobbering the other —
 * this is what lets the floating layer's Escape-to-dismiss `onKeyDown` sit
 * alongside the jump-key interceptor when consumers spread
 * `{...floating.referenceProps}` here.
 */
const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const api = useCombobulateContext();
    const own = {
      value: api.inputValue,
      onFocus: () => api.setOpen(true),
    };
    const merged = mergeProps(own, props);
    return (
      <Command.Input
        {...merged}
        ref={ref}
        onValueChange={(value: string) => {
          api.setInputValue(value);
          if (!api.isOpen) api.setOpen(true);
        }}
      />
    );
  },
);

/** Props for {@link Combobulate}'s `List` component. */
export type CombobulateListProps<T> = {
  /** Render-prop invoked once per visible (virtualized) item. */
  children: (item: T, index: number) => ReactNode;
  style?: React.CSSProperties;
};

/**
 * Virtualized scroll container. cmdk's `Command.List` supplies the listbox
 * role; the inner scroll element is ours so TanStack Virtual can measure it.
 */
function List<T>({ children, style }: CombobulateListProps<T>) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  const rows = api.virtualizer.getVirtualItems();
  return (
    <Command.List>
      <div
        ref={api.scrollRef as React.Ref<HTMLDivElement>}
        style={{ overflow: "auto", position: "relative", maxHeight: 300, ...style }}
      >
        <div style={{ height: api.virtualizer.getTotalSize(), position: "relative" }}>
          {rows.map((row) => {
            const item = api.filteredItems[row.index];
            if (item === undefined) return null;
            return (
              <div
                key={row.key}
                data-index={row.index}
                ref={api.virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
              >
                {children(item, row.index)}
              </div>
            );
          })}
        </div>
      </div>
    </Command.List>
  );
}

/** Props for {@link Combobulate}'s `Item` component. */
export type CombobulateItemProps<T> = {
  item: T;
  index: number;
  children: ReactNode;
};

/**
 * A single option row.
 *
 * cmdk owns `role="option"` and `aria-selected` (which, in its model, marks the
 * *highlighted* row). We add what cmdk structurally cannot know: `aria-setsize`
 * and `aria-posinset` across the **whole filtered list**, not just the mounted
 * window — the reason this library exists. For multi-select we additionally
 * express *chosen* state as `aria-checked` (valid on `role="option"`) so it
 * stays distinct from cmdk's highlight.
 */
function Item<T>({ item, index, children }: CombobulateItemProps<T>) {
  const api = useCombobulateContext<T>();
  const chosen = api.isSelected(item);
  return (
    <Command.Item
      value={api.itemValue(item, index)}
      onSelect={() => api.select(item)}
      aria-setsize={api.filteredItems.length}
      aria-posinset={index + 1}
      aria-checked={api.multiple ? chosen : undefined}
      data-chosen={chosen ? "" : undefined}
    >
      {children}
    </Command.Item>
  );
}

/** Rendered when there are no filtered items. */
function Empty({ children }: { children: ReactNode }) {
  const api = useCombobulateContext();
  if (!api.isOpen || api.filteredItems.length > 0) return null;
  // <output> carries an implicit `role="status"`, satisfying Biome's
  // useSemanticElements rule while keeping the same accessible role.
  return <output>{children}</output>;
}

/**
 * Visually-hidden polite live region announcing result counts and loading
 * state. The wrapper is off-screen but readable by assistive tech.
 */
function LiveRegion() {
  const api = useCombobulateContext();
  return (
    // `<output>` carries an implicit `role="status"` (see `Empty` above),
    // satisfying Biome's `useSemanticElements` rule.
    <output
      aria-live="polite"
      aria-atomic={true}
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {api.announcement}
    </output>
  );
}

/** Headless Combobulate primitives. */
export const Combobulate = { Root, Input, List, Item, Empty, LiveRegion };
