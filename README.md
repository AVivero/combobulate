# combobulate

**The headless toolkit for accessible, virtualized autocompletes.**

Combobulate gives you a fully accessible, keyboard-navigable combobox that
stays smooth at 10,000+ items — without forcing you into its markup or its
styles. Use the batteries-included preset, compose the headless primitives
into your own design system, or drop straight into the state machine.

## Install

```sh
bun add combobulate
```

Combobulate ships `react`, `react-dom`, and `@tanstack/react-virtual` as
**peer dependencies** — install them alongside it if your project doesn't
already have them:

```sh
bun add react react-dom @tanstack/react-virtual
```

## Three ways to use it

### 1. The styled preset — `<Autocomplete>`

Batteries included: a virtualized, accessible combobox with class names
(`cbl-*`) and `data-*` hooks that `combobulate/styles.css` targets.

```tsx
import { Autocomplete } from "combobulate";
import "combobulate/styles.css"; // optional, but gives you a ready-made look

const CITIES = ["Paris", "Madrid", "Berlin", /* …thousands more */];

function App() {
  return (
    <Autocomplete
      items={CITIES}
      placeholder="Search cities…"
      onChange={(value) => console.log(value)}
    />
  );
}
```

`<Autocomplete>` accepts `items`, `renderItem`, `getSearchText`,
`getItemId`, `filterItems`, `onChange`, `onInputChange`, `loading`,
`placeholder`, `estimateSize`, and `emptyMessage` — see
[`AutocompleteProps`](./src/presets/autocomplete.tsx) for the full list.
`onInputChange` + `loading` are the hooks for async/remote search: fire a
request as the user types, flip `loading` on, and the live region
announces it.

### 2. Headless primitives — `useAutocompleteVirtual` + `Combobulate.*`

Own the markup and styling; Combobulate owns the state, the ARIA wiring,
and the virtualization↔accessibility bridge.

```tsx
import { Combobulate, useAutocompleteVirtual } from "combobulate";

function CityPicker() {
  const api = useAutocompleteVirtual({ items: CITIES, defaultOpen: true });

  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input aria-label="City" />
      <Combobulate.List>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {String(item)}
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.Empty>No results</Combobulate.Empty>
    </Combobulate.Root>
  );
}
```

### 3. The pure state machine — `useAutocomplete`

For full control with no virtualization and no primitives at all, the
plain `useAutocomplete` hook returns the same open/filter/select state
machine and prop getters — bring your own list rendering (or roll your
own virtualizer integration).

## Nested tree

The tree layer is an opt-in composition on top of the tree-unaware core —
your `nodes`/`items` never need to know a tree exists.

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

`useTree` is the headless hook underneath: it owns `expandedIds` and emits
a flat visible list (`items` + index-aligned `rows`) that feeds
`useAutocompleteVirtual` directly. `←`/`→` expand/collapse the active row,
and `selectAllUnder` adds a tri-state "select all under node" control
(multi-select only) that selects or deselects every leaf beneath a node in
one update.

See the [tree layer design spec](./docs/superpowers/specs/2026-07-15-combobulate-tree-layer-design.md)
for the full architecture.

## Examples — travel showcase

`examples/playground` is a Google-Flights-style showcase built on real
airport data (~3,300 scheduled-service airports from OurAirports):

```sh
cd examples/playground
bun install
bun run dev
```

It demonstrates the patterns that matter in production autocompletes:

- **Flight search hero** — Origin→Destination on the headless primitives,
  rich rows (city · airport · IATA badge), metro-area rollups, and a swap.
- **Nested geography** — Country → City → Airport with `NestedAutocomplete`
  and select-all-under ("all NYC airports").
- **Async typeahead** — remote-search simulation with `loading`, skeletons,
  and live-region announcements.
- **Multi-select chips** — removable chips driven by the hook's selection.
- **World airports** — ~3,300 real airports in one virtualized list.

Each section is styled with a **different** system — Tailwind or Emotion,
with a shared light/dark token layer — to show Combobulate imposes no
styling opinion. The airport data is committed; rebuild it with
`bun scripts/build-airports.ts`.

## Why

Virtualized lists and accessible comboboxes fight each other: a combobox
needs `aria-activedescendant` to point at a real, mounted DOM node, but a
virtualizer only mounts what's on screen. Combobulate owns that seam —
the active index lives in state (not the DOM), and
`useAutocompleteVirtual` bridges it to TanStack Virtual by calling
`scrollToIndex` whenever it changes, guaranteeing the highlighted option
is always mounted. `aria-setsize` and `aria-posinset` are derived from the
same filtered-item data driving the render, so assistive tech always
reports accurate list position even when most of the list is virtualized
out of the DOM.

## Learn more

See the [design spec](./docs/superpowers/specs/2026-07-14-combobulate-design.md)
for the full architecture: layering, the accessibility/virtualization
bridge, filtering and async semantics, and the tree layer.

## License

MIT
