# combobulate

**A headless, accessible, properly virtualized combobox — built on [cmdk](https://cmdk.paco.me).**

Combobulate is the integration layer, not another combobox engine. cmdk owns
keyboard navigation, option roles, and the highlighted item. TanStack Virtual
owns windowing. Floating UI owns positioning. Combobulate owns the seam none of
them cover: **making a virtualized list actually accessible.**

## Why

A combobox announces "item 2,847 of 3,300" and jumps to the last result with
`End`. A virtualizer only mounts what's on screen — so it can't know either.
Pair them naively and you get a list that *looks* right and lies to screen
readers: no `aria-setsize`, no `aria-posinset`, and `End` that lands on the last
row that happens to be mounted rather than the last row that exists.

Combobulate closes that gap:

- **The active row is always mounted.** cmdk moves the highlight, combobulate
  scrolls that index into view, so `aria-activedescendant` always resolves.
- **Full-list ARIA.** `aria-setsize`/`aria-posinset` come from the filtered data,
  not the mounted window.
- **Correct jump keys.** `Home`/`End`/`PageUp`/`PageDown` target the whole list —
  scroll the true target into mount, then hand cmdk the value. This is verified
  end-to-end in a real browser; it's the thing most cmdk-based comboboxes don't
  get right once the list is virtualized.

## Install

```sh
bun add combobulate
```

Only `react` and `react-dom` are peers. cmdk, TanStack Virtual, and Floating UI
come along as regular dependencies — one install, no extra peer setup.

## Use

```tsx
import { Combobulate, useCombobulate } from "combobulate";

const CITIES = ["Paris", "Madrid", "Berlin" /* …thousands more */];

function CityPicker() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });

  return (
    <Combobulate.Root api={api} label="Cities">
      <Combobulate.Input aria-label="City" placeholder="Search cities…" />
      <Combobulate.List<string>>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {item}
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.Empty>No results</Combobulate.Empty>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  );
}
```

Combobulate ships **no styles** — every element above is unstyled, yours to
class up however your design system works.

Note the explicit `<string>` on `Combobulate.List` — its item type only shows
up in the render-prop's parameter, so TypeScript can't infer it from the call
site; annotate it with your item type (`Combobulate.List<Airport>`, etc.).

## Filtering

The default is a diacritic-insensitive substring match. Bring your own matcher
(Fuse.js, match-sorter, a remote API) with `filterItems`:

```tsx
const fuse = new Fuse(AIRPORTS, { keys: ["city", "iata"], threshold: 0.3 });

useCombobulate({
  items: AIRPORTS,
  getItemId: (a) => a.iata,
  filterItems: (items, query) => (query ? fuse.search(query).map((r) => r.item) : items),
});
```

For remote/async search, own the `items` array yourself (e.g. in `useState`),
pass it in, and set `loading` while a request is in flight — the live region
announces it. `onInputChange` fires on every keystroke so you can trigger the
request; since the server already ranks results, pass `filterItems: (list) => list`
to skip re-filtering client-side.

## Floating dropdown

Opt in with `useAutocompleteFloating` + `Combobulate.Popover`: anchors to the
input, flips when there's no room below, matches the input width, caps its
height to the viewport, and dismisses on outside-click or Escape (and on
select, if `closeOnSelect` is set).

```tsx
import type { Ref } from "react";
import { Combobulate, useAutocompleteFloating, useCombobulate } from "combobulate";

function CityPicker() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  const floating = useAutocompleteFloating(api, { closeOnSelect: true });

  return (
    <Combobulate.Root api={api} label="Cities">
      <Combobulate.Input
        ref={floating.reference as unknown as Ref<HTMLInputElement>}
        {...floating.referenceProps}
        aria-label="City"
      />
      <Combobulate.Popover floating={floating}>
        <Combobulate.List<string>>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              {item}
            </Combobulate.Item>
          )}
        </Combobulate.List>
      </Combobulate.Popover>
    </Combobulate.Root>
  );
}
```

`floating.reference` is untyped as a generic `Element` callback ref, hence the
cast when attaching it to an `<input>`.

## Examples

Storybook is the demo surface and the integration docs — basic usage, async
typeahead (Fuse-ranked remote search), multi-select chips, ~3,300 real
airports in one virtualized list, and the floating dropdown:

```sh
bun run storybook
```

## Roadmap

A nested-tree layer (expand/collapse, virtualized `role="tree"`,
select-all-under-node) is **parked**, not shipped. Its source lives in
`src/tree/`, retained but excluded from this build — it needs a fresh design
pass on top of the cmdk-backed core before it ships.

## License

MIT
