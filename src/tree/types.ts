import type { KeyboardEvent } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";

/** A visible tree row: the source item plus its structural + expansion metadata. */
export type TreeRow<T> = {
  item: T;
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

/** The slice of the composed combo api the tree helpers read at call time. */
export type TreeCombo<T> = Pick<
  AutocompleteVirtualApi<T>,
  "activeIndex" | "setActiveIndex" | "selectedItems" | "setSelectedItems" | "getInputProps"
>;

/** Options for {@link useTree}. */
export type UseTreeOptions<T> = {
  /** Root nodes of the source tree. */
  nodes: T[];
  /** Accessor for a node's children (undefined/empty ⇒ leaf). */
  getChildren: (node: T) => T[] | undefined;
  /** Accessor for a node's stable id. Used end to end. */
  getItemId: (node: T) => string;
  /** Accessor for a node's searchable text. Defaults to the core default. */
  getSearchText?: (node: T) => string;
  /** Current search query (lifted from the composer's input state). */
  query?: string;
  /** Initial expansion for the uncontrolled case. */
  defaultExpandedIds?: Iterable<string>;
  /** Controlled expansion. */
  expandedIds?: Iterable<string>;
  /** Fired when expansion changes. */
  onExpandedChange?: (ids: Set<string>) => void;
  /** Enable the "select all under node" affordance (multi-select only). */
  aggregateSelectAll?: boolean;
};

/** Public api returned by {@link useTree}. */
export type TreeApi<T> = {
  /** Flat visible list of items → feeds `useAutocompleteVirtual`. */
  items: T[];
  /** Index-aligned metadata for each visible item (`rows[i]` ↔ `items[i]`). */
  rows: TreeRow<T>[];
  /** Current expanded ids. */
  expandedIds: Set<string>;
  /** Expand a node. */
  expand: (id: string) => void;
  /** Collapse a node. */
  collapse: (id: string) => void;
  /** Toggle a node's expansion. */
  toggle: (id: string) => void;
  /** Build a keydown handler that adds ←/→ tree nav then delegates to the core. */
  composeKeyDown: (combo: TreeCombo<T>) => (event: KeyboardEvent) => void;
  /** Toggle selection of every leaf beneath `nodeId` in one update. */
  toggleAllUnder: (combo: TreeCombo<T>, nodeId: string) => void;
  /** Tri-state selection summary for a node's descendant leaves. */
  getAggregateState: (
    combo: TreeCombo<T>,
    nodeId: string,
  ) => "checked" | "indeterminate" | "unchecked";
};
