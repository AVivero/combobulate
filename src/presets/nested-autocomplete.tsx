import { type ReactNode, useState } from "react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Popover } from "../floating/floating-primitives";
import { useAutocompleteFloating } from "../floating/use-floating";
import { Combobulate } from "../primitives/combobulate";
import { mergeProps } from "../primitives/merge-props";
import { AggregateCheckbox, Tree, TreeItem } from "../tree/tree-primitives";
import type { TreeCombo, TreeRow } from "../tree/types";
import { useTree } from "../tree/use-tree";

/** Props for the batteries-included {@link NestedAutocomplete} preset. */
export type NestedAutocompleteProps<T> = {
  /** Root nodes of the source tree. */
  nodes: T[];
  /** Accessor for a node's children. */
  getChildren: (node: T) => T[] | undefined;
  /** Accessor for a node's stable id. */
  getItemId: (node: T) => string;
  /** Accessor for a node's searchable/display text. */
  getSearchText?: (node: T) => string;
  /** Renders a single node's contents. Defaults to `getSearchText`/`String`. */
  renderItem?: (item: T, meta: TreeRow<T>) => ReactNode;
  /** Fired when selection changes. */
  onChange?: (value: T | T[] | null) => void;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Estimated row height in px, passed to TanStack Virtual. */
  estimateSize?: (index: number) => number;
  /** Allow selecting multiple nodes. */
  multiple?: boolean;
  /** Show a tri-state "select all under node" control on expandable rows. */
  selectAllUnder?: boolean;
  /** Rendered when there are no matches. */
  emptyMessage?: ReactNode;
};

/**
 * A styled, virtualized nested (tree) autocomplete built on the core + tree
 * layer. The composer owns a `query` mirror (updated via `onInputChange`) that
 * feeds both `useTree` (which filters to matches-plus-ancestors) and the
 * pass-through core.
 */
export function NestedAutocomplete<T>({
  nodes,
  getChildren,
  getItemId,
  getSearchText,
  renderItem,
  onChange,
  placeholder,
  estimateSize,
  multiple = false,
  selectAllUnder = false,
  emptyMessage = "No results",
}: NestedAutocompleteProps<T>) {
  const [query, setQuery] = useState("");
  const tree = useTree({
    nodes,
    getChildren,
    getItemId,
    getSearchText,
    query,
    aggregateSelectAll: selectAllUnder && multiple,
  });
  const combo = useAutocompleteVirtual<T>({
    items: tree.items,
    getItemId,
    getSearchText,
    filterItems: (items) => items,
    onInputChange: setQuery,
    onChange,
    multiple,
    estimateSize,
  });
  const floating = useAutocompleteFloating(combo, { closeOnSelect: !multiple });
  const label = (item: T, meta: TreeRow<T>) =>
    renderItem ? renderItem(item, meta) : getSearchText ? getSearchText(item) : String(item);
  // `tree.composeKeyDown` falls back to the combo's own core keydown handler
  // (arrow up/down, enter, escape) for any key it doesn't own — a fallback
  // meant for consumers who wire it directly onto a raw input, bypassing
  // `Combobulate.Input`. `Combobulate.Input` already composes that same core
  // handler in automatically, so re-running it here would double-fire (e.g.
  // moving the active index by two on a single ArrowDown). This facade gives
  // `composeKeyDown` a no-op core fallback so it only contributes its own
  // ←/→ expand/collapse/move logic; the real core handling still runs
  // exactly once, via `Combobulate.Input`.
  const treeCombo: TreeCombo<T> = {
    ...combo,
    getInputProps: () => ({ ...combo.getInputProps(), onKeyDown: () => {} }),
  };
  // `floating.referenceProps` carries its own `onKeyDown` (Escape-to-dismiss).
  // Composing it with the tree's ←/→ handler here — rather than spreading
  // both onto `Combobulate.Input` separately — keeps both working: a plain
  // object spread would let whichever prop comes last silently replace the
  // other instead of augmenting it.
  const inputProps = mergeProps(
    { onKeyDown: tree.composeKeyDown(treeCombo) },
    floating.referenceProps,
  );
  return (
    <div className="cbl-root">
      <Combobulate.Root api={combo}>
        <Combobulate.Input
          className="cbl-input"
          placeholder={placeholder}
          ref={floating.reference}
          {...inputProps}
        />
        <Popover floating={floating}>
          <Tree
            tree={tree}
            multiple={multiple}
            style={{ position: "static", maxHeight: "none", flex: "1 1 auto", minHeight: 0 }}
          >
            {(item: T, index: number) => {
              const meta = tree.rows[index];
              return (
                <TreeItem item={item} index={index}>
                  <div
                    className="cbl-treeitem"
                    style={{ paddingLeft: 12 + (meta?.depth ?? 0) * 16 }}
                  >
                    {meta?.hasChildren ? (
                      <button
                        type="button"
                        className="cbl-chevron"
                        aria-label={meta.expanded ? "Collapse" : "Expand"}
                        data-expanded={meta.expanded ? "" : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          tree.toggle(meta.id);
                        }}
                      />
                    ) : null}
                    {selectAllUnder && multiple && meta?.hasChildren ? (
                      <AggregateCheckbox nodeId={meta.id} />
                    ) : null}
                    <span className="cbl-treeitem-label">{meta ? label(item, meta) : null}</span>
                  </div>
                </TreeItem>
              );
            }}
          </Tree>
          <Combobulate.Empty>
            <div className="cbl-empty">{emptyMessage}</div>
          </Combobulate.Empty>
        </Popover>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}
