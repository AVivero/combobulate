# Combobulate Floating Layer — Design Spec

**Date:** 2026-07-16
**Status:** Approved (brainstorm)

## Goal

Make the autocomplete dropdown behave like a real popover: a **collision-aware
floating overlay** (anchored to the input, flips/shifts to stay on screen)
that **dismisses on outside-click and Escape** — as the default for the
batteries-included presets, without forcing that machinery onto the lean core.

## Motivation

Today `Combobulate.List` hardcodes `position: relative` inline, so the dropdown
sits in normal flow and pushes page content down when it opens, and it only
closes on Escape (no outside-click, no close-on-select). For a combobox the
conventional behavior is a floating overlay that dismisses on outside
interaction. The inline positioning is also un-overridable by CSS class
(consumers needed `!important`).

## Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Engine | **`@floating-ui/react`** (positioning + dismiss in one) |
| Boundary | **Opt-in floating layer** (`src/floating/`), mirroring the tree layer |
| Core/base primitives | **Unchanged & positioning-agnostic** (one tiny exception: `Input` gains `forwardRef`) |
| Presets | **Default-on** — `<Autocomplete>`/`<NestedAutocomplete>` float + dismiss out of the box |
| Dependency | **`@floating-ui/react` as a direct dependency** (tree-shaken when the floating layer isn't imported) |
| Placement | `bottom-start`, middleware `flip` + `shift` + `size` (match input width, cap max-height to viewport) |
| Dismiss | outside-click + Escape; single-select closes on pick, multi-select stays open |

## Architecture

A new `src/floating/` module, opt-in, composed on top of the public api — the
same shape as `src/tree/`. The tree-unaware, positioning-unaware core
(`useAutocomplete`) and the base primitives do not gain any Floating UI
dependency; the layer drives them only through the public api (`isOpen`,
`setOpen`, refs).

### `useAutocompleteFloating(api, options?)`

Wraps Floating UI's `useFloating` + `useDismiss` + `useInteractions`, bound to
the combo api:

- `open: api.isOpen`, `onOpenChange: (next) => api.setOpen(next)` — so outside
  clicks and Escape route through the existing state machine.
- Middleware defaults: `flip()`, `shift({ padding })`, `size()` that sets the
  floating element's width to the reference width and its `maxHeight` to the
  available space (so the list scrolls rather than overflowing the viewport);
  `autoUpdate` runs only while open.
- Options (all optional, sane defaults): `placement`, `offset`, `padding`,
  `matchWidth` (default true), `dismissOnOutsideClick` (default true).

Returns: `{ reference, referenceProps, floating, floatingStyles, floatingProps }`
where `reference`/`floating` are the Floating UI ref setters.

**Type:** `UseFloatingOptions`, `AutocompleteFloating` (all `type` aliases,
per repo convention).

### `<Combobulate.Popover floating={floating}>`

The positioned, self-dismissing container that wraps `<Combobulate.List>`:

- Renders nothing when `!api.isOpen`.
- Applies `ref={floating.floating}`, `style={floating.floatingStyles}`,
  `{...floating.floatingProps}` to a positioned wrapper `<div>`.
- Renders `children` (the `Combobulate.List`) inside it.
- The floating element owns the height constraint (from the `size` middleware);
  the inner `List` fills it rather than imposing a competing fixed `maxHeight`
  (the preset passes the list a `style` that defers height to the popover).

### Reference wiring (the one base-primitive touch)

Floating UI needs the input as its reference element. `Combobulate.Input` is
changed to a `forwardRef` component (backward-compatible — it already spreads
`{...props}`), so the floating layer can attach the reference:

```tsx
<Combobulate.Input ref={floating.reference} {...floating.referenceProps} />
```

No other base primitive changes. `Combobulate.List` is unchanged and still works
in-flow for non-floating users; inside a `Popover` it is simply a child of the
positioned wrapper.

## Usage

Raw primitives (opt-in):

```tsx
const combo = useAutocompleteVirtual({ items });
const floating = useAutocompleteFloating(combo);

<Combobulate.Root api={combo}>
  <Combobulate.Input ref={floating.reference} {...floating.referenceProps} />
  <Combobulate.Popover floating={floating}>
    <Combobulate.List>{(item, i) => <Combobulate.Item .../>}</Combobulate.List>
  </Combobulate.Popover>
</Combobulate.Root>
```

Presets: this wiring moves inside `<Autocomplete>`/`<NestedAutocomplete>`, so
existing preset users get floating + dismiss with no API change.

## Close-on-select

Single-select should close the dropdown when an option is picked; multi-select
stays open. The core `select()` does not close today. The floating layer / preset
closes on select when `!multiple` (via `onChange`/a selection effect calling
`setOpen(false)`), keeping the core selection logic untouched. Multi-select
leaves the popover open so several picks are possible before an outside-click
dismisses it.

## Dependency & exports

- `@floating-ui/react` added to `dependencies` (first direct dep). It is only
  imported by `src/floating/*`, so bundlers tree-shake it out for consumers who
  never import the floating layer.
- `src/index.ts` exports `useAutocompleteFloating`, augments `Combobulate` with
  `Popover`, and exports the floating types.

## Testing

- **Unit** (happy-dom, no real layout): the hook wires `open`/`onOpenChange` to
  the combo api; `<Combobulate.Popover>` renders its children only when open and
  spreads the floating ref/props; `Input` forwards its ref. Positioning math
  itself is not unit-testable under happy-dom.
- **e2e** (playground): the dropdown (a) floats over content without pushing it
  down, (b) flips above the input near the viewport bottom, (c) closes on an
  outside click, (d) closes on Escape, (e) single-select closes on pick.

## Playground

- Presets float automatically (async, nested, multi, world sections).
- The **hero** (raw primitives) adopts `<Combobulate.Popover>` — both to match
  the rest and to demonstrate the floating layer on primitives — retiring the
  manual positioning in `Hero.css`.
- Re-verify all existing e2e still pass against the floating dropdowns
  (selectors that assumed in-flow lists may need adjustment).

## Boundaries / non-goals

- The core `useAutocomplete` and base `List`/`Item`/`Empty` gain **no** Floating
  UI dependency and **no** positioning logic. Only `Input` changes (forwardRef).
- CSS anchor positioning (zero-JS) is a **future** progressive enhancement, not
  in scope — browser support is insufficient in 2026 and it does not handle
  dismiss.
- The separate `className`/`style` passthrough gap on `List`/`Item` remains a
  logged follow-up; the floating layer makes the original positioning complaint
  moot, so it is not required here.

## Success criteria

- `<Autocomplete>` floats over content, flips near the viewport edge, and
  dismisses on outside-click/Escape, with no consumer setup.
- The core + base primitives (except `Input` forwardRef) are unchanged; a
  consumer who never imports the floating layer bundles no Floating UI.
- Full pipeline green: biome, tsc, unit, build, e2e (including new floating e2e).
