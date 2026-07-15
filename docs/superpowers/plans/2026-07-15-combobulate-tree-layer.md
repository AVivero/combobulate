# Combobulate Tree Layer (Plan 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Snap an opt-in, accessible, virtualized **tree** layer on top of the tree-unaware core (`useTree` + `<Combobulate.Tree/TreeItem>` + `<NestedAutocomplete>`), add two generic core capabilities (bulk selection + a headless live region), and complete the remaining showcase scenarios (nested tree, dynamic heights, fuzzy, async).

**Architecture:** The core (`useAutocomplete`/`useAutocompleteVirtual`) stays parameterized over the real item type `T` and never learns about trees. `useTree` owns `expandedIds` and emits a **flat visible list** (`items: T[]`) plus index-aligned metadata (`rows: TreeRow<T>[]`); a composer feeds `tree.items` into `useAutocompleteVirtual<T>` with a pass-through filter and mirrors the input text into a `query` via `onInputChange`. Tree ARIA (`role="tree"`/`treeitem`, `aria-level`) is merged at render by the tree primitives; the base primitives are untouched. "Select all under node" is a tri-state affordance on each expandable parent row, backed by a new bulk `setSelectedItems` on the core.

**Tech Stack:** Bun (pkg manager + test runner), TypeScript, React 19, `@tanstack/react-virtual` v3, tsup, Biome, `@testing-library/react` + happy-dom (unit), Playwright + Vite (e2e/playground), Fuse.js (playground-only devDep, for the fuzzy demo).

## Global Constraints

- **Language:** TypeScript only. **File names:** kebab-case. **TSDoc on every exported function.**
- **Package name:** `combobulate`. **License:** MIT. **Module formats:** ESM + CJS + `.d.ts`.
- **Peer deps:** `react`, `react-dom`, `@tanstack/react-virtual`. Core ships **zero runtime CSS**.
- **Lego rule:** the core (`src/core/*`, `src/primitives/combobulate.tsx` base components `Root/Input/List/Item/Empty`) must contain **no** tree concepts — no `expandedIds`, `depth`, `parentId`, `getChildren`. The two core hook additions in this plan (bulk `setSelectedItems`, live region + `loading`) are generic and tree-unaware.
- **State is explicit:** never derive combobox or tree state by reading the DOM. `expandedIds: Set<string>` is the single source of truth for open/closed.
- **Styling:** state exposed only via `data-*` attributes (`data-active`, `data-selected`, `data-disabled`, plus `data-depth`/`data-expanded`/`data-indeterminate` on the tree layer). No JS-driven `:hover`.
- **Commit style:** Conventional Commits. Commit after every green step group.
- **Test command:** `bun test`. **Typecheck:** `bun run typecheck`. **Build:** `bun run build`. **Lint:** `bun run lint`. **E2E:** `bun run e2e`.
- **Import direction:** `src/tree/*` and `src/presets/*` may import from `src/core/*`; `src/core/*` must never import from `src/tree/*` or `src/presets/*`.

---

### Task 1: Core — bulk `setSelectedItems`

**Files:**
- Modify: `src/core/types.ts` (add `setSelectedItems` to `AutocompleteApi`)
- Modify: `src/core/use-autocomplete.ts` (rename internal setter; add public bulk setter)
- Test: `src/core/use-autocomplete.test.tsx` (add a test)

**Interfaces:**
- Consumes: existing `useAutocomplete<T>` / `AutocompleteApi<T>`.
- Produces: `AutocompleteApi<T>.setSelectedItems: (items: T[]) => void` — replaces the whole selection and fires `onChange` once (`multiple ? next : next[0] ?? null`).

- [ ] **Step 1: Write the failing test**

Add to `src/core/use-autocomplete.test.tsx`:
```tsx
test("setSelectedItems replaces selection wholesale and fires onChange once", () => {
  let changed: unknown;
  let calls = 0;
  const { result } = renderHook(() =>
    useAutocomplete({
      items: ITEMS,
      multiple: true,
      onChange: (v) => {
        changed = v;
        calls += 1;
      },
    }),
  );
  act(() => result.current.setSelectedItems(["Paris", "Madrid"]));
  expect(result.current.selectedItems).toEqual(["Paris", "Madrid"]);
  expect(changed).toEqual(["Paris", "Madrid"]);
  expect(calls).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/use-autocomplete.test.tsx`
Expected: FAIL — `result.current.setSelectedItems is not a function`.

- [ ] **Step 3: Rename the internal state setter and add the public bulk setter**

In `src/core/use-autocomplete.ts`, change the selection state declaration (currently line ~31) from:
```ts
  const [selectedItems, setSelectedItems] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );
```
to:
```ts
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );
```

In the `select` callback, change `setSelectedItems((prev) => {` to `setSelectedItemsState((prev) => {` (the only other use of the old setter).

Add, right after the `select` callback:
```ts
  const setSelectedItems = useCallback(
    (next: T[]) => {
      setSelectedItemsState(next);
      onChange?.(multiple ? next : (next[0] ?? null));
    },
    [multiple, onChange],
  );
```

Add `setSelectedItems` to the returned object (after `select,`):
```ts
    select,
    setSelectedItems,
```

In `src/core/types.ts`, add to `AutocompleteApi<T>` (after the `select` line):
```ts
  /** Toggle a single item's selection (respects `multiple`). */
  select: (item: T) => void;
  /** Replace the entire selection in one update. Fires `onChange` once. */
  setSelectedItems: (items: T[]) => void;
```
(The `select` line already exists; add only the `setSelectedItems` line + its TSDoc.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/use-autocomplete.test.tsx && bun run typecheck`
Expected: PASS (all existing tests + the new one); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/use-autocomplete.ts src/core/use-autocomplete.test.tsx
git commit -m "feat: add bulk setSelectedItems to core selection api"
```

---

### Task 2: Core — `loading` option, `announcement`, `getLiveRegionProps`, and `<Combobulate.LiveRegion>`

**Files:**
- Modify: `src/core/types.ts` (add `loading` option; add `announcement` + `getLiveRegionProps` to api)
- Modify: `src/core/prop-getters.ts` (add `getLiveRegionProps`)
- Modify: `src/core/use-autocomplete.ts` (destructure `loading`; compute `announcement`; return both)
- Modify: `src/primitives/combobulate.tsx` (add `LiveRegion` primitive)
- Test: `src/core/use-autocomplete.test.tsx`, `src/primitives/combobulate.test.tsx`

**Interfaces:**
- Consumes: `AutocompleteApi<T>`, `PropGetterState<T>`, `createPropGetters`.
- Produces:
  - `UseAutocompleteOptions<T>.loading?: boolean`
  - `AutocompleteApi<T>.announcement: string`
  - `AutocompleteApi<T>.getLiveRegionProps: () => { role: "status"; "aria-live": "polite"; "aria-atomic": true }`
  - `Combobulate.LiveRegion` React component (no props) rendering a visually-hidden live region.

- [ ] **Step 1: Write the failing core test**

Add to `src/core/use-autocomplete.test.tsx`:
```tsx
test("announcement reflects open/result/loading state", () => {
  const { result, rerender } = renderHook(
    ({ loading }: { loading: boolean }) => useAutocomplete({ items: ITEMS, loading }),
    { initialProps: { loading: false } },
  );
  expect(result.current.announcement).toBe(""); // closed
  act(() => result.current.open());
  expect(result.current.announcement).toBe("4 results");
  act(() => result.current.setInputValue("zzz"));
  expect(result.current.announcement).toBe("No results");
  rerender({ loading: true });
  expect(result.current.announcement).toBe("Loading…");
});
```
(Note: `ITEMS` has 4 entries — `["Paris", "Madrid", "Málaga", "Berlin"]` — matching the existing test file's constant.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/use-autocomplete.test.tsx`
Expected: FAIL — `announcement` is `undefined`.

- [ ] **Step 3: Add the `loading` option and `announcement` computation**

In `src/core/types.ts`, add to `UseAutocompleteOptions<T>` (after `debounce`):
```ts
  /** Debounce (ms) applied to filtering. Default 0 (off). */
  debounce?: number;
  /** External loading flag for async data. Drives the live-region announcement. */
  loading?: boolean;
```
Add to `AutocompleteApi<T>` (after `listId` and before `getInputProps`):
```ts
  /** Stable id of the listbox element, used to wire `aria-controls`/`aria-activedescendant`. */
  listId: string;
  /** Screen-reader announcement string (result count / no-results / loading). */
  announcement: string;
  /** Props for a visually-hidden polite live region. */
  getLiveRegionProps: () => {
    role: "status";
    "aria-live": "polite";
    "aria-atomic": true;
  };
```

In `src/core/use-autocomplete.ts`, add `loading = false` to the destructured options:
```ts
    defaultValue = null,
    debounce = 0,
    loading = false,
  } = options;
```
Add the announcement derivation right before the `getters` call (after `getItemIdCb`):
```ts
  const announcement = loading
    ? "Loading…"
    : !isOpen
      ? ""
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;
```

- [ ] **Step 4: Add `getLiveRegionProps` to the prop-getters**

In `src/core/prop-getters.ts`, add to the object returned by `createPropGetters` (after `getListProps`):
```ts
    getListProps: () => ({ id: state.listId, role: "listbox" as const }),
    getLiveRegionProps: () => ({
      role: "status" as const,
      "aria-live": "polite" as const,
      "aria-atomic": true as const,
    }),
```

Return `announcement` from the hook. In `src/core/use-autocomplete.ts`, add it to the returned object (after `listId,`):
```ts
    getItemId: getItemIdCb,
    listId,
    announcement,
    ...getters,
```

- [ ] **Step 5: Run core test to verify it passes**

Run: `bun test src/core/use-autocomplete.test.tsx && bun run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Write the failing primitive test**

Add to `src/primitives/combobulate.test.tsx`:
```tsx
test("LiveRegion renders the announcement in a polite status region", () => {
  render(<Demo />);
  const region = screen.getByRole("status");
  expect(region.getAttribute("aria-live")).toBe("polite");
  expect(region.textContent).toBe("3 results"); // Demo has 3 items, defaultOpen
});
```
Then add `<Combobulate.LiveRegion />` inside the existing `Demo` component's `<Combobulate.Root>` (after `</Combobulate.List>`):
```tsx
      </Combobulate.List>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
```

- [ ] **Step 7: Run test to verify it fails**

Run: `bun test src/primitives/combobulate.test.tsx`
Expected: FAIL — `Combobulate.LiveRegion` is not a component / no `status` role found.

- [ ] **Step 8: Add the `LiveRegion` primitive**

In `src/primitives/combobulate.tsx`, add before the `Combobulate` export:
```tsx
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
```
Change the export to include it:
```tsx
export const Combobulate = { Root, Input, List, Item, Empty, LiveRegion };
```

- [ ] **Step 9: Run tests + lint to verify green**

Run: `bun test src/ && bun run typecheck && bun run lint`
Expected: PASS; typecheck + lint clean.

- [ ] **Step 10: Commit**

```bash
git add src/core/ src/primitives/combobulate.tsx src/primitives/combobulate.test.tsx
git commit -m "feat: add loading-aware live region (announcement + getLiveRegionProps + LiveRegion)"
```

---

### Task 3: Tree utils — pure flatten / ancestors / visible-rows / descendant-leaves

**Files:**
- Create: `src/tree/tree-utils.ts`, `src/tree/tree-utils.test.ts`

**Interfaces:**
- Consumes: `normalizeText` from `src/core/item-utils.ts`.
- Produces:
  - `interface FlatNode<T> { item: T; id: string; parentId: string | null; depth: number; hasChildren: boolean }`
  - `interface VisibleRow<T> extends FlatNode<T> { expanded: boolean }`
  - `flattenTree<T>(nodes, getChildren, getItemId): FlatNode<T>[]`
  - `collectAncestorIds<T>(flat, ids: Set<string>): Set<string>`
  - `collectDescendantLeafIds<T>(flat, nodeId: string): string[]`
  - `computeVisibleRows<T>(flat, expandedIds, query, getSearchText): VisibleRow<T>[]`

- [ ] **Step 1: Write the failing test**

`src/tree/tree-utils.test.ts`:
```ts
import { expect, test } from "bun:test";
import {
  collectAncestorIds,
  collectDescendantLeafIds,
  computeVisibleRows,
  flattenTree,
} from "./tree-utils";

interface Node {
  id: string;
  label: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    id: "fruit",
    label: "Fruit",
    children: [
      { id: "apple", label: "Apple" },
      { id: "citrus", label: "Citrus", children: [{ id: "orange", label: "Orange" }] },
    ],
  },
  { id: "veg", label: "Vegetable", children: [{ id: "carrot", label: "Carrot" }] },
];

const getChildren = (n: Node) => n.children;
const getItemId = (n: Node) => n.id;
const getSearchText = (n: Node) => n.label;

test("flattenTree walks depth-first with depth/parentId/hasChildren", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  expect(flat.map((f) => f.id)).toEqual(["fruit", "apple", "citrus", "orange", "veg", "carrot"]);
  const orange = flat.find((f) => f.id === "orange")!;
  expect(orange.depth).toBe(2);
  expect(orange.parentId).toBe("citrus");
  expect(orange.hasChildren).toBe(false);
  expect(flat.find((f) => f.id === "citrus")!.hasChildren).toBe(true);
});

test("collectAncestorIds returns all ancestors of the given ids", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  expect([...collectAncestorIds(flat, new Set(["orange"]))].sort()).toEqual(["citrus", "fruit"]);
});

test("collectDescendantLeafIds returns only leaf descendants", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  expect(collectDescendantLeafIds(flat, "fruit").sort()).toEqual(["apple", "orange"]);
});

test("computeVisibleRows hides collapsed subtrees (no query)", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  const rows = computeVisibleRows(flat, new Set(["fruit"]), "", getSearchText);
  // fruit expanded → apple, citrus visible; citrus collapsed → orange hidden; veg collapsed
  expect(rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
  expect(rows.find((r) => r.id === "fruit")!.expanded).toBe(true);
  expect(rows.find((r) => r.id === "citrus")!.expanded).toBe(false);
});

test("computeVisibleRows keeps matches plus ancestors and auto-expands", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  const rows = computeVisibleRows(flat, new Set(), "orange", getSearchText);
  expect(rows.map((r) => r.id)).toEqual(["fruit", "citrus", "orange"]);
  expect(rows.find((r) => r.id === "citrus")!.expanded).toBe(true); // ancestor force-expanded
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tree/tree-utils.test.ts`
Expected: FAIL — cannot find module `./tree-utils`.

- [ ] **Step 3: Write the implementation**

`src/tree/tree-utils.ts`:
```ts
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
  return flat
    .filter((f) => keepSet.has(f.id))
    .map((f) => ({ ...f, expanded: f.hasChildren }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/tree/tree-utils.test.ts && bun run typecheck`
Expected: PASS (5 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/tree/tree-utils.ts src/tree/tree-utils.test.ts
git commit -m "feat: add pure tree utils (flatten, ancestors, visible rows, descendant leaves)"
```

---

### Task 4: `useTree` — expansion state, visible rows, expand/collapse/toggle

**Files:**
- Create: `src/tree/types.ts`, `src/tree/use-tree.ts`, `src/tree/use-tree.test.tsx`

**Interfaces:**
- Consumes: `flattenTree`, `computeVisibleRows` (Task 3); `defaultGetSearchText` from `src/core/item-utils.ts`; `AutocompleteVirtualApi` from `src/core/use-autocomplete-virtual.ts`.
- Produces (this task; keyboard + aggregate added in Tasks 5-6):
  - `interface TreeRow<T> { item: T; id: string; parentId: string | null; depth: number; hasChildren: boolean; expanded: boolean }`
  - `type TreeCombo<T> = Pick<AutocompleteVirtualApi<T>, "activeIndex" | "setActiveIndex" | "selectedItems" | "setSelectedItems" | "getInputProps">`
  - `interface UseTreeOptions<T> { nodes; getChildren; getItemId; getSearchText?; query?; defaultExpandedIds?; expandedIds?; onExpandedChange?; aggregateSelectAll? }`
  - `interface TreeApi<T> { items: T[]; rows: TreeRow<T>[]; expandedIds: Set<string>; expand; collapse; toggle; composeKeyDown; toggleAllUnder; getAggregateState }`
  - `useTree<T>(options): TreeApi<T>` — this task implements `items`, `rows`, `expandedIds`, `expand`, `collapse`, `toggle` (the other three are stubbed until Tasks 5-6).

- [ ] **Step 1: Write `src/tree/types.ts`**

```ts
import type { KeyboardEvent } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";

/** A visible tree row: the source item plus its structural + expansion metadata. */
export interface TreeRow<T> {
  item: T;
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

/** The slice of the composed combo api the tree helpers read at call time. */
export type TreeCombo<T> = Pick<
  AutocompleteVirtualApi<T>,
  "activeIndex" | "setActiveIndex" | "selectedItems" | "setSelectedItems" | "getInputProps"
>;

/** Options for {@link useTree}. */
export interface UseTreeOptions<T> {
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
}

/** Public api returned by {@link useTree}. */
export interface TreeApi<T> {
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
}
```

- [ ] **Step 2: Write the failing test**

`src/tree/use-tree.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTree } from "./use-tree";

interface Node {
  id: string;
  label: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    id: "fruit",
    label: "Fruit",
    children: [
      { id: "apple", label: "Apple" },
      { id: "citrus", label: "Citrus", children: [{ id: "orange", label: "Orange" }] },
    ],
  },
  { id: "veg", label: "Vegetable", children: [{ id: "carrot", label: "Carrot" }] },
];

const base = {
  nodes: TREE,
  getChildren: (n: Node) => n.children,
  getItemId: (n: Node) => n.id,
  getSearchText: (n: Node) => n.label,
};

test("collapsed by default shows only roots", () => {
  const { result } = renderHook(() => useTree(base));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg"]);
  expect(result.current.items.map((i) => i.id)).toEqual(["fruit", "veg"]);
});

test("expand reveals children; collapse hides them", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
  act(() => result.current.collapse("fruit"));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg"]);
  act(() => result.current.expand("fruit"));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
});

test("toggle flips expansion and notifies onExpandedChange", () => {
  let last: Set<string> | undefined;
  const { result } = renderHook(() =>
    useTree({ ...base, onExpandedChange: (ids) => (last = ids) }),
  );
  act(() => result.current.toggle("veg"));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg", "carrot"]);
  expect(last?.has("veg")).toBe(true);
});

test("controlled expandedIds ignores internal toggle", () => {
  const { result } = renderHook(() => useTree({ ...base, expandedIds: ["fruit"] }));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
  act(() => result.current.collapse("fruit"));
  // controlled: no onExpandedChange handler updates the prop, so it stays expanded
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
});

test("query filters to matches plus ancestors and auto-expands", () => {
  const { result } = renderHook(() => useTree({ ...base, query: "orange" }));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "citrus", "orange"]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/tree/use-tree.test.tsx`
Expected: FAIL — cannot find module `./use-tree`.

- [ ] **Step 4: Write the implementation (keyboard + aggregate stubbed)**

`src/tree/use-tree.ts`:
```ts
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

  const applyExpanded = useCallback(
    (next: Set<string>) => {
      if (!isControlled) setUncontrolled(next);
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  const expandedRef = useRef(expandedIds);
  expandedRef.current = expandedIds;

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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/tree/use-tree.test.tsx && bun run typecheck`
Expected: PASS (5 tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/tree/types.ts src/tree/use-tree.ts src/tree/use-tree.test.tsx
git commit -m "feat: add useTree expansion state, visible rows, expand/collapse/toggle"
```

---

### Task 5: `useTree` — `←`/`→` keyboard via `composeKeyDown`

**Files:**
- Modify: `src/tree/use-tree.ts` (implement `composeKeyDown`)
- Test: `src/tree/use-tree.test.tsx` (add keyboard tests)

**Interfaces:**
- Consumes: `TreeCombo<T>` (Task 4).
- Produces: `composeKeyDown(combo)` returns a handler where, on the active row:
  - `ArrowRight`: `hasChildren && !expanded` → expand; `hasChildren && expanded` → `setActiveIndex(activeIndex + 1)` (into first child). `preventDefault`.
  - `ArrowLeft`: `hasChildren && expanded` → collapse; else → move active to the parent row's index. `preventDefault`.
  - Any other key → delegate to `combo.getInputProps().onKeyDown(event)`.

- [ ] **Step 1: Write the failing tests**

Add to `src/tree/use-tree.test.tsx`:
```tsx
import type { KeyboardEvent } from "react";

function fakeCombo(rows: { id: string }[], activeIndex: number) {
  const calls: { setActiveIndex: number[]; coreKeys: string[] } = {
    setActiveIndex: [],
    coreKeys: [],
  };
  const combo = {
    activeIndex,
    setActiveIndex: (i: number) => calls.setActiveIndex.push(i),
    selectedItems: [] as unknown[],
    setSelectedItems: () => {},
    getInputProps: () => ({
      onKeyDown: (e: KeyboardEvent) => calls.coreKeys.push(e.key),
    }),
  };
  return { combo, calls };
}

function key(k: string): KeyboardEvent {
  let prevented = false;
  return {
    key: k,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent;
}

test("ArrowRight on a collapsed parent expands it", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: [] }));
  const { combo } = fakeCombo(result.current.rows, 0); // active = "fruit" (collapsed parent)
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowRight")));
  expect(result.current.rows.map((r) => r.id)).toContain("apple");
});

test("ArrowRight on an expanded parent moves into the first child", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  const { combo, calls } = fakeCombo(result.current.rows, 0); // active = "fruit" (expanded)
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowRight")));
  expect(calls.setActiveIndex).toEqual([1]);
});

test("ArrowLeft on an expanded parent collapses it", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  const { combo } = fakeCombo(result.current.rows, 0);
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowLeft")));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg"]);
});

test("ArrowLeft on a child moves active to its parent index", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  // rows: fruit(0), apple(1), citrus(2), veg(3); active = apple(1), parent fruit(0)
  const { combo, calls } = fakeCombo(result.current.rows, 1);
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowLeft")));
  expect(calls.setActiveIndex).toEqual([0]);
});

test("non-arrow keys delegate to the core handler", () => {
  const { result } = renderHook(() => useTree(base));
  const { combo, calls } = fakeCombo(result.current.rows, 0);
  act(() => result.current.composeKeyDown(combo as never)(key("Enter")));
  expect(calls.coreKeys).toEqual(["Enter"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/tree/use-tree.test.tsx`
Expected: FAIL — the stub `composeKeyDown` only delegates, so expand/collapse/setActiveIndex expectations fail.

- [ ] **Step 3: Implement `composeKeyDown`**

In `src/tree/use-tree.ts`, add a rows ref after the `rows` memo:
```ts
  const items = useMemo(() => rows.map((r) => r.item), [rows]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
```
Replace the stubbed `composeKeyDown` with:
```ts
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
```

- [ ] **Step 4: Run tests to verify green**

Run: `bun test src/tree/use-tree.test.tsx && bun run typecheck`
Expected: PASS (all tree tests).

- [ ] **Step 5: Commit**

```bash
git add src/tree/use-tree.ts src/tree/use-tree.test.tsx
git commit -m "feat: add ←/→ tree keyboard navigation to useTree"
```

---

### Task 6: `useTree` — aggregate "select all under node"

**Files:**
- Modify: `src/tree/use-tree.ts` (implement `toggleAllUnder` + `getAggregateState`)
- Test: `src/tree/use-tree.test.tsx` (add aggregate tests)

**Interfaces:**
- Consumes: `collectDescendantLeafIds` (Task 3); `TreeCombo<T>` bulk selection (`selectedItems`, `setSelectedItems`); `getItemId`.
- Produces:
  - `getAggregateState(combo, nodeId)`: `"checked"` if all descendant-leaf ids are selected, `"unchecked"` if none, else `"indeterminate"`. A node with no descendant leaves is `"unchecked"`.
  - `toggleAllUnder(combo, nodeId)`: if `"checked"` → remove all descendant-leaf items from `combo.selectedItems`; else → add all missing descendant-leaf items. Applies via `combo.setSelectedItems(next)`.

- [ ] **Step 1: Write the failing tests**

Add to `src/tree/use-tree.test.tsx`:
```tsx
function selectionCombo(initial: Node[]) {
  const state = { selectedItems: initial };
  const combo = {
    activeIndex: -1,
    setActiveIndex: () => {},
    selectedItems: state.selectedItems,
    setSelectedItems: (next: Node[]) => {
      state.selectedItems = next;
      combo.selectedItems = next;
    },
    getInputProps: () => ({ onKeyDown: () => {} }),
  };
  return combo;
}

test("getAggregateState reflects descendant-leaf selection", () => {
  const { result } = renderHook(() => useTree({ ...base, aggregateSelectAll: true }));
  const apple = TREE[0].children![0];
  const orange = TREE[0].children![1].children![0];
  const none = selectionCombo([]);
  expect(result.current.getAggregateState(none as never, "fruit")).toBe("unchecked");
  const some = selectionCombo([apple]);
  expect(result.current.getAggregateState(some as never, "fruit")).toBe("indeterminate");
  const all = selectionCombo([apple, orange]);
  expect(result.current.getAggregateState(all as never, "fruit")).toBe("checked");
});

test("toggleAllUnder adds all missing descendant leaves", () => {
  const { result } = renderHook(() => useTree({ ...base, aggregateSelectAll: true }));
  const combo = selectionCombo([]);
  act(() => result.current.toggleAllUnder(combo as never, "fruit"));
  expect(combo.selectedItems.map((n) => n.id).sort()).toEqual(["apple", "orange"]);
});

test("toggleAllUnder clears descendant leaves when already fully selected", () => {
  const { result } = renderHook(() => useTree({ ...base, aggregateSelectAll: true }));
  const apple = TREE[0].children![0];
  const orange = TREE[0].children![1].children![0];
  const carrot = TREE[1].children![0];
  const combo = selectionCombo([apple, orange, carrot]);
  act(() => result.current.toggleAllUnder(combo as never, "fruit"));
  // fruit's leaves removed; carrot (under veg) untouched
  expect(combo.selectedItems.map((n) => n.id)).toEqual(["carrot"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/tree/use-tree.test.tsx`
Expected: FAIL — stubs return `"unchecked"` / do nothing.

- [ ] **Step 3: Implement the aggregate helpers**

In `src/tree/use-tree.ts`, update the import from `./tree-utils`:
```ts
import { collectDescendantLeafIds, computeVisibleRows, flattenTree } from "./tree-utils";
```
Add a flat ref after the `flat` memo:
```ts
  const flat = useMemo(
    () => flattenTree(nodes, getChildren, getItemId),
    [nodes, getChildren, getItemId],
  );

  const flatRef = useRef(flat);
  flatRef.current = flat;
```
Replace the stubbed `toggleAllUnder` and `getAggregateState` with:
```ts
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
        combo.setSelectedItems(
          combo.selectedItems.filter((item) => !leafIds.has(getItemId(item))),
        );
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
```

- [ ] **Step 4: Run tests to verify green**

Run: `bun test src/tree/ && bun run typecheck`
Expected: PASS (all tree tests).

- [ ] **Step 5: Commit**

```bash
git add src/tree/use-tree.ts src/tree/use-tree.test.tsx
git commit -m "feat: add aggregate select-all-under-node helpers to useTree"
```

---

### Task 7: Tree primitives — `<Combobulate.Tree>` / `<Combobulate.TreeItem>`

**Files:**
- Create: `src/tree/tree-context.ts`, `src/tree/tree-primitives.tsx`, `src/tree/tree-primitives.test.tsx`

**Interfaces:**
- Consumes: `useCombobulateContext` from `src/primitives/context.ts` (the combo api); `TreeApi<T>`, `TreeRow<T>` (Task 4).
- Produces:
  - `TreeProvider` / `useTreeContext<T>()` (context carrying the `TreeApi<T>`).
  - `Tree<T>({ tree, children, style })` — renders a `role="tree"` virtualized container; `children` is a render-prop `(item: T, index: number) => ReactNode`.
  - `TreeItem<T>({ item, index, children })` — merges `combo.getItemProps` with `role="treeitem"` + `aria-level`/`aria-expanded` + `data-depth`/`data-expanded`.
  - `AggregateCheckbox<T>({ nodeId })` — a `role="checkbox"` tri-state control wired to the tree's aggregate helpers.

- [ ] **Step 1: Write `src/tree/tree-context.ts`**

```ts
import { createContext, useContext } from "react";
import type { TreeApi } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: context is generic over item type
const TreeContext = createContext<TreeApi<any> | null>(null);

/** Provider for the tree primitive subtree. */
export const TreeProvider = TreeContext.Provider;

/** Read the active tree api from context. Throws outside `<Combobulate.Tree>`. */
export function useTreeContext<T>(): TreeApi<T> {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("Tree primitives must be used within <Combobulate.Tree>");
  return ctx;
}
```

- [ ] **Step 2: Write the failing test**

`src/tree/tree-primitives.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "../primitives/combobulate";
import { Tree, TreeItem, AggregateCheckbox } from "./tree-primitives";
import { useTree } from "./use-tree";

interface Node {
  id: string;
  label: string;
  children?: Node[];
}
const TREE: Node[] = [
  { id: "fruit", label: "Fruit", children: [{ id: "apple", label: "Apple" }] },
];

function Demo() {
  const tree = useTree({
    nodes: TREE,
    getChildren: (n) => n.children,
    getItemId: (n) => n.id,
    getSearchText: (n) => n.label,
    defaultExpandedIds: ["fruit"],
    aggregateSelectAll: true,
  });
  const combo = useAutocompleteVirtual({
    items: tree.items,
    getItemId: (n: Node) => n.id,
    filterItems: (items) => items,
    multiple: true,
    defaultOpen: true,
  });
  return (
    <Combobulate.Root api={combo}>
      <Combobulate.Input aria-label="Food" />
      <Tree tree={tree}>
        {(item: Node, index: number) => (
          <TreeItem item={item} index={index}>
            {item.children ? <AggregateCheckbox nodeId={item.id} /> : null}
            <span>{item.label}</span>
          </TreeItem>
        )}
      </Tree>
    </Combobulate.Root>
  );
}

test("renders role=tree with treeitems carrying aria-level and data-depth", () => {
  render(<Demo />);
  expect(screen.getByRole("tree")).toBeDefined();
  const items = screen.getAllByRole("treeitem");
  expect(items.length).toBeGreaterThan(0);
  const fruit = items[0];
  expect(fruit.getAttribute("aria-level")).toBe("1");
  expect(fruit.getAttribute("aria-expanded")).toBe("true");
  expect(fruit.getAttribute("data-depth")).toBe("0");
});

test("aggregate checkbox exposes a tri-state role=checkbox", () => {
  render(<Demo />);
  const checkbox = screen.getByRole("checkbox");
  expect(checkbox.getAttribute("aria-checked")).toBe("false"); // nothing selected yet
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/tree/tree-primitives.test.tsx`
Expected: FAIL — cannot find module `./tree-primitives`.

- [ ] **Step 4: Write `src/tree/tree-primitives.tsx`**

```tsx
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
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard reaches this via the tree's ←/→ + the row; the control is a supplementary pointer affordance
    <span
      role="checkbox"
      aria-checked={ariaChecked}
      data-indeterminate={state === "indeterminate" ? "" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        tree.toggleAllUnder(api, nodeId);
      }}
    />
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/tree/tree-primitives.test.tsx && bun run typecheck && bun run lint`
Expected: PASS; typecheck + lint clean.

> Note: if `screen.getByRole("tree")` throws because happy-dom needs virtualizer layout, the existing `src/test-utils/stub-element-layout.ts` helper (used by the core virtual tests) stubs element layout — import and apply it in this test's module the same way `use-autocomplete-virtual.test.tsx` does.

- [ ] **Step 6: Commit**

```bash
git add src/tree/tree-context.ts src/tree/tree-primitives.tsx src/tree/tree-primitives.test.tsx
git commit -m "feat: add Tree/TreeItem/AggregateCheckbox primitives with treeitem ARIA"
```

---

### Task 8: `<NestedAutocomplete>` preset + tree styles + package exports

**Files:**
- Create: `src/presets/nested-autocomplete.tsx`, `src/presets/nested-autocomplete.test.tsx`
- Modify: `src/presets/styles.css` (tree selectors)
- Modify: `src/index.ts` (export tree hook/types/primitives/preset; augment `Combobulate` namespace)

**Interfaces:**
- Consumes: `useTree`, `Tree`/`TreeItem`/`AggregateCheckbox`, `useAutocompleteVirtual`, base `Combobulate`.
- Produces:
  - `NestedAutocomplete<T>(props: NestedAutocompleteProps<T>)` per the spec §3.7 signature.
  - Augmented `Combobulate` (package export) = base `{ Root, Input, List, Item, Empty, LiveRegion }` + `{ Tree, TreeItem, AggregateCheckbox }`.
  - New package exports: `useTree`, `TreeApi`, `TreeRow`, `UseTreeOptions`, `NestedAutocomplete`, `NestedAutocompleteProps`.

- [ ] **Step 1: Write the failing test**

`src/presets/nested-autocomplete.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NestedAutocomplete } from "./nested-autocomplete";

interface Node {
  id: string;
  label: string;
  children?: Node[];
}
const TREE: Node[] = [
  {
    id: "fruit",
    label: "Fruit",
    children: [
      { id: "apple", label: "Apple" },
      { id: "orange", label: "Orange" },
    ],
  },
];

test("filtering a nested tree keeps the matched leaf with its ancestor", async () => {
  const user = userEvent.setup();
  render(
    <NestedAutocomplete
      nodes={TREE}
      getChildren={(n) => n.children}
      getItemId={(n) => n.id}
      getSearchText={(n) => n.label}
      placeholder="Food"
    />,
  );
  const input = screen.getByRole("combobox");
  await user.type(input, "orange");
  const labels = screen.getAllByRole("treeitem").map((el) => el.textContent);
  expect(labels).toEqual(["Fruit", "Orange"]); // ancestor kept, apple filtered out
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/presets/nested-autocomplete.test.tsx`
Expected: FAIL — cannot find module `./nested-autocomplete`.

- [ ] **Step 3: Write `src/presets/nested-autocomplete.tsx`**

```tsx
import { type ReactNode, useState } from "react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "../primitives/combobulate";
import { AggregateCheckbox, Tree, TreeItem } from "../tree/tree-primitives";
import type { TreeRow } from "../tree/types";
import { useTree } from "../tree/use-tree";

/** Props for the batteries-included {@link NestedAutocomplete} preset. */
export interface NestedAutocompleteProps<T> {
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
}

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
  const label = (item: T, meta: TreeRow<T>) =>
    renderItem
      ? renderItem(item, meta)
      : getSearchText
        ? getSearchText(item)
        : String(item);
  return (
    <div className="cbl-root">
      <Combobulate.Root api={combo}>
        <Combobulate.Input
          className="cbl-input"
          placeholder={placeholder}
          onKeyDown={tree.composeKeyDown(combo)}
        />
        <Tree tree={tree}>
          {(item: T, index: number) => {
            const meta = tree.rows[index];
            return (
              <TreeItem item={item} index={index}>
                <div className="cbl-treeitem" style={{ paddingLeft: 12 + (meta?.depth ?? 0) * 16 }}>
                  {meta?.hasChildren ? (
                    <button
                      type="button"
                      className="cbl-chevron"
                      aria-label={meta.expanded ? "Collapse" : "Expand"}
                      onClick={(event) => {
                        event.stopPropagation();
                        tree.toggle(meta.id);
                      }}
                    >
                      {meta.expanded ? "▾" : "▸"}
                    </button>
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
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}
```

- [ ] **Step 4: Add tree styles to `src/presets/styles.css`**

Append:
```css
.cbl-tree {
  position: relative;
}

.cbl-treeitem {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
}

[data-active] .cbl-treeitem {
  background: #e2e8f0;
}

[data-selected] .cbl-treeitem-label {
  font-weight: 600;
}

.cbl-chevron {
  border: 0;
  background: none;
  cursor: pointer;
  padding: 0;
  width: 16px;
  line-height: 1;
}

[role="checkbox"][data-indeterminate] {
  opacity: 0.6;
}
```

- [ ] **Step 5: Wire package exports and augment the namespace**

In `src/index.ts`, replace the primitives/preset export block so the package-level `Combobulate` includes the tree primitives:
```ts
export { VERSION } from "./internal/version";
export { useAutocomplete } from "./core/use-autocomplete";
export type { AutocompleteApi, UseAutocompleteOptions } from "./core/types";
export { useAutocompleteVirtual } from "./core/use-autocomplete-virtual";
export type {
  AutocompleteVirtualApi,
  UseAutocompleteVirtualOptions,
} from "./core/use-autocomplete-virtual";
import { Combobulate as CombobulateBase } from "./primitives/combobulate";
import { AggregateCheckbox, Tree, TreeItem } from "./tree/tree-primitives";
/** Headless Combobulate primitives (base + tree layer). */
export const Combobulate = { ...CombobulateBase, Tree, TreeItem, AggregateCheckbox };
export type {
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./primitives/combobulate";
export type { TreeItemProps, TreeProps, AggregateCheckboxProps } from "./tree/tree-primitives";
export { useTree } from "./tree/use-tree";
export type { TreeApi, TreeRow, TreeCombo, UseTreeOptions } from "./tree/types";
export { Autocomplete } from "./presets/autocomplete";
export type { AutocompleteProps } from "./presets/autocomplete";
export { NestedAutocomplete } from "./presets/nested-autocomplete";
export type { NestedAutocompleteProps } from "./presets/nested-autocomplete";
```

> Note: `src/index.ts` no longer re-exports `Combobulate` from `./primitives/combobulate`; it builds an augmented namespace. The base file keeps exporting its own `Combobulate` for the existing base primitives test.

- [ ] **Step 6: Run tests + typecheck + lint + build to verify green**

Run: `bun test src/ && bun run typecheck && bun run lint && bun run build`
Expected: PASS; `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/styles.css` present.

- [ ] **Step 7: Commit**

```bash
git add src/presets/nested-autocomplete.tsx src/presets/nested-autocomplete.test.tsx src/presets/styles.css src/index.ts
git commit -m "feat: add NestedAutocomplete preset, tree styles, and package exports"
```

---

### Task 9: Playground — nested-tree scenario + Playwright e2e

**Files:**
- Modify: `examples/playground/src/app.tsx` (add the nested-tree section)
- Create: `e2e/nested-tree.e2e.ts`

**Interfaces:**
- Consumes: `NestedAutocomplete` from the workspace `combobulate` package.
- Produces: a `data-testid="nested"` section over a large generated tree; e2e proving `role="tree"`, `aria-level`, `←`/`→` nav keeps `aria-activedescendant` mounted, and the aggregate control reports `aria-checked="mixed"`.

- [ ] **Step 1: Add the nested-tree scenario to the playground**

In `examples/playground/src/app.tsx`, add the import and a generated tree, and render a section. Replace the file's import line and add the tree data + section:
```tsx
import { Autocomplete, NestedAutocomplete } from "combobulate";

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

const NESTED: TreeNode[] = Array.from({ length: 50 }, (_, g) => ({
  id: `group-${g}`,
  label: `Group ${g}`,
  children: Array.from({ length: 40 }, (_, i) => ({
    id: `group-${g}-item-${i}`,
    label: `Group ${g} · Item ${i}`,
  })),
}));
```
Add this section inside the `<main>`, after the existing 10k section:
```tsx
      <section data-testid="nested">
        <h2>Virtualized nested tree (2,050 nodes)</h2>
        <NestedAutocomplete
          nodes={NESTED}
          getChildren={(n) => n.children}
          getItemId={(n) => n.id}
          getSearchText={(n) => n.label}
          placeholder="Search groups & items…"
          multiple
          selectAllUnder
        />
      </section>
```

- [ ] **Step 2: Verify it runs in the browser**

Run: `bun install && bun run dev`
Expected: Vite serves at `http://localhost:5173`; expanding a group reveals items; typing filters to matches + their group; only a window of `[role=treeitem]` nodes is mounted.

- [ ] **Step 3: Write the e2e**

`e2e/nested-tree.e2e.ts`:
```ts
import { expect, test } from "@playwright/test";

test("nested tree exposes role=tree and expandable treeitems", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("nested").getByRole("combobox");
  await input.click();
  await expect(page.getByTestId("nested").getByRole("tree")).toBeVisible();
  const first = page.getByTestId("nested").getByRole("treeitem").first();
  await expect(first).toHaveAttribute("aria-level", "1");
});

test("→/↓ keyboard nav keeps aria-activedescendant mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("nested").getByRole("combobox");
  await input.click();
  await input.press("ArrowDown"); // active first row
  await input.press("ArrowRight"); // expand first group
  for (let i = 0; i < 20; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  await expect(page.locator(`#${CSS.escape(activeId as string)}`)).toHaveCount(1);
});

test("select-all-under-node control reports a mixed state", async ({ page }) => {
  await page.goto("/");
  const nested = page.getByTestId("nested");
  await nested.getByRole("combobox").click();
  await nested.getByRole("combobox").press("ArrowDown");
  await nested.getByRole("combobox").press("ArrowRight"); // expand first group
  // select one leaf, then the group's aggregate should be mixed
  await nested.getByRole("treeitem").nth(1).click();
  const checkbox = nested.getByRole("checkbox").first();
  await expect(checkbox).toHaveAttribute("aria-checked", "mixed");
});
```

- [ ] **Step 4: Run the e2e to verify green**

Run: `bun run e2e e2e/nested-tree.e2e.ts`
Expected: all three tests PASS. (If the active-descendant test fails, the tree keyboard/virtualization bridge regressed.)

- [ ] **Step 5: Commit**

```bash
git add examples/playground/src/app.tsx e2e/nested-tree.e2e.ts
git commit -m "test: add nested-tree playground scenario and Playwright e2e"
```

---

### Task 10: Playground — dynamic row heights scenario + e2e

**Files:**
- Modify: `examples/playground/src/app.tsx` (add the dynamic-height section)
- Create: `e2e/dynamic-heights.e2e.ts`

**Interfaces:**
- Consumes: `Autocomplete` (the linear preset already measures rows via `virtualizer.measureElement`).
- Produces: a `data-testid="dynamic"` section over variable-height items; e2e proving keyboard nav to an off-screen row keeps `aria-activedescendant` mounted despite measured heights.

- [ ] **Step 1: Add the dynamic-height scenario**

In `examples/playground/src/app.tsx`, add the data and a section. Add near the other datasets:
```tsx
const VARIABLE = Array.from({ length: 2000 }, (_, i) => ({
  id: `v-${i}`,
  label:
    i % 3 === 0
      ? `Item ${i} — a longer, multi-line label that wraps across two or three lines to force a taller measured row height under virtualization`
      : `Item ${i}`,
}));
```
Add the section inside `<main>`:
```tsx
      <section data-testid="dynamic">
        <h2>Dynamic (measured) row heights</h2>
        <Autocomplete
          items={VARIABLE}
          getSearchText={(n) => n.label}
          getItemId={(n) => n.id}
          renderItem={(n) => n.label}
          estimateSize={() => 40}
          placeholder="Search variable-height rows…"
        />
      </section>
```

> Note: `Autocomplete`'s `getItemId` is forwarded to `useAutocompleteVirtual`; the current `AutocompleteProps` does not yet expose `getItemId`. If typecheck flags `getItemId`, add `getItemId?: (item: T) => string;` to `AutocompleteProps` in `src/presets/autocomplete.tsx` and pass it through to `useAutocompleteVirtual` (a one-line, tree-unaware pass-through), then re-run `bun run build`.

- [ ] **Step 2: Verify it runs**

Run: `bun run dev`
Expected: the dynamic section scrolls smoothly; taller rows occupy more vertical space; only a window of options is mounted.

- [ ] **Step 3: Write the e2e**

`e2e/dynamic-heights.e2e.ts`:
```ts
import { expect, test } from "@playwright/test";

test("keyboard nav across measured rows keeps aria-activedescendant mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("dynamic").getByRole("combobox");
  await input.click();
  for (let i = 0; i < 50; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  const active = page.locator(`#${CSS.escape(activeId as string)}`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});
```

- [ ] **Step 4: Run the e2e to verify green**

Run: `bun run e2e e2e/dynamic-heights.e2e.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add examples/playground/src/app.tsx e2e/dynamic-heights.e2e.ts src/presets/autocomplete.tsx
git commit -m "test: add dynamic-height playground scenario and e2e"
```

---

### Task 11: Playground — fuzzy + async scenarios + e2e

**Files:**
- Modify: `examples/playground/package.json` (add `fuse.js` dependency)
- Modify: `examples/playground/src/app.tsx` (add `fuzzy` + `async` sections)
- Create: `e2e/fuzzy-async.e2e.ts`

**Interfaces:**
- Consumes: `Autocomplete` with an injected `filterItems` (Fuse.js) and the core `loading` option (surfaced through a small local wrapper). Fuse.js is a **playground-only** dependency — never added to the library package.
- Produces: `data-testid="fuzzy"` and `data-testid="async"` sections; e2e proving fuzzy matches appear and the async live region announces loading → results.

- [ ] **Step 1: Add Fuse.js to the playground**

In `examples/playground/package.json`, add to `dependencies`:
```json
  "dependencies": {
    "combobulate": "workspace:*",
    "fuse.js": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
```
Run: `bun install`

- [ ] **Step 2: Add the fuzzy scenario**

In `examples/playground/src/app.tsx`, add the import and section:
```tsx
import Fuse from "fuse.js";

const CITIES = [
  "Amsterdam", "Barcelona", "Copenhagen", "Dublin", "Edinburgh",
  "Florence", "Geneva", "Helsinki", "Istanbul", "Lisbon",
];
const cityFuse = new Fuse(CITIES, { threshold: 0.4 });
const fuzzyFilter = (items: string[], query: string) =>
  query ? cityFuse.search(query).map((r) => r.item) : items;
```
Section:
```tsx
      <section data-testid="fuzzy">
        <h2>Fuzzy filtering (Fuse.js, injected)</h2>
        <Autocomplete items={CITIES} filterItems={fuzzyFilter} placeholder="Fuzzy city search…" />
      </section>
```

- [ ] **Step 3: Add the async scenario**

Add a small async wrapper component in `examples/playground/src/app.tsx` that drives `loading` through the core via `useAutocompleteVirtual` + primitives:
```tsx
import { useRef, useState } from "react";
import { Combobulate, useAutocompleteVirtual } from "combobulate";

const REMOTE = Array.from({ length: 200 }, (_, i) => `Result ${i}`);

/** Simulated remote-search combobox that toggles `loading` while "fetching". */
function AsyncCombobox() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const api = useAutocompleteVirtual({
    items,
    loading,
    filterItems: (list) => list,
    onInputChange: (query) => {
      if (timer.current) clearTimeout(timer.current);
      setLoading(true);
      timer.current = setTimeout(() => {
        setItems(query ? REMOTE.filter((r) => r.toLowerCase().includes(query.toLowerCase())) : []);
        setLoading(false);
      }, 300);
    },
  });
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input className="cbl-input" placeholder="Remote search…" />
      <Combobulate.List>
        {(item: string, index: number) => (
          <Combobulate.Item item={item} index={index}>
            <div className="cbl-option">{item}</div>
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  );
}
```
Section:
```tsx
      <section data-testid="async">
        <h2>Async / remote search with loading announcements</h2>
        <AsyncCombobox />
      </section>
```

- [ ] **Step 4: Verify both run**

Run: `bun run dev`
Expected: fuzzy search tolerates typos; async section shows results after a short delay; the hidden live region text switches to "Loading…" then "N results".

- [ ] **Step 5: Write the e2e**

`e2e/fuzzy-async.e2e.ts`:
```ts
import { expect, test } from "@playwright/test";

test("fuzzy search returns approximate matches", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("fuzzy").getByRole("combobox");
  await input.click();
  await input.fill("amstrdam"); // typo
  await expect(page.getByTestId("fuzzy").getByRole("option", { name: "Amsterdam" })).toBeVisible();
});

test("async search announces loading then results", async ({ page }) => {
  await page.goto("/");
  const async = page.getByTestId("async");
  const input = async.getByRole("combobox");
  await input.click();
  await input.fill("Result 1");
  await expect(async.getByRole("status")).toHaveText("Loading…");
  await expect(async.getByRole("status")).toContainText("results");
});
```

- [ ] **Step 6: Run the e2e to verify green**

Run: `bun run e2e e2e/fuzzy-async.e2e.ts`
Expected: both tests PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/playground/package.json examples/playground/src/app.tsx e2e/fuzzy-async.e2e.ts
git commit -m "test: add fuzzy (Fuse.js) and async playground scenarios and e2e"
```

---

### Task 12: README, package polish, and full pipeline

**Files:**
- Modify: `README.md` (nested + tree docs), `package.json` (keywords)

**Interfaces:**
- Produces: documented nested usage; a green full local pipeline.

- [ ] **Step 1: Expand `README.md`**

Add a "Nested tree" section after the existing `<Autocomplete>` section, containing:
- A one-line description of the tree layer as an opt-in composition on top of the tree-unaware core.
- This exact snippet:
```tsx
import { NestedAutocomplete } from "combobulate";
import "combobulate/styles.css";

<NestedAutocomplete
  nodes={nodes}
  getChildren={(n) => n.children}
  getItemId={(n) => n.id}
  getSearchText={(n) => n.label}
  multiple
  selectAllUnder
/>;
```
- A note that `useTree` is the headless hook (owns `expandedIds`, emits a flat visible list), that `←`/`→` expand/collapse, and that `selectAllUnder` adds a tri-state "select all under node" control (multi-select only).
- A link to `docs/superpowers/specs/2026-07-15-combobulate-tree-layer-design.md`.

- [ ] **Step 2: Update `package.json` keywords**

Add `"tree"` and `"nested"` to the `keywords` array:
```json
"keywords": ["autocomplete", "combobox", "headless", "virtualized", "accessible", "react", "tree", "nested"],
```

- [ ] **Step 3: Run the full local pipeline**

Run: `bun run lint && bun run typecheck && bun test && bun run build && bun run e2e`
Expected: all green — lint clean, typecheck clean, all unit tests pass, build emits `dist/*`, all e2e specs pass.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: document the tree layer and add tree/nested keywords"
```

---

## Self-Review

**Spec coverage (§ = spec section):**
- §1 scope A/B/C: Tasks 3-9 (A), 10 (B), 11 (C). ✓
- §2 locked decisions: filter-ownership mirror (Task 8 composer), ARIA merge (Task 7), aggregate affordance (Tasks 6-7), core additions (Tasks 1-2). ✓
- §3.1 `useTree` options: Task 4 `UseTreeOptions`. ✓
- §3.2 flatten + visible-list algorithm: Task 3 (`flattenTree`/`computeVisibleRows`), tested with/without query. ✓
- §3.3 aggregate affordance: Task 6 (`toggleAllUnder`/`getAggregateState`) + Task 7 (`AggregateCheckbox`). ✓
- §3.4 `TreeApi`/`TreeRow`/`TreeCombo`: Task 4 `types.ts`. ✓
- §3.5 composition (mirror + pass-through + composeKeyDown): Task 8 preset. ✓
- §3.6 tree primitives: Task 7. ✓
- §3.7 `<NestedAutocomplete>`: Task 8. ✓
- §4.1 bulk `setSelectedItems`: Task 1. §4.2 live region + `loading`: Task 2. ✓
- §5 dynamic heights: Task 10. §6 fuzzy + async: Task 11. ✓
- §7 testing (useTree unit / tree primitives unit / core additive unit / regression / e2e): Tasks 3-11. ✓
- §8 ordering: matches Task 1→12. ✓
- §9 API additions: exported in Task 8 (`Combobulate` augmented, `useTree`, types, `NestedAutocomplete`) + Tasks 1-2 (core additive). ✓

**Placeholder scan:** every code step shows complete code; every run step shows an exact command + expected result. No TBD/"similar to"/"handle edge cases". ✓

**Type consistency:** `TreeRow<T>` (no `kind`, no `item: T | null`) identical in Task 4 types, Task 3 `VisibleRow` (adds `expanded` to `FlatNode`), Task 7 primitives, Task 8 preset. `TreeCombo<T>` picks `activeIndex`/`setActiveIndex`/`selectedItems`/`setSelectedItems`/`getInputProps` — matches `composeKeyDown`/`toggleAllUnder`/`getAggregateState` usage in Tasks 5-6 and the primitive/preset call sites in Tasks 7-8. `setSelectedItems(items: T[])` signature identical in Task 1 (core) and Tasks 6-8 (consumers). `getAggregateState` returns `"checked" | "indeterminate" | "unchecked"` in Tasks 4/6, mapped to `aria-checked` `"true"|"mixed"|"false"` in Task 7. ✓

**Known follow-ups (from spec §10):** partial-branch aggregate policies; vanilla core extraction.
