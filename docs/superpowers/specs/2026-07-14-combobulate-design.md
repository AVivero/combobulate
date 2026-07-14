# Combobulate — Design Spec

> **combobulate** — the headless toolkit for accessible, virtualized autocompletes.

**Date:** 2026-07-14
**Status:** Approved design → implementation planning
**Repo:** personal GitHub (open source, MIT)

---

## 1. Purpose & thesis

Combobulate is a **headless React toolkit** that gives anyone the pieces to build a
solid autocomplete/combobox that is **accessible** and **virtualized** — from a plain
linear combobox over ten thousand items, up to a virtualized, accessible **nested tree**
combobox with injectable filtering.

### The problem we solve

Two mature internal component sets were studied as inspiration (not modified — they are in
production):

- **registry-airmodules-components** (newer): `cmdk` → `Command` → `Combobox`/`NestedCombobox`,
  Radix Popover, `react-virtual`. Nice ideas: a `renderItemContent` render-prop and an
  injectable `filterItems`. Flaw: never bridges the virtualizer to `cmdk`'s DOM-walking
  keyboard model — arrow-keying to an unmounted row breaks; nested ids are fragile
  (three divergent id schemes); JS-driven `:hover`; no debounce/async built in.
- **om-airmodules-components** (older): downshift → Headless UI, `fuse.js`. Its nested
  component has richer tree semantics (`role="tree"`, `←`/`→` expand/collapse,
  `aria-level`/`setsize`/`posinset`), a dotted-path id scheme, diacritic-normalized search,
  and "select all under this node" aggregate rows. Flaws: hand-rolled `aria-setsize`/`posinset`
  math riddled with fallbacks, Fuse-in-`useState`, hooks inside render-props, expansion state
  derived from array contents, DOM-querying for control flow.

**The through-line:** both fight the same unsolved seam — **virtualization vs. accessibility**.
Virtualization unmounts off-screen rows, which breaks any keyboard model that walks the DOM
and any ARIA that assumes every item exists.

**Combobulate's identity is that bridge, done right** — plus a genuinely composable
("lego") architecture so simple use-cases stay simple.

### Non-goals (v1)

- Not framework-agnostic. React-only. (A vanilla core can be extracted later if it takes off.)
- Not our own virtualization engine. We depend on TanStack Virtual for the raw work.
- Not a styled component library. The core ships zero CSS; a small styled preset is a reference.
- Not modifying or migrating the two source repos.

---

## 2. Architecture & layering

One React package (published as `combobulate`), **three consumption altitudes**, and a
strict **lego composition** rule: the core is tree-unaware; nesting is an opt-in layer.

```
combobulate
├─ Core (linear combobox — and ALL a linear combobox needs)
│    useAutocomplete()                      state machine, filtering, keyboard,
│                                           a11y wiring, virtualization bridge
│    <Combobulate.Root/Input/List/Item/Group/Empty>   unstyled base primitives
│
├─ Tree layer (opt-in, snapped on top — never touches the core)
│    useTree()                              owns expandedIds, flatten-with-expansion,
│                                           ←/→ keyboard, emits a FLAT visible list
│    <Combobulate.Tree/TreeItem>            role="tree" / aria-level semantics
│
└─ Styled presets (reference examples, batteries-included)
     <Autocomplete>          built on the core primitives
     <NestedAutocomplete>    built on core + tree layer, composed
```

### Three ways to consume (most control → least)

1. **`useAutocomplete()`** — you own all rendering; we return prop-getters + state (downshift-style).
2. **Primitives** — compose `<Combobulate.Input/>`, `<List/>`, `<Item/>`; style via `data-*`. Sweet spot.
3. **Styled preset** — `<Autocomplete items={...} />`; looks great immediately. Powers the demos.

### Why this shape

- The Radix/Ariakit model is the most shareable. Hard logic lives in **one** place
  (`useAutocomplete`) and is tested independently of rendering.
- **Lego rule (explicit user requirement):** a linear combobox must never encounter
  "expansion." `expandedIds`, `depth`, and tree concepts appear **nowhere** in the core's
  API or types. Nesting is composed from smaller pieces, so import cost, type surface, and
  cognitive load scale with what you actually use.

### Styling philosophy

- Core ships **zero CSS**. State is exposed purely through **`data-*` attributes**
  (`data-active`, `data-selected`, `data-disabled`, plus `data-expanded`/`data-depth` on the
  tree layer only). Consumers style with plain CSS / Tailwind / anything.
- No JS-driven `:hover` (registry's mistake) — styling never triggers React re-renders.
- The styled preset ships a small, optional, fully overridable stylesheet.

---

## 3. Core: state machine + the a11y / virtualization bridge (the crux)

`useAutocomplete()` owns everything as **explicit state, never derived from the DOM**.

### State

```
{ open, inputValue, activeIndex, selectedItems }
```

(Deliberately **no** tree/expansion state — see §4.)

### Keyboard model — `aria-activedescendant`, not roving tabIndex

Focus stays on the input; we point `aria-activedescendant` at the active row's id. This is
the decision that makes virtualization work:

1. **Active index lives in state.** Nothing walks the DOM to find "the next item."
2. On active-index change → `virtualizer.scrollToIndex(activeIndex)` **mounts the row**,
   *then* `aria-activedescendant` resolves to a real element. This is the exact seam both
   source repos missed.
3. **`aria-setsize` / `aria-posinset` are stamped from the data model** (we know total count
   and each row's index), so they are correct even though only ~15 rows are mounted.
4. A single **`aria-live="polite"`** region announces result counts and active-option context,
   driven by state — not hand-rolled per-render like the old repo.

### Virtualization

- **TanStack Virtual** for raw work: **fixed and dynamic/measured row heights** (a showcased
  feature), overscan, `scrollToIndex`. `@tanstack/react-virtual` is a peer dependency.
- The bridge (state-owned `activeIndex` → `scrollToIndex` → `aria-activedescendant`, plus
  data-driven `setsize`/`posinset`) is **identical regardless of virtualizer** — it is the
  library's actual value, and it is what neither source repo got right.

### Selection & rendering

- Controlled and uncontrolled selection supported. Single and multi-select.
- Rows expose state as `data-*` so consumers own presentation (checkmarks, indent, chevrons)
  while the hook owns behavior — the good part of registry's `renderItemContent`, without the
  JS-`:hover` cost.

---

## 4. Tree layer — opt-in, composed, never in the core

Nesting is **not** a flag on the core hook. It is separate lego snapped on top.

### Composition

```ts
const tree  = useTree({ nodes, getChildren, getItemId }); // owns expansion; emits flat visible items
const combo = useAutocomplete({ items: tree.items });      // core, unaware it is a tree
```

- `useTree` owns **`expandedIds: Set`** as the single source of truth for open/closed
  (not "are children present in the array" like the old repo).
- It **outputs a flat visible list** (`tree.items`) plus per-item metadata
  (`{ id, parentId, depth, hasChildren, expanded }`) and a **keydown handler** for `←`/`→`.
- It drives the core via the core's public API (`combo.setActiveIndex`, etc.). **Nothing
  tree-shaped reaches into the core.** The keydown handler composes onto the input.

### Data model & ids

- **Stable, caller-derived ids** via a `getItemId` accessor. No computed path-ids (that is
  what made registry's nested fragile). One id per node, used end to end.
- Internally: source `nodes` → `flatten()` into `{ id, parentId, depth, hasChildren }` → the
  virtualizer only ever sees a flat list, so virtualization + trees compose cleanly.
- **Visible rows** = `flatten` filtered by ancestor-expansion, memoized (O(n) per relevant change).

### Tree keyboard & ARIA

- `→` expand / into-first-child; `←` collapse / to-parent.
- `role="tree"` / `treeitem`, `aria-level`, `aria-expanded` for the tree layer;
  the base primitives remain `role="listbox"` / `option` and know nothing about depth.

### Filtering interaction

- Filtering collapses the tree to **matches plus their ancestors** (a matched leaf keeps its
  context — fixes the old "orphaned match" bug) and **auto-expands** to reveal them.

### Kept-good ideas from the old nested (opt-in)

- **Diacritic normalization** for search text.
- **"Select all under this node"** aggregate rows.

---

## 5. Filtering, async & search

- **Default matcher:** fast normalized substring match via a `getSearchText(item)` accessor.
  No `JSON.stringify` hacks; no matching against serialized objects.
- **Swappable:** `filterItems(items, query)` prop — Fuse.js / fuzzy / remote all drop in.
- **Debounce:** built-in, configurable, **off by default**.
- **Async contract:** `loading` boolean + `onInputChange` callback, so consumers don't
  re-solve remote search every time. Items stay controlled from outside for async.

---

## 6. Public API surface (initial sketch — refined during planning)

### `useAutocomplete<T>(options)`

Options (core, tree-unaware):

- `items: T[]` (required)
- `value` / `defaultValue`, `onChange` — selection (single or multi)
- `inputValue` / `onInputChange` — controlled input
- `getSearchText?(item): string`
- `filterItems?(items, query): T[]`
- `getItemId?(item): string`
- `open` / `defaultOpen` / `onOpenChange`
- `debounce?: number` (default 0)
- `loading?: boolean`
- `disabled?: boolean`
- `multiple?: boolean`

Returns: `{ getRootProps, getInputProps, getListProps, getItemProps, isOpen, activeIndex,
setActiveIndex, inputValue, selectedItems, virtualizer, ... }`.

### `useTree<T>(options)`

- `nodes: T[]`, `getChildren(node): T[] | undefined`, `getItemId(node): string`
- `defaultExpandedIds?` / `expandedIds?` / `onExpandedChange?`
- Returns: `{ items, getTreeKeyDownHandler, expand, collapse, toggle, expandedIds }`
  where `items` is the flat visible list ready for `useAutocomplete`.

### Primitives

- Base: `<Combobulate.Root/Input/List/Item/Group/Empty>`
- Tree: `<Combobulate.Tree/TreeItem>`

### Styled presets

- `<Autocomplete items renderItem filterItems ... />`
- `<NestedAutocomplete nodes getChildren renderItem ... />`

---

## 7. Repo infrastructure (Bun-first)

- **Bun** — package manager + test runner.
- **TypeScript** throughout; **kebab-case** file names; **TSDoc on every exported function**.
- **Bundler:** `tsup` → ESM + CJS + `.d.ts`.
- **Peer deps:** `react`, `react-dom`, `@tanstack/react-virtual`.
- **Lint/format:** Biome (one fast tool; no eslint + prettier sprawl).
- **Unit tests:** `bun test` + `@testing-library/react` + happy-dom (logic, a11y attributes,
  keyboard, tree expansion, filtering).
- **E2E:** Playwright against a **Vite playground app** that doubles as the public showcase.
- **License:** MIT.

### Structure

```
combobulate/
├─ src/                  hook, primitives, tree layer, virtualization bridge, styled preset
├─ examples/playground/  Vite showcase app (also the e2e target)
├─ e2e/                  Playwright specs
├─ docs/                 spec + docs
└─ package.json, tsconfig.json, biome.json, tsup.config.ts, playwright.config.ts, LICENSE
```

`examples/playground/` is a Bun workspace member. The library lives at the repo root.

---

## 8. Showcase scenarios (playground = demo = e2e target)

1. **10k flat items, buttery smooth** — virtualized linear combobox.
2. **Virtualized nested tree** — accessible, `←`/`→` keyboard, thousands of nodes.
3. **Dynamic row heights** — measured/variable heights under virtualization.
4. **Fuzzy + async** — injectable `filterItems` (Fuse.js) and a remote/`loading` example.
5. **Fully headless** — `useAutocomplete()` with bring-your-own markup.

---

## 9. Testing strategy

- **Core unit tests** never touch expansion (proves the lego boundary): open/close, filtering,
  `activeIndex` movement, selection (single/multi), `aria-activedescendant`, data-driven
  `aria-setsize`/`posinset`, debounce, async `loading`.
- **Tree unit tests** (independent): `expandedIds` as source of truth, flatten-with-expansion,
  `←`/`→` semantics, filter-with-ancestors + auto-expand, aggregate "select all" rows.
- **E2E (Playwright)** across the showcase scenarios: keyboard nav lands on and scrolls to
  off-screen virtualized rows; screen-reader-relevant attributes present on mounted rows;
  dynamic heights don't break scroll/selection.

---

## 10. Key decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Name | **Combobulate** | Memorable, nods to "combobox"; OSS-friendly personality. |
| Language | **TypeScript** | Modern OSS default; TSDoc still on every export. |
| Framework | **React-only** | Matches sources & stack; fastest to a polished demo. |
| Virtualizer | **TanStack Virtual** | Battle-tested; best-in-class dynamic/measured heights. |
| A11y model | **aria-activedescendant + state-owned activeIndex** | Makes virtualization + keyboard coexist. |
| Nesting | **Opt-in tree layer, composed** | Lego rule: core stays tree-unaware. |
| Styling | **Zero-CSS core, `data-*` attributes** | No JS-`:hover`; style with anything. |
| Infra | **Bun + tsup + Biome + Playwright** | Clean, fast, Bun-first. |
