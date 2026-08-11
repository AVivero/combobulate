# Combobulate v1 — Ariakit migration (design)

**Date:** 2026-08-10
**Status:** approved (brainstorm), pending implementation plan
**Supersedes engine choice in:** `2026-07-16-combobulate-cmdk-rebuild-design.md`

## Why

A 6-agent production-readiness audit graded combobulate "not production-ready."
The root cause is the engine: **cmdk is a command-palette engine, and combobulate
is a collapsible combobox.** cmdk hardcodes `aria-expanded="true"` (never tracks
open — a screen reader is told the popup is open when it is closed), hardcodes
`aria-selected` = the *highlighted* row (so the single-select chosen value is
invisible to AT), and spreads consumer props *before* its own attributes so
neither is overridable. cmdk is also the reason the fragile "synthetic-pointer"
jump-key workaround exists: it recomputes `aria-activedescendant` only from its
own pointer/keyboard handlers, never from a controlled value.

Crucially, combobulate already runs cmdk with `shouldFilter={false}` and does its
**own** filtering, virtualized rendering, and state — so cmdk only ever provided
keyboard nav + active-descendant + role wiring, which are exactly the parts
causing the pain.

A throwaway spike (branch `spike/ariakit-virtual`) validated **Ariakit**
(`@ariakit/react`) as the replacement. All four go/no-go criteria passed in
happy-dom:

1. `aria-expanded` tracks `store.open`.
2. `store.setActiveId(id)` drives `aria-activedescendant` **declaratively** — so
   the synthetic-pointer hack can be replaced by a plain
   scroll-to-mount-then-`setActiveId` bridge (ordering matters: setting active
   before the target row mounts stays null; scroll/mount first, then set).
3. Our full-list `aria-setsize`/`aria-posinset` land — Ariakit does **not**
   override item attributes, so we also control `aria-selected` on the chosen row.
4. `selectedValue` is a first-class concept, separate from input text and from the
   active highlight.

Downshift was rejected (react-virtual arrow-scroll issues, downshift#1041 — the
pain that originally drove the move to cmdk). React Spectrum ships a virtualized
accessible combobox but is coupled to Adobe's design system + collection API;
react-aria-components' headless virtualization is incomplete (adobe#5356). Native
implementation is the fallback if Ariakit regresses.

## Goals

- Replace cmdk with Ariakit as the internal engine.
- Fix the a11y contract: `aria-expanded`/`aria-controls` track open state;
  `aria-selected` marks the chosen option in single- **and** multi-select.
- Delete the synthetic-pointer jump hack and its unit "fallback" path; replace
  with a declarative scroll-then-`setActiveId` bridge.
- Rethink the public API around a clean **store handle** (see below), fixing the
  audit's API findings (internal types leaking, naming asymmetry, identity churn).
- Preserve the committed-value model (`itemToInputValue`) behavior exactly.
- Keep our own floating layer (`useCombobulateFloating` + `Combobulate.Popover`,
  `@floating-ui/react`).
- Home/End become caret keys; Ctrl/Cmd+Home/End jump to first/last option.

## Non-goals (explicit — separate follow-up)

- Packaging/release blockers: `"use client"` banner, `exports` `.d.cts` routing,
  `"sideEffects": false`, version bump to `0.1.0`, CHANGELOG, publint/attw CI.
  These are orthogonal config and get their own short "release-prep" plan.
- The nested-tree layer (still parked).

## Decisions (locked in brainstorm)

1. **Engine:** Ariakit as the headless ARIA/keyboard-shell; cmdk removed.
2. **Floating:** keep our layer; use Ariakit's combobox with a plain inline
   `ComboboxList` (no Ariakit popover) — the shape the spike ran.
3. **Scope:** engine swap + a11y correctness only (packaging separate).
4. **Public API:** store-handle pattern.
5. **Navigation:** combobulate owns *all* navigation; Ariakit reflects `activeId`.

## Architecture

Responsibility split:

| Ariakit owns | combobulate owns |
|---|---|
| `role`/`aria-expanded`/`aria-controls`/`aria-activedescendant` wiring | filtering (`filterItems` / default) |
| active-item state (`activeId`) → `aria-activedescendant` reflection | virtualization (react-virtual) + full-list `aria-setsize`/`aria-posinset` |
| selection state (`selectedValue`) | committed-value model (`itemToInputValue`) |
| open state | **all keyboard navigation** (arrows/page/jump) + the scroll-then-set bridge |
| Escape/Enter plumbing, focus | positioning (`useCombobulateFloating` + `Popover`), selection semantics (`selectedItems`, `multiple`) |

### State & public API — store handle

`useCombobulate(options)` returns an **opaque `combobox` store** that mirrors
Ariakit's store idiom. Internally it composes an Ariakit combobox store **plus**
combobulate's own state (filtered items, virtualizer, committed-value, selection).
The Ariakit store, the virtualizer, and the scroll ref live **inside** the handle
and never appear on a public type (resolves audit finding M4).

Public surface of the handle:

- `combobox.useState(key)` — reactive, granular reads:
  `"isOpen" | "inputValue" | "filteredItems" | "activeIndex" | "activeValue" |
  "selectedItems" | "loading" | "multiple"`.
- `combobox.getState()` — imperative snapshot of the same fields.
- actions: `setOpen`, `setInputValue`, `setActiveValue`, `select`, `isSelected`,
  `itemValue`, `onInputKeyDown`.

Components:

- **`<Combobulate store={combobox} label?>`** — the root (absorbs today's
  `Combobulate.Root`); provides both Ariakit's store context and combobulate's
  context. `Combobulate` is a callable component with `.Input/.List/.Item/.Empty/
  .LiveRegion/.Popover` attached.
- **`Combobulate.Input`** → Ariakit `<Combobox>`; `aria-expanded` correct for
  free. Our `compose` helper still layers `onFocus` (open), `onBlur` (focus-out
  dismiss), and `onKeyDown` (navigation) on top.
- **`Combobulate.List`** → Ariakit `<ComboboxList>` rendered inline; our scroll
  `<div>` (measured by react-virtual) inside it; `maxHeight` prop retained.
- **`Combobulate.Item`** → Ariakit `<ComboboxItem>` with our `id`, full-list
  `aria-setsize`/`aria-posinset`, and `aria-selected` on the chosen row (single
  and multi). Ariakit does not override these (spike-confirmed).
- **`Combobulate.Popover`** / **`Empty`** / **`LiveRegion`** — carried over
  (LiveRegion keeps its 200ms debounce; Empty stays a plain non-role `<div>`).
- **`useCombobulateFloating(combobox, { closeOnSelect })`** — unchanged in spirit;
  reads/drives open state via the store.

### Navigation (combobulate owns all)

A single path in `onInputKeyDown`:

1. Map the key to a target index computed from the **full** `filteredItems`
   (ArrowUp/Down = ±1 with clamp; PageUp/Down = ±page; Ctrl/Cmd+Home/End =
   first/last enabled). Bare Home/End are left to the browser (caret).
2. Resolve the target: if its row is already rendered, `store.setActiveId(id)`
   immediately; otherwise `virtualizer.scrollToIndex(target)` and set `activeId`
   once the row mounts (a `pendingJump` ref + an effect keyed on the virtual
   window — the spike's proven ordering).
3. Ariakit reflects `activeId → aria-activedescendant`.

`preventDefault`/`stopPropagation` on owned keys so Ariakit's own composite
navigation does not also fire. The synthetic-pointer hack (`flushSync`, synthetic
`scroll`/`pointermove`, neighbor "wiggle", rAF poll) **and its unit fallback
path** are deleted.

### Committed-value model — preserved exactly

`itemToInputValue` (single-select, opt-in) maps onto the store:

- fill-on-select → set input text to the label on `select`;
- filter-bypass while showing a committed selection → unchanged (derived);
- revert-on-close → on `open → false`, restore input to the committed value;
- highlight-on-open → on open, scroll + `setActiveId` the chosen index;
- clear-to-unselect → clearing the input to `""` unselects;
- programmatic input writes use the raw setter (no `onInputChange`).

## Testing

- `src/core/cmdk-behavior.test.tsx` → **`ariakit-behavior.test.tsx`**: characterize
  the exact Ariakit contract we depend on — `setActiveId` → `aria-activedescendant`;
  the scroll-then-set ordering; `aria-expanded` tracks open; our aria-* survive on
  items; and **Ariakit's `activeId` behavior when the active item unmounts** (the
  clobber risk). The spike test graduates into this file.
- Adapt the unit suites: `primitives.test.tsx`, `use-combobulate.test.tsx`, the
  jump-key math test, the committed-value tests, the floating tests. Keep the
  focus-out and debounce tests.
- **Browser e2e is the primary guard** (`e2e/`): jump keys with modifier,
  **arrow-past-window continuity**, `aria-activedescendant` resolves to a mounted
  option, `aria-expanded` toggles, `aria-selected` on the chosen row, full-list
  `aria-posinset`. Harden `playwright.config.ts` with `retries: 2`,
  `trace: "on-first-retry"`, and a second browser engine (audit M7).

## Dependencies

- Remove `cmdk`.
- Add `@ariakit/react` as a **regular dependency**, pinned `~` (we couple to store
  behavior; the characterization test is the guard — same discipline as cmdk).
- Keep `@tanstack/react-virtual` (`~`) and `@floating-ui/react` (`^`).

## Risks & mitigations

- **Arrow-past-window continuity** — mitigated by owning nav (compute from full
  list, scroll-to-mount); verified in e2e.
- **scroll-then-set timing in a real browser** — same declarative bridge, no event
  synthesis; verified in e2e.
- **Ariakit clobbering `activeId` on active-item unmount** — pinned by the
  characterization test; in keyboard flow the active row is always scrolled into
  view so it doesn't unmount while active.
- **Ariakit version coupling** — `~` pin + characterization test; bumping Ariakit
  → re-run e2e (documented in `CONTRIBUTING.md`).

## Public API delta (summary)

- `Combobulate.Root` → the callable `Combobulate` root component (`store` prop
  replaces `api`).
- `useCombobulate` returns a store handle (with `.useState`/`.getState`/actions)
  instead of a flat `api` bag; internals no longer on any public type.
- `useCombobulateFloating(combobox, …)` — argument is the store handle.
- Everything else (`Input/List/Item/Empty/LiveRegion/Popover`, options,
  committed-value behavior) unchanged for consumers.
