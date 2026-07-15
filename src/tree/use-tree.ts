import { useCallback, useMemo, useRef, useState } from "react";
import { defaultGetSearchText } from "../core/item-utils";
import { collectDescendantLeafIds, computeVisibleRows, flattenTree } from "./tree-utils";
import type { TreeApi, TreeCombo, TreeRow, UseTreeOptions } from "./types";

/**
 * Headless tree state on top of the tree-unaware core. Owns `expandedIds` as
 * the single source of truth, flattens the source tree, and emits a flat
 * visible list (`items`) plus index-aligned metadata (`rows`) ready to feed
 * `useAutocompleteVirtual`. Keyboard and aggregate selection are layered on in
 * later tasks.
 */
export function useTree<T>(options: UseTreeOptions<T>): TreeApi<T> {
  const {
    nodes,
    getChildren,
    getItemId,
    getSearchText = defaultGetSearchText as (node: T) => string,
    query = "",
    defaultExpandedIds,
    expandedIds: controlledExpandedIds,
    onExpandedChange,
  } = options;

  const isControlled = controlledExpandedIds !== undefined;
  const [uncontrolled, setUncontrolled] = useState<Set<string>>(
    () => new Set(defaultExpandedIds ?? []),
  );
  const expandedIds = useMemo(
    () => (isControlled ? new Set(controlledExpandedIds) : uncontrolled),
    [isControlled, controlledExpandedIds, uncontrolled],
  );

  const flat = useMemo(
    () => flattenTree(nodes, getChildren, getItemId),
    [nodes, getChildren, getItemId],
  );

  const flatRef = useRef(flat);
  flatRef.current = flat;

  const rows = useMemo<TreeRow<T>[]>(
    () => computeVisibleRows(flat, expandedIds, query, getSearchText),
    [flat, expandedIds, query, getSearchText],
  );

  const items = useMemo(() => rows.map((r) => r.item), [rows]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const expandedRef = useRef(expandedIds);
  expandedRef.current = expandedIds;

  const applyExpanded = useCallback(
    (next: Set<string>) => {
      expandedRef.current = next;
      if (!isControlled) setUncontrolled(next);
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  const expand = useCallback(
    (id: string) => {
      const next = new Set(expandedRef.current);
      next.add(id);
      applyExpanded(next);
    },
    [applyExpanded],
  );
  const collapse = useCallback(
    (id: string) => {
      const next = new Set(expandedRef.current);
      next.delete(id);
      applyExpanded(next);
    },
    [applyExpanded],
  );
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(expandedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      applyExpanded(next);
    },
    [applyExpanded],
  );

  const composeKeyDown = useCallback<TreeApi<T>["composeKeyDown"]>(
    (combo) => (event) => {
      const currentRows = rowsRef.current;
      const row = currentRows[combo.activeIndex];
      if (row) {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          if (row.hasChildren && !row.expanded) expand(row.id);
          else if (row.hasChildren && row.expanded) combo.setActiveIndex(combo.activeIndex + 1);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          if (row.hasChildren && row.expanded) {
            collapse(row.id);
          } else if (row.parentId !== null) {
            const parentIndex = currentRows.findIndex((r) => r.id === row.parentId);
            if (parentIndex >= 0) combo.setActiveIndex(parentIndex);
          }
          return;
        }
      }
      combo.getInputProps().onKeyDown(event);
    },
    [expand, collapse],
  );

  const getAggregateState = useCallback<TreeApi<T>["getAggregateState"]>(
    (combo, nodeId) => {
      const leafIds = collectDescendantLeafIds(flatRef.current, nodeId);
      if (leafIds.length === 0) return "unchecked";
      const selectedIds = new Set(combo.selectedItems.map((item) => getItemId(item)));
      const selectedCount = leafIds.filter((id) => selectedIds.has(id)).length;
      if (selectedCount === 0) return "unchecked";
      if (selectedCount === leafIds.length) return "checked";
      return "indeterminate";
    },
    [getItemId],
  );

  const toggleAllUnder = useCallback<TreeApi<T>["toggleAllUnder"]>(
    (combo, nodeId) => {
      const leafIds = new Set(collectDescendantLeafIds(flatRef.current, nodeId));
      if (leafIds.size === 0) return;
      const state = getAggregateState(combo, nodeId);
      if (state === "checked") {
        combo.setSelectedItems(combo.selectedItems.filter((item) => !leafIds.has(getItemId(item))));
      } else {
        const selectedIds = new Set(combo.selectedItems.map((item) => getItemId(item)));
        const additions = flatRef.current
          .filter((f) => leafIds.has(f.id) && !selectedIds.has(f.id))
          .map((f) => f.item);
        combo.setSelectedItems([...combo.selectedItems, ...additions]);
      }
    },
    [getItemId, getAggregateState],
  );

  return {
    items,
    rows,
    expandedIds,
    expand,
    collapse,
    toggle,
    composeKeyDown,
    toggleAllUnder,
    getAggregateState,
  };
}
