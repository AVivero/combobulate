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

Like most comboboxes, the list is a **floating dropdown** anchored to the input
— `useCombobulateFloating` + `Combobulate.Popover` position it, flip it when
there's no room below, match its width to the input, cap its height to the
viewport, and dismiss it on outside-click or Escape (and on select, with
`closeOnSelect`).

```tsx
import { Combobulate, useCombobulateFloating, useCombobulate } from "combobulate";

const CITIES = ["Paris", "Madrid", "Berlin" /* …thousands more */];

function CityPicker() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  const floating = useCombobulateFloating(api, { closeOnSelect: true });

  return (
    <Combobulate.Root api={api} label="Cities">
      <Combobulate.Input ref={floating.reference} {...floating.referenceProps} aria-label="City" />
      <Combobulate.Popover floating={floating}>
        <Combobulate.List<string>>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              {item}
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>No results</Combobulate.Empty>
      </Combobulate.Popover>
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

### In-flow (relative) list

Prefer a list that lives in the page flow instead of floating over it (a
full-page search, a sidebar filter)? Skip the floating layer entirely — render
`Combobulate.List` directly, no `useCombobulateFloating` / `Combobulate.Popover`:

```tsx
<Combobulate.Root api={api} label="Cities">
  <Combobulate.Input aria-label="City" />
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
```

## Filtering

The default is a diacritic-insensitive substring ("includes") match. Bring your
own matcher with `filterItems`.

**Custom / fuzzy (e.g. Fuse.js):**

```tsx
const fuse = new Fuse(AIRPORTS, { keys: ["city", "iata"], threshold: 0.3 });

useCombobulate({
  items: AIRPORTS,
  getItemId: (a) => a.iata,
  filterItems: (items, query) => (query ? fuse.search(query).map((r) => r.item) : items),
});
```

**Remote / async search** — own the `items` array yourself, feed it from your
request, and set `loading` while the request is in flight (the live region
announces it). `onInputChange` fires on every keystroke to trigger the request
(debounce it in production); since the server already ranks results, skip
client-side filtering with `filterItems: (list) => list`:

```tsx
function RemoteCombobox() {
  const [items, setItems] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);

  const api = useCombobulate({
    items,
    loading,
    getItemId: (a) => a.iata,
    onInputChange: (query) => {
      setLoading(true);
      fetchAirports(query).then((results) => {
        setItems(results);
        setLoading(false);
      });
    },
    filterItems: (list) => list, // the server already filtered/ranked
  });

  // …render with Combobulate.* as usual
}
```

## Accessibility

Combobulate implements the [ARIA editable combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): the input owns focus and `role="combobox"`, options carry `role="option"`, and the active option is tracked with `aria-activedescendant` — so options are reached with the keyboard, not by tabbing into the list.

- **Full-list semantics.** `aria-setsize`/`aria-posinset` reflect the whole filtered list, not the mounted window, so "item 2,847 of 3,300" is announced correctly.
- **Keyboard navigation.** Arrow keys move one row; `Home`/`End`/`PageUp`/`PageDown` jump across the full virtualized list, scrolling the true target into the DOM before handing it to the screen reader.
- **Focus-out dismiss.** Moving focus out of the input (Tab, or clicking another control) closes the list.
- **Result announcements.** A polite live region announces the settled result count (debounced so fast typing doesn't flood the screen reader).

**Virtualization tradeoff:** because only a window of options is mounted, a screen reader's virtual-cursor / rotor sees just the mounted rows — not all 3,300. The list is designed to be **navigated by keyboard** (arrows and jump keys mount rows on demand) rather than browsed with the virtual cursor. Keep this in mind for very large lists.

## Examples

Storybook is the demo surface. The examples cover the core capabilities — all
floating by default:

- **Basic** — a single-select combobox.
- **Multi Select** — removable chips.
- **World Airports** — ~3,300 real airports in one virtualized list (the
  virtualization + full-list-ARIA story that's the reason this exists).

```sh
bun run storybook
```

Patterns beyond the examples — custom/fuzzy filtering, remote/async search, and
the in-flow (non-floating) layout — are covered by the **Filtering** and
**In-flow (relative) list** sections above.

## Roadmap

A nested-tree layer (expand/collapse, virtualized `role="tree"`,
select-all-under-node) is **not shipped** — it needs a fresh design pass on top
of the cmdk-backed core.

## License

MIT
