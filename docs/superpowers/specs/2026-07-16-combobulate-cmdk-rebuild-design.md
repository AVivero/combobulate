# Combobulate — cmdk Rebuild Design Spec

> **combobulate** — a headless, accessible, **properly virtualized** autocomplete built on cmdk.

**Date:** 2026-07-16
**Status:** Approved design → implementation planning
**Repo:** personal GitHub (open source, MIT)
**Supersedes:** the from-scratch state-machine architecture of
[2026-07-14-combobulate-design.md](./2026-07-14-combobulate-design.md) and the
preset/tree/showcase work layered on it.

---

## 1. Why this rebuild

Combobulate drifted from its founding intent. The goal was **the best integration of
existing pieces** — the same decisions proven in the production `om-airmodules-components`
and `registry-airmodules-components` autocompletes. Instead it became a **from-scratch,
0-deps reimplementation**: a hand-rolled combobox state machine, ARIA prop-getters,
filtering, keyboard nav, and prop-merging (~2,600 lines in `src/`), competing with mature
headless libraries on their home turf. "0-deps" was never a real goal; it became the
organizing principle and produced surface nobody asked for.

The reference projects encode the intended strategy: delegate the combobox engine to a
trustworthy library, delegate matching to Fuse, delegate windowing to a virtualizer,
delegate positioning to a floating layer — and hand-write only the parts none of them
cover. This rebuild returns to that strategy.

### The engine decision: cmdk

The team's real-world migration path was **downshift → Headless UI → cmdk**, and the
newest reference (`registry-airmodules-components`) standardizes on **cmdk**. We build on
cmdk.

cmdk's one weakness is virtualization: it drives keyboard nav and highlight off **mounted
DOM nodes**, while a virtualizer mounts only a visible window. The `registry` Combobox
ships cmdk + `react-virtual` and works for single-step arrow nav (incremental scrolling
keeps mounting adjacent rows), but it leaves the *proper* virtualization behaviors
unsolved: it never sets `aria-setsize`/`aria-posinset` across the full list, and Home/End/
Page jumps land on the last *mounted* row rather than the true first/last.

**Those gaps are exactly combobulate's reason to exist.** cmdk exposes the highlighted item
as a controlled prop (`value`/`onValueChange` on `<Command>`), so we close the gaps by
turning cmdk's own knob rather than fighting it. Combobulate is therefore positioned as:
**the cmdk combobox with virtualization done properly — a11y-complete and Home/End-correct.**

---

## 2. Scope

### In scope (v1)

- A **flat**, headless, virtualized, accessible autocomplete built on cmdk.
- The virtualization ⇄ accessibility bridge (the differentiator).
- Injectable filtering (`filterItems`); Fuse is a consumer/story concern, never bundled.
- Single- and multi-select.
- Opt-in floating dropdown (`@floating-ui/react`).
- Storybook as the integration documentation and demo surface.

### Out of scope (v1) — parked, not deleted

- **Nested tree.** `src/tree/*` source is retained but excluded from the build, exports,
  tests, and stories. It is frozen until nesting is un-parked in a later release, at which
  point it will be re-homed onto the cmdk core.

### Cut entirely

- The styled preset (`<Autocomplete>`, `<NestedAutocomplete>`, `styles.css`) and the
  `./styles.css` package export. v1 ships **headless only**; Storybook shows composition
  and bring-your-own styling.
- `examples/playground` in full (the demos). Only the airport dataset is salvaged.

---

## 3. Architecture & layering

The "lego rule" holds: `core` carries **no tree concepts**. Three layers:

```
┌─────────────────────────────────────────────────────────────┐
│  src/floating/   useAutocompleteFloating + Combobulate.Popover │  (opt-in)
├─────────────────────────────────────────────────────────────┤
│  src/core/       useCombobulate  +  Combobulate.{Root,Input,   │
│                  List,Item,Empty,LiveRegion}                   │
│                  ── wraps cmdk + tanstack-virtual ──           │
├─────────────────────────────────────────────────────────────┤
│  cmdk            keyboard nav · roles · controlled highlight   │
└─────────────────────────────────────────────────────────────┘
```

### Division of responsibility

**cmdk owns:** arrow-key navigation, the ARIA `combobox`/`listbox`/`option` role baseline,
`data-selected` on the active item, and the highlighted item — surfaced to us via
controlled `value`/`onValueChange`. `shouldFilter={false}` (we filter).

**`useCombobulate()` owns** everything cmdk does not:

- `filteredItems` — from `filterItems(items, query)` or `defaultFilterItems`.
- `selectedItems` + `select` — single/multi toggle (reused from the surviving selection
  logic and `item-utils`).
- the **virtualizer** (internal — never returned to the consumer; only `estimateSize` /
  `overscan` are exposed as options).
- `inputValue`, `onInputChange`.
- `open` state (drives the floating layer).
- `activeIndex`, derived by mapping cmdk's highlighted `value` back to the filtered list.
- the Home/End/PageUp/PageDown key interceptor.

The hook returns an api object; `Combobulate.Root` provides it via context, exactly as the
current primitives consume context — the public shape (`<Combobulate.Root api={…}>`) is
preserved so the change of engine is invisible to consumers.

### The `Combobulate.*` primitives (wrapping cmdk)

- **`Root`** → `<Command shouldFilter={false} value={activeValue} onValueChange={…}>` plus
  the context provider.
- **`Input`** → `<Command.Input>` + the Home/End/Page interceptor + the floating reference.
- **`List`** → `<Command.List>` → (optional floating popover) → a virtualized
  `overflow:auto` scroll container → the visible `Item`s, absolutely positioned via the
  virtualizer (`translateY(row.start)`), measured with `virtualizer.measureElement`.
- **`Item`** → `<Command.Item value={id} onSelect={select}>` + spreads
  `aria-setsize={filteredItems.length}` and `aria-posinset={index+1}`.
- **`Empty`** → rendered when `filteredItems.length === 0`.
- **`LiveRegion`** → visually-hidden polite region announcing result counts / loading.

---

## 4. The virtualization ⇄ a11y bridge (core value)

This is the whole point of the library. Three mechanisms, all driven through cmdk's
controlled highlight rather than around it:

1. **Active row always mounted.** cmdk moves highlight → `onValueChange(value)` →
   map value → index → `virtualizer.scrollToIndex(index, { align: "auto" })`. The active
   row is guaranteed mounted, so `aria-activedescendant` always resolves to a real node.
2. **Full-list ARIA.** Each rendered `Item` carries `aria-setsize` = full filtered length
   and `aria-posinset` = its absolute index + 1 — correct across the entire virtual list,
   not just the mounted window. (The `registry` Combobox omits these entirely.)
3. **Correct large jumps.** The `Input` interceptor handles Home / End / PageUp / PageDown:
   compute the target absolute index → `scrollToIndex(target)` to mount it → set cmdk's
   controlled `value` to that item so cmdk highlights it through its normal path. A
   `useLayoutEffect` after the scroll-driven remount reconciles the controlled value with
   the freshly mounted node. This is the only genuinely fiddly glue and it is bounded to
   this one handler.

Single-step arrow nav needs no interceptor — cmdk's own `scrollIntoView` on the mounted
row plus mechanism (1) covers it.

---

## 5. Filtering & async

- **Injectable.** `filterItems?: (items, query) => items` overrides the default. cmdk's
  own filter is off (`shouldFilter={false}`). Consumers wire Fuse here:
  `new Fuse(items, cfg).search(query).map(r => r.item)`.
- **Default.** `defaultFilterItems` (substring over `getSearchText`) — the zero-config path.
- **Async.** `onInputChange` fires per keystroke; the consumer performs the request, feeds
  new `items`, and toggles `loading`. `loading` drives a `LiveRegion` announcement and lets
  consumers render skeletons. No debounce is bundled (consumer concern), consistent with
  keeping speculative helpers out.

---

## 6. Selection & multi-select

- `selectedItems: T[]`; `select(item)` toggles for `multiple`, replaces otherwise.
- `onChange` emits `T | null` (single) or `T[]` (multiple), via the surviving
  `toChangeValue`.
- `isSameItem(a, b, getItemId)` governs identity (surviving helper).
- cmdk's per-item `onSelect` dispatches to `select`; chips/removal are the consumer's to
  render from `selectedItems` (shown in a Storybook story).

---

## 7. Floating layer

`src/floating/*` is retained and re-wired to the cmdk input/list. `useAutocompleteFloating`
keeps its `@floating-ui/react` middleware (offset, flip, shift, size/width-match, dismiss)
and drives the combo's `open` state; `Combobulate.Popover` wraps the floating surface.
Crucially, focus **stays in the input** (combobox `aria-activedescendant` model) — which is
why floating-ui is used directly rather than a dialog-family popover.

---

## 8. What survives / dies / is parked

**Survives (extracted and re-homed):**

- `src/core/item-utils.ts` — `isSameItem`, `toChangeValue`, `defaultGetSearchText`,
  `defaultFilterItems` (engine-agnostic).
- The bridge concept from `use-autocomplete-virtual.ts` — re-pointed at cmdk's `value`.
- Selection logic (single/multi toggle) — lifted out of `use-autocomplete.ts` before it is
  deleted.
- `src/floating/*` — re-wired.
- The **airport dataset + pure transforms** — moved to a Storybook fixtures dir.

**Dies:**

- `src/core/use-autocomplete.ts` — the hand-rolled open/keyboard/activeIndex/ARIA state
  machine (replaced by cmdk + the thin hook).
- `src/primitives/merge-props.ts` — unless a real handler-compose case remains after
  wiring; cmdk components take props directly.
- `src/presets/*` and `styles.css` — cut (see §2).
- `examples/playground` — deleted; only airport data salvaged.
- All tree/nested/preset tests and e2e.

**Parked (retained, excluded from build):**

- `src/tree/*` — source frozen, dropped from exports, tsconfig `exclude`d so it can't
  rot-block typecheck/CI, out of tests and stories.

---

## 9. Dependencies

Rule applied: something is a **peer** dependency only if it must be a **singleton** or the
consumer must share the instance. That is true only for React.

- **`peerDependencies`:** `react` (>=18), `react-dom` (>=18).
- **`dependencies`:** `cmdk`, `@floating-ui/react`, `@tanstack/react-virtual` — all three
  are internal engines with private context; a duplicate copy is harmless, so they are
  regular deps for one-install DX.
- **Not bundled:** `fuse.js` — consumer-injected via `filterItems`; a devDependency for
  stories only.
- `@tanstack/react-virtual` moves **peer → dependency**: its type no longer leaks into the
  public API (the virtualizer instance is internal in the new design).
- Remove `workspaces: ["examples/*"]` and the `./styles.css` export from `package.json`.

---

## 10. Storybook (replaces the playground)

Add `@storybook/react-vite` (Bun-compatible). Stories are the integration docs and demos —
each brings its own styling (no shipped CSS):

- **Basic** — flat combobox over a modest list, default filter.
- **Async typeahead** — `onInputChange` + `loading` + Fuse injected; skeletons; live-region
  announcements.
- **Multi-select chips** — removable chips driven by `selectedItems`.
- **World airports** — ~3,300 real airports in one virtualized list (the scale story).
- **Floating** — placement/flip/width-match/dismiss.

Airport JSON + transforms live in `src/stories/data/` (or a `fixtures/` dir), committed;
rebuildable via the existing script.

---

## 11. Public API surface (v1)

```ts
// hook
export { useCombobulate } from "./core/use-combobulate";
export type { CombobulateApi, UseCombobulateOptions } from "./core/types";

// primitives (cmdk-backed)
export const Combobulate = { Root, Input, List, Item, Empty, LiveRegion, Popover };
export type { CombobulateRootProps, CombobulateListProps, CombobulateItemProps } from "./core/primitives";

// floating
export { useAutocompleteFloating } from "./floating/use-floating";
export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";
```

No preset, no tree exports, no `styles.css`.

> Naming note: the orchestration hook is referred to as `useCombobulate` here (replacing
> `useAutocomplete` + `useAutocompleteVirtual`, which collapse into one now that
> virtualization is core, not an opt-in variant). Final name confirmed at implementation.

---

## 12. Testing

- **Unit** (`bun test` + happy-dom + testing-library): the hook (filter, selection,
  value → index mapping, bridge), `item-utils`.
- **Component**: primitives render cmdk correctly; `aria-setsize`/`aria-posinset` present
  and correct on mounted rows; the active row mounts on highlight change.
- **e2e** (Playwright):
  - arrow-key navigation through a virtualized list,
  - **Home/End correctness on a large list** — asserts the true first/last item becomes
    active and mounted (the differentiator),
  - floating open/flip/dismiss,
  - async typeahead loading + announcement,
  - multi-select add/remove.
  - Existing e2e rewritten to the new API; tree/nested/preset e2e deleted.

Conventions unchanged: Bun, Biome (zero warnings, no non-null `!`, no unchecked index
access), `type` aliases over `interface`, prefer a little duplication over premature
abstraction.

---

## 13. Risks & open questions

- **Home/End remount timing** — setting cmdk's controlled `value` to a row mounted in the
  same tick via `scrollToIndex`. Mitigation: `useLayoutEffect` reconciliation after the
  virtualizer's measure pass; covered by a dedicated e2e. If cmdk resists, fall back to
  `scrollToIndex` + a one-frame deferred value set. This is the single highest-risk seam.
- **cmdk item registry vs. virtualization** — cmdk rebuilds its item list from mounted
  nodes. We rely on overscan + mechanism (1) to keep single-step nav within the mounted
  window; the interceptor covers jumps. Validate with the world-airports e2e.
- **Hook naming** — `useCombobulate` vs. retaining `useAutocomplete`; finalized in the plan.
```
