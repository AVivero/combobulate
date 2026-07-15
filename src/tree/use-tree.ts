import { useCallback, useMemo, useRef, useState } from "react";
import { defaultGetSearchText } from "../core/item-utils";
import { computeVisibleRows, flattenTree } from "./tree-utils";
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

  const rows = useMemo<TreeRow<T>[]>(
    () => computeVisibleRows(flat, expandedIds, query, getSearchText),
    [flat, expandedIds, query, getSearchText],
  );

  const items = useMemo(() => rows.map((r) => r.item), [rows]);

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

  // Keyboard + aggregate helpers are implemented in later tasks; stub for now.
  const composeKeyDown = useCallback<TreeApi<T>["composeKeyDown"]>(
    (combo) => (event) => combo.getInputProps().onKeyDown(event),
    [],
  );
  const toggleAllUnder = useCallback<TreeApi<T>["toggleAllUnder"]>(() => {}, []);
  const getAggregateState = useCallback<TreeApi<T>["getAggregateState"]>(
    () => "unchecked" as const,
    [],
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
