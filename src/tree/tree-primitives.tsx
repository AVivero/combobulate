import type { ReactNode } from "react";
import { useCombobulateContext } from "../primitives/context";
import { TreeProvider, useTreeContext } from "./tree-context";
import type { TreeApi } from "./types";

/** Props for {@link Tree}. */
export interface TreeProps<T> {
  /** The value returned by `useTree`. */
  tree: TreeApi<T>;
  /** Render-prop invoked once per visible (virtualized) item. */
  children: (item: T, index: number) => ReactNode;
  style?: React.CSSProperties;
}

/**
 * Virtualized `role="tree"` scroll container. Reads the combo api from context
 * (for virtualization + list wiring) and provides the tree api to descendants.
 */
export function Tree<T>({ tree, children, style }: TreeProps<T>) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  const rows = api.virtualizer.getVirtualItems();
  const { ref } = api.getScrollProps();
  const listProps = api.getListProps();
  return (
    <TreeProvider value={tree}>
      <div
        {...listProps}
        role="tree"
        aria-multiselectable
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
    </TreeProvider>
  );
}

/** Props for {@link TreeItem}. */
export interface TreeItemProps<T> {
  item: T;
  index: number;
  children: ReactNode;
}

/**
 * A single tree row. Spreads the core option props, then overrides ARIA to
 * treeitem semantics using the index-aligned metadata from `tree.rows`.
 */
export function TreeItem<T>({ item, index, children }: TreeItemProps<T>) {
  const api = useCombobulateContext<T>();
  const tree = useTreeContext<T>();
  const meta = tree.rows[index];
  const base = api.getItemProps(item, index);
  return (
    <div
      {...base}
      role="treeitem"
      aria-level={meta ? meta.depth + 1 : 1}
      aria-expanded={meta?.hasChildren ? meta.expanded : undefined}
      data-depth={meta?.depth}
      data-expanded={meta?.hasChildren && meta.expanded ? "" : undefined}
    >
      {children}
    </div>
  );
}

/** Props for {@link AggregateCheckbox}. */
export interface AggregateCheckboxProps {
  /** The parent node whose descendant leaves this control selects. */
  nodeId: string;
}

/**
 * Tri-state "select all under node" control. Reads/writes selection through the
 * tree's aggregate helpers, bound to the combo api from context.
 */
export function AggregateCheckbox<T>({ nodeId }: AggregateCheckboxProps) {
  const api = useCombobulateContext<T>();
  const tree = useTreeContext<T>();
  const state = tree.getAggregateState(api, nodeId);
  const ariaChecked = state === "checked" ? "true" : state === "indeterminate" ? "mixed" : "false";
  const toggle = () => tree.toggleAllUnder(api, nodeId);
  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={ariaChecked}
      data-indeterminate={state === "indeterminate" ? "" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        toggle();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }
      }}
    />
  );
}
