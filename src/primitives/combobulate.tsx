import type { ReactNode } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";
import { CombobulateProvider, useCombobulateContext } from "./context";

/** Props for {@link Combobulate}'s `Root` component. */
export interface CombobulateRootProps<T> {
  /** The value returned by `useAutocompleteVirtual` (not the plain `useAutocomplete`). */
  api: AutocompleteVirtualApi<T>;
  children: ReactNode;
}

/**
 * Root provider. Pass the value returned by `useAutocompleteVirtual` — the
 * primitives (notably `Combobulate.List`) render through the virtualizer, so
 * a plain `useAutocomplete` api will not satisfy this component's props.
 */
function Root<T>({ api, children }: CombobulateRootProps<T>) {
  return <CombobulateProvider value={api}>{children}</CombobulateProvider>;
}

/** The combobox text input. */
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const api = useCombobulateContext();
  return <input {...api.getInputProps()} {...props} />;
}

/** Props for {@link Combobulate}'s `List` component. */
export interface CombobulateListProps<T> {
  /** Render-prop invoked once per visible (virtualized) item. */
  children: (item: T, index: number) => ReactNode;
  style?: React.CSSProperties;
}

/** Virtualized scroll container. `children` is a render-prop per visible item. */
function List<T>({ children, style }: CombobulateListProps<T>) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  const rows = api.virtualizer.getVirtualItems();
  const { ref } = api.getScrollProps();
  return (
    <div
      {...api.getListProps()}
      ref={ref as React.Ref<HTMLDivElement>}
      style={{ overflow: "auto", position: "relative", maxHeight: 300, ...style }}
    >
      <div style={{ height: api.virtualizer.getTotalSize(), position: "relative" }}>
        {rows.map((row) => {
          const item = api.filteredItems[row.index] as T;
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
  );
}

/** Props for {@link Combobulate}'s `Item` component. */
export interface CombobulateItemProps<T> {
  item: T;
  index: number;
  children: ReactNode;
}

/** A single option row. */
function Item<T>({ item, index, children }: CombobulateItemProps<T>) {
  const api = useCombobulateContext<T>();
  return <div {...api.getItemProps(item, index)}>{children}</div>;
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
    // biome-ignore lint/a11y/useSemanticElements: an explicit status role is intentional so headless consumers can reuse getLiveRegionProps on any element
    <div
      {...api.getLiveRegionProps()}
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
    </div>
  );
}

/** Headless Combobulate primitives. */
export const Combobulate = { Root, Input, List, Item, Empty, LiveRegion };
