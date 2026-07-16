import { normalizeText } from "../core/item-utils";

/** A single node flattened out of the source tree, with structural metadata. */
export interface FlatNode<T> {
  item: T;
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
}

/** A flattened node that survived visibility filtering, with its expansion state. */
export interface VisibleRow<T> extends FlatNode<T> {
  expanded: boolean;
}

/**
 * Depth-first flatten of a source tree into `FlatNode`s. The virtualizer only
 * ever sees this flat list, so virtualization and trees compose cleanly.
 */
export function flattenTree<T>(
  nodes: T[],
  getChildren: (node: T) => T[] | undefined,
  getItemId: (node: T) => string,
): FlatNode<T>[] {
  const out: FlatNode<T>[] = [];
  const walk = (list: T[], parentId: string | null, depth: number) => {
    for (const node of list) {
      const id = getItemId(node);
      const children = getChildren(node);
      const hasChildren = !!children && children.length > 0;
      out.push({ item: node, id, parentId, depth, hasChildren });
      if (hasChildren) walk(children as T[], id, depth + 1);
    }
  };
  walk(nodes, null, 0);
  return out;
}

/** Collect the transitive ancestor ids of every id in `ids`. */
export function collectAncestorIds<T>(flat: FlatNode<T>[], ids: Set<string>): Set<string> {
  const parentOf = new Map<string, string | null>();
  for (const f of flat) parentOf.set(f.id, f.parentId);
  const result = new Set<string>();
  for (const id of ids) {
    let parent = parentOf.get(id) ?? null;
    while (parent !== null && !result.has(parent)) {
      result.add(parent);
      parent = parentOf.get(parent) ?? null;
    }
  }
  return result;
}

/** Collect the leaf (childless) descendant ids beneath `nodeId`. */
export function collectDescendantLeafIds<T>(flat: FlatNode<T>[], nodeId: string): string[] {
  const childrenOf = new Map<string, FlatNode<T>[]>();
  for (const f of flat) {
    if (f.parentId === null) continue;
    const arr = childrenOf.get(f.parentId) ?? [];
    arr.push(f);
    childrenOf.set(f.parentId, arr);
  }
  const leaves: string[] = [];
  const walk = (id: string) => {
    for (const child of childrenOf.get(id) ?? []) {
      if (child.hasChildren) walk(child.id);
      else leaves.push(child.id);
    }
  };
  walk(nodeId);
  return leaves;
}

/**
 * Compute the flat visible rows. With no query, a row is visible iff every
 * ancestor is expanded. With a query, keep matches plus their ancestors and
 * force-expand the ancestors (auto-expand), so a matched leaf keeps its
 * context instead of appearing orphaned.
 */
export function computeVisibleRows<T>(
  flat: FlatNode<T>[],
  expandedIds: Set<string>,
  query: string,
  getSearchText: (item: T) => string,
): VisibleRow<T>[] {
  const q = normalizeText(query);

  if (q.length === 0) {
    const visibleIds = new Set<string>();
    const rows: VisibleRow<T>[] = [];
    for (const f of flat) {
      const parentVisible = f.parentId === null || visibleIds.has(f.parentId);
      const parentExpanded = f.parentId === null || expandedIds.has(f.parentId);
      if (parentVisible && parentExpanded) {
        visibleIds.add(f.id);
        rows.push({ ...f, expanded: f.hasChildren && expandedIds.has(f.id) });
      }
    }
    return rows;
  }

  const matchSet = new Set<string>();
  for (const f of flat) {
    if (normalizeText(getSearchText(f.item)).includes(q)) matchSet.add(f.id);
  }
  const keepSet = new Set(matchSet);
  for (const id of collectAncestorIds(flat, matchSet)) keepSet.add(id);
  return flat.filter((f) => keepSet.has(f.id)).map((f) => ({ ...f, expanded: f.hasChildren }));
}
