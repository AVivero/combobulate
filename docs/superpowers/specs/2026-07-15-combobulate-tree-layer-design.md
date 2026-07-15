# Combobulate Tree Layer (Plan 2) — Design Spec

> **combobulate** — the headless toolkit for accessible, virtualized autocompletes.

**Date:** 2026-07-15
**Status:** Approved design → implementation planning
**Builds on:** `docs/superpowers/specs/2026-07-14-combobulate-design.md` (§4 tree layer, §8 scenarios 2–4)
**Predecessor plan:** `docs/superpowers/plans/2026-07-14-combobulate-foundation-core.md` (Foundation & Core, merged to `main`)

---

## 1. Purpose & scope

The Foundation & Core plan shipped the headless, accessible, virtualized **linear**
combobox (`useAutocomplete` / `useAutocompleteVirtual`, base primitives, `<Autocomplete>`
preset, 10k-item playground, e2e). It deliberately left the core **tree-unaware**.

Plan 2 snaps the **tree layer** on top — without touching the core — and completes the
remaining showcase scenarios. It delivers three independently-reviewable task groups:

- **A — Tree layer:** `useTree` (owns `expandedIds`, flatten-with-expansion, `←`/`→`
  keyboard, filter-to-matches-plus-ancestors, opt-in "select all under node" aggregate rows),
  `<Combobulate.Tree/TreeItem>` primitives, `<NestedAutocomplete>` preset, nested playground
  scenario + e2e.
- **B — Dynamic row heights:** a measured variable-height playground scenario + e2e. The
  `List` primitive already calls `virtualizer.measureElement`, so this is expected to be
  demo-only with **no core change**.
- **C — Fuzzy + async:** wire the already-threaded `loading` option, add a headless
  `aria-live` region (deferred from Plan 1; the natural home for loading/result-count
  announcements), a Fuse.js fuzzy demo, and a remote/`loading` demo + e2e.

### The lego rule (unchanged, load-bearing)

The core stays tree-unaware. `expandedIds`, `depth`, `parentId`, and tree concepts appear
**nowhere** in the core's API, types, or tests. Nesting is composed from smaller pieces; the
tree layer drives the core only through the core's public API. The **one** additive change to
the core hook in this plan — the `aria-live` announcement string + `getLiveRegionProps()` — is
generic (result counts, loading) and carries no tree awareness.

---

## 2. Locked design decisions (from brainstorming)

| Seam | Decision | Why |
|---|---|---|
| **Plan scope** | A + B + C in one plan, three task groups | Completes the design spec's tree + scenarios 2–4; groups stay independent via the lego boundary. |
| **Filter ownership** | Lift `inputValue` into the composer; tree owns matches-plus-ancestors filtering + auto-expand; core filters pass-through | Tree-aware filtering can't live in the core; lifting the query keeps hook ordering clean and prevents orphaned matches. |
| **ARIA composition** | Tree primitives merge ARIA at render; `useTree` stays pure | Core file is never touched; all tree ARIA lives in the tree primitive. |
| **Aggregate rows** | Included in Plan 2, as opt-in synthetic rows in the flat visible list | Because they are real entries in the flat list, virtualization / active-index nav / `aria-setsize`·`posinset` / `aria-activedescendant` all work for free. |
| **Live region** | Headless: core computes the announcement string; a `<LiveRegion>` primitive renders the node | Rounds out the a11y identity and feeds group C; additive and tree-unaware. |

---

## 3. Group A — the tree layer

### 3.1 `useTree<T>` — options

```ts
useTree<T>({
  nodes: T[],
  getChildren: (node: T) => T[] | undefined,
  getItemId: (node: T) => string,
  getSearchText?: (node: T) => string,   // defaults to core defaultGetSearchText
  query?: string,                        // lifted from the composer's input state
  defaultExpandedIds?: Iterable<string>, // uncontrolled initial expansion
  expandedIds?: Iterable<string>,        // controlled expansion
  onExpandedChange?: (ids: Set<string>) => void,
  aggregateSelectAll?: boolean,          // opt-in "select all under node" rows (multi-select only)
}): TreeApi<T>
```

- **`expandedIds: Set<string>` is the single source of truth** for open/closed — never
  "are children present in the array" (the old repo's fragile derivation). Controlled when
  `expandedIds` is passed; otherwise internal state seeded from `defaultExpandedIds`.
- **Stable, caller-derived ids** via `getItemId`. No computed path-ids. One id per node,
  used end to end.

### 3.2 Flatten & visible-list algorithm

- **`flatten(nodes)`** — depth-first walk producing the full `TreeRow<T>[]`:
  `{ item, id, parentId, depth, hasChildren }`. Memoized on `[nodes]`. The virtualizer only
  ever sees a flat list, so virtualization and trees compose cleanly.
- **Visible list derivation:**
  - **No query:** keep a row iff every ancestor id is in `expandedIds`.
  - **With query:** `matchSet` = ids whose normalized search text contains the normalized
    query; `keepSet` = `matchSet ∪ ancestors(matchSet)`; visible = rows in `keepSet` with
    ancestors **force-expanded**. A matched leaf keeps its context (fixes the "orphaned
    match" bug) and the path to it auto-expands.
  - Memoized; O(n) per relevant change.
- **Per-row `expanded`:** `query` present → `true` for kept ancestors; else `expandedIds.has(id)`.

### 3.3 Aggregate "select all under node" rows (opt-in)

When `aggregateSelectAll` is set (and the composed combo is multi-select), each **expandable**
node emits a synthetic first-child row:

- `kind: "aggregate"`, id is `parentId + "::__all__"`, `depth: parentDepth + 1`, `hasChildren: false`.
- It is a **real entry** in `items` / `rows`, so virtualization, active-index navigation,
  `aria-setsize`/`aria-posinset`, and `aria-activedescendant` require no special-casing.
- The synthetic sentinel is **never** added to `selectedItems`. The only special behavior is
  at the primitive layer (§3.6): its `onClick` calls `tree.toggleAllUnder(parentId)` instead
  of `combo.select`, and its checked state is derived.
- `toggleAllUnder(nodeId)`: if the aggregate state is `checked` → remove all descendant leaves
  from selection; otherwise → add all missing descendant leaves. Descendant-leaf ids come from
  the memoized flatten, so it is O(subtree).
- `getAggregateState(nodeId)`: `"checked"` (all descendant leaves selected) / `"indeterminate"`
  (some) / `"unchecked"` (none), derived from `combo.selectedItems`.

### 3.4 `TreeApi<T>` — output

```ts
interface TreeApi<T> {
  items: T[];                 // flat visible list → feeds useAutocomplete
  rows: TreeRow<T>[];         // index-aligned metadata (rows[i] ↔ items[i])
  expandedIds: Set<string>;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  toggle: (id: string) => void;
  composeKeyDown: (coreOnKeyDown: (e: KeyboardEvent) => void) => (e: KeyboardEvent) => void;
  toggleAllUnder: (nodeId: string) => void;
  getAggregateState: (nodeId: string) => "checked" | "indeterminate" | "unchecked";
}

interface TreeRow<T> {
  item: T;
  id: string;
  parentId: string | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  kind: "node" | "aggregate";
}
```

### 3.5 Composition & filtering — the lifted-`inputValue` shape

```ts
const [query, setQuery] = useState("");
const tree = useTree({ nodes, getChildren, getItemId, query, aggregateSelectAll: true });
const combo = useAutocompleteVirtual({
  items: tree.items,
  inputValue: query,               // controlled: input lives in the composer
  onInputChange: setQuery,
  filterItems: (items) => items,   // pass-through: tree already filtered; core never re-filters
  multiple: true,                  // aggregate rows imply multi-select
});
```

- **Hook ordering:** `useTree` needs the query and `useAutocomplete*` needs `tree.items`;
  lifting `inputValue` to the composer breaks the pull cleanly (both read the same `query`).
- **`←`/`→` composition:** `tree.composeKeyDown(combo.getInputProps().onKeyDown)` returns a
  merged handler (tree handles `←`/`→` with `preventDefault`; core handles `↑`/`↓`/Enter/Escape).
  Passed as the input's `onKeyDown` prop, it overrides the base getter's handler with the
  fully-composed one — so the base `<Combobulate.Input>` stays 100% tree-unaware.

### 3.6 Tree primitives — `<Combobulate.Tree>` / `<Combobulate.TreeItem>`

The base primitives (`Root/Input/List/Item/Empty`) are untouched and tree-unaware. A
`TreeProvider` carries `{ combo, tree }`; two new primitives read both.

- **`<Combobulate.Tree>`** — renders the virtualized scroll container like `<List>`, but stamps
  `role="tree"` (overriding `getListProps`'s `role="listbox"`) and `aria-multiselectable` when
  multi-select. Its render-prop yields `(item, index, meta)` so consumers get depth/expansion
  without recomputing.
- **`<Combobulate.TreeItem item index>`** — merges at render:
  ```tsx
  const base = combo.getItemProps(item, index); // id, aria-selected, setsize, posinset, data-active, onClick, onPointerMove
  const meta = tree.rows[index];
  // node rows:
  <div
    {...base}
    role="treeitem"                              // overrides role="option"
    aria-level={meta.depth + 1}
    aria-expanded={meta.hasChildren ? meta.expanded : undefined}
    data-depth={meta.depth}
    data-expanded={meta.expanded ? "" : undefined}
  />
  ```
  - A consumer-rendered **chevron** affordance calls `tree.toggle(meta.id)` and **stops
    propagation**, so toggling expansion never selects the row.
  - **Aggregate rows** (`meta.kind === "aggregate"`): `onClick` is swapped to
    `tree.toggleAllUnder(meta.parentId)`; state is derived via `tree.getAggregateState`, surfaced
    as `aria-checked={"true" | "false" | "mixed"}` with `aria-selected` omitted (a tri-state
    control, not a selectable option); `data-indeterminate` exposed for styling.

### 3.7 `<NestedAutocomplete>` preset

Batteries-included composition of core + tree, mirroring `<Autocomplete>`:

```ts
interface NestedAutocompleteProps<T> {
  nodes: T[];
  getChildren: (node: T) => T[] | undefined;
  getItemId: (node: T) => string;
  getSearchText?: (node: T) => string;
  renderItem?: (item: T, meta: TreeRow<T>) => ReactNode;
  filterItems?: (items: T[], query: string) => T[];
  onChange?: (value: T | T[] | null) => void;
  placeholder?: string;
  estimateSize?: (index: number) => number;
  multiple?: boolean;
  selectAllUnder?: boolean;      // opt-in aggregate rows
  emptyMessage?: ReactNode;
}
```

Internally: the lifted-`inputValue` composer from §3.5, wrapping `<Combobulate.Root>` →
`<Input>` + `<Tree>`/`<TreeItem>` + `<Empty>` + `<LiveRegion>`. Ships class-named markup
(`cbl-tree`, `cbl-treeitem`, chevron, indent via `data-depth`) with additions to the optional
`styles.css`: indent / chevron / `data-expanded` / `data-indeterminate` selectors. Still zero
JS-driven `:hover`.

---

## 4. Core additive change — headless `aria-live` region

The core is headless, so the region is split: **core computes the announcement string as
state; a primitive renders the node.** This is additive and tree-unaware.

- `useAutocomplete` gains a derived `announcement: string` and
  `getLiveRegionProps(): { role: "status"; "aria-live": "polite"; "aria-atomic": true }`.
- Announcement content is state-driven (not hand-rolled per render like the old repo): result
  count when filtering settles (`"12 results"` / `"No results"`), and `loading` → `"Loading…"`.
- New primitive **`<Combobulate.LiveRegion>`** renders a visually-hidden
  `<div {...getLiveRegionProps()}>{announcement}</div>`. Both `<Autocomplete>` and
  `<NestedAutocomplete>` include it; headless consumers opt in.

---

## 5. Group B — dynamic row heights

Playground scenario `data-testid="dynamic"`: a linear `<Autocomplete>` over items with
variable content (multi-line labels), with `estimateSize` as a rough guess, relying on
`virtualizer.measureElement` (already wired in the `List` primitive).

- **Expected: no core change.** If measurement forces one, it is an isolated primitive tweak,
  scoped and called out in the plan.
- **e2e:** scroll position and `aria-activedescendant` stay correct across measured rows when
  keyboard-navigating to an off-screen item.

---

## 6. Group C — fuzzy + async

- **Fuzzy demo** `data-testid="fuzzy"`: `<Autocomplete filterItems={fuseMatcher}>` with Fuse.js
  in the **playground only** (Fuse is a playground devDep, never a library dependency — proving
  `filterItems` is a real injection point).
- **Async demo** `data-testid="async"`: a simulated remote source driving `loading` +
  `onInputChange`, with items controlled from outside. `<LiveRegion>` announces `"Loading…"` →
  `"N results"`. The preset exposes a spinner slot that reads the core's `loading`.
- **e2e:** typing triggers `loading`, then settles to results; the live-region text transitions
  are asserted.

---

## 7. Testing strategy

- **`useTree` unit (tree-independent, proves the lego boundary):** `expandedIds` as source of
  truth; flatten depth/parentId/hasChildren; visible list with/without expansion; filter →
  matches + ancestors + auto-expand (no orphaned matches); `←`/`→` semantics (expand /
  into-first-child / collapse / to-parent); aggregate `toggleAllUnder` + `getAggregateState`
  tri-state; controlled `expandedIds` + `onExpandedChange`.
- **Tree primitives unit:** `role="tree"` / `role="treeitem"`; `aria-level` / `aria-expanded`;
  `data-depth` / `data-expanded`; chevron toggles expansion without selecting; aggregate row
  `aria-checked="mixed"`.
- **Core additive unit:** `announcement` string transitions (count / no-results / loading) +
  `getLiveRegionProps`.
- **Core regression guard:** the existing 29 core tests stay green and still never reference
  expansion.
- **E2E (Playwright):** nested-tree keyboard + ARIA (`role="tree"`/`treeitem`, `aria-level`,
  `aria-activedescendant` resolving to a mounted node after `←`/`→`, aggregate `aria-checked="mixed"`);
  dynamic heights; fuzzy; async.

---

## 8. Task-group ordering

1. **A — tree core → primitives → aggregate rows → `<NestedAutocomplete>` → nested e2e.**
2. **C — live region** (core additive) lands alongside A's preset so both presets can include it.
3. **B and C demos** — dynamic-height, fuzzy, and async playground scenarios + their e2e.
4. **Polish** — full pipeline (`lint` / `typecheck` / `test` / `build` / `e2e`) green; README
   updated with the nested snippet and the "select all under node" note.

---

## 9. Public API additions (summary)

- **Hook:** `useTree<T>(options): TreeApi<T>` (+ `TreeApi`, `TreeRow`, `UseTreeOptions` types).
- **Primitives:** `<Combobulate.Tree>`, `<Combobulate.TreeItem>`, `<Combobulate.LiveRegion>`.
- **Preset:** `<NestedAutocomplete<T> ... />` (+ `NestedAutocompleteProps`).
- **Core additive:** `AutocompleteApi.announcement`, `AutocompleteApi.getLiveRegionProps`.

## 10. Known follow-ups (out of scope for Plan 2)

- Additional aggregate-selection ergonomics beyond leaf-based tri-state (e.g. partial-branch
  policies) if real usage demands them.
- Vanilla (framework-agnostic) core extraction, per the original spec's non-goals.
