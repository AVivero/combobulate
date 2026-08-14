# Changelog

All notable changes to combobulate are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## 0.0.2

### Added

- `Combobulate.List` and `Combobulate.Empty` now forward `className`/`style` (and
  other attributes): the list **scroll container** (custom scrollbar, list padding,
  background) and the empty-state wrapper are now styleable, alongside
  `Input`/`Item`/`Popover`. combobulate's scroll/overflow/height chain still wins on
  `List`. New README **"Styling & theming"** guide (per-element hooks, the option
  state attributes, both strategies, dark mode) and a **"Fully themed"** example.

### Fixed

- Highlight-on-open now also fires when the combobox is **mounted already open**
  (`defaultOpen`) on a committed single-select selection (`getInputValue`): the
  chosen option becomes the active descendant on mount, matching the
  focus/click-to-open behavior. (Note: this is a UX consistency improvement, not
  an accessibility fix — the chosen option always carries `aria-selected`
  regardless.)

## 0.0.1

First tagged release.

### Engine

- Built on **Ariakit** (`@ariakit/react`) as the accessible combobox shell, plus
  **TanStack Virtual** for windowing and **Floating UI** for positioning.
  Combobulate owns the seam none of them cover: making a virtualized list
  accessible — full-list `aria-setsize`/`aria-posinset`, an always-mounted active
  row, and correct jump keys over the whole list.

### Public API

- `useCombobulate(options)` returns an opaque **store handle** (`CombobulateStore`)
  with reactive `store.useState(key)`, imperative `store.getState()`, and actions
  (`select`, `setOpen`, `setInputValue`, `onInputKeyDown`, …). Engine internals
  never appear on the public types.
- Callable root `<Combobulate store={store}>` with `.Input/.List/.Item/.Empty/`
  `.LiveRegion/.Popover`.
- `useCombobulateFloating(store, { closeOnSelect })` for the floating dropdown.
- Controlled selection via a `value` prop (source of truth; a user pick fires
  `onChange` without changing the displayed selection until the parent updates
  `value`). Mutually exclusive with `defaultValue`; input text and open state
  remain uncontrolled. A seeded single-select selection (`value`/`defaultValue`
  + `getInputValue`) now pre-fills the input.
- `store.setValue(value)` imperatively replaces or clears the selection
  (`null`/`[]` clears) — for "Clear"/"reset" style buttons.
- Per-item accessors share one `get*` convention: `getItemId` (identity),
  `getSearchText` (text the default filter searches), and `getInputValue` (the
  committed single-select label). `getInputValue` was renamed from
  `itemToInputValue` for naming consistency.
- Opt-in committed-value model via `getInputValue` (fill-on-select, filter
  bypass while showing a selection, revert-on-close, clear-to-unselect).

### Accessibility

- `aria-expanded`/`aria-controls` track the open state; `aria-activedescendant`
  always resolves to a mounted option; `aria-selected` marks the chosen option in
  single and multi select. Keyboard: arrows/PageUp/PageDown navigate,
  `Ctrl`/`Cmd`+`Home`/`End` jump to first/last, `Home`/`End` move the caret.

### Packaging

- Ships ESM + CJS + type declarations (`.d.ts`/`.d.cts`) with correct `exports`
  conditions, `"use client"` for React Server Component consumers,
  `"sideEffects": false`, and `engines.node >= 18`. `react`/`react-dom` are the
  only peer dependencies.
