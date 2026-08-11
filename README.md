# combobulate

**A headless, accessible, properly virtualized combobox — built on [Ariakit](https://ariakit.org).**

Combobulate is the integration layer, not another combobox engine. Ariakit owns
the combobox shell: option roles, `role="combobox"`, `aria-expanded`, and the
`aria-activedescendant` highlight. TanStack Virtual owns windowing. Floating UI
owns positioning. Combobulate owns the seam none of them cover: **making a
virtualized list actually accessible** — driving Ariakit's active item across
the full list, and the committed-value selection model on top.

## Why

A combobox announces "item 2,847 of 3,300" and jumps to the last result with
`End`. A virtualizer only mounts what's on screen — so it can't know either.
Pair them naively and you get a list that *looks* right and lies to screen
readers: no `aria-setsize`, no `aria-posinset`, and `End` that lands on the last
row that happens to be mounted rather than the last row that exists.

Combobulate closes that gap:

- **The active row is always mounted.** Combobulate owns navigation over the
  full list: it scrolls the target index into view, then hands Ariakit the id to
  make active, so `aria-activedescendant` always resolves.
- **Full-list ARIA.** `aria-setsize`/`aria-posinset` come from the filtered data,
  not the mounted window.
- **Correct jump keys.** `Ctrl`/`Cmd`+`Home`/`End` and `PageUp`/`PageDown` target
  the whole list — scroll the true target into mount, then set it active. This is
  verified end-to-end in a real browser; it's the thing most virtualized
  comboboxes don't get right.

## Install

```sh
bun add combobulate-react
```

Only `react` and `react-dom` are peers. Ariakit, TanStack Virtual, and Floating
UI come along as regular dependencies — one install, no extra peer setup.

## Use

Like most comboboxes, the list is a **floating dropdown** anchored to the input
— `useCombobulateFloating` + `Combobulate.Popover` position it, flip it when
there's no room below, match its width to the input, cap its height to the
viewport, and dismiss it on outside-click or Escape (and on select, with
`closeOnSelect`).

```tsx
import { Combobulate, useCombobulateFloating, useCombobulate } from "combobulate-react";

const CITIES = ["Paris", "Madrid", "Berlin" /* …thousands more */];

function CityPicker() {
  const combobox = useCombobulate({ items: CITIES, getItemId: (c) => c });
  const floating = useCombobulateFloating(combobox, { closeOnSelect: true });

  return (
    <Combobulate store={combobox} label="Cities">
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
    </Combobulate>
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
<Combobulate store={combobox} label="Cities">
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
</Combobulate>
```

## Controlled selection

By default the selection is **uncontrolled** — combobulate owns it, seeded by
`defaultValue` and surfaced through `onChange`. Pass a **`value`** prop to make
it controlled: your state is the source of truth, and the displayed selection
always reflects it.

```tsx
function CityPicker() {
  const [city, setCity] = useState<string | null>(null);
  const combobox = useCombobulate({
    items: CITIES,
    getItemId: (c) => c,
    value: city, // controlled: the source of truth
    onChange: (next) => setCity(next), // fires the whole item (or null)
  });
  // …render as usual; external buttons can drive setCity directly
}
```

- **`value: T | T[] | null`** — controlled selection (an array for `multiple`).
  Mutually exclusive with `defaultValue`. A pick fires `onChange(next)` but the
  UI doesn't change until you update `value` — so the parent can transform,
  validate, or reject a selection, and external logic (a "swap
  origin/destination" button, a dependent list) can drive it declaratively.
- **`onChange(value)`** — receives the whole selected item(s), or `null`, so you
  can store the id, the label, or the object — whatever you need.
- **`store.setValue(value)`** — imperatively set/replace/clear the selection
  (`null` or `[]` clears). Handy for a "Clear" button in the uncontrolled case.
- **`defaultValue`** — the initial selection for the uncontrolled case.

Object items follow the same identity rule as everywhere else: provide
`getItemId` (or pass the same object references that live in `items`) so a
controlled `value` resolves to the right option. See the **Single Controlled**,
**Multi Controlled**, and **Linked (booking)** examples for the swap-button and
dependent-list patterns.

## Filtering

There's one filter with one override. Provide `filterItems(items, query)` to
bring your own matcher — fuzzy, ranking, multi-field, async-shaped — returning
the matches in display order. If you don't, the built-in filter runs: a
diacritic-insensitive substring ("includes") match over `getSearchText(item)`.
String items search themselves; for objects, point `getSearchText` at the
field(s) you want searchable — no `filterItems` needed.

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

  const combobox = useCombobulate({
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

## Item identity

Combobulate identifies options **structurally** by default — by object reference,
or by value for primitives — so string lists and stable object lists need no
configuration. Provide `getItemId(item) => string` when an item's object
reference can change while it stays logically the same:

- async re-fetches (paginate/refresh/revalidate returns new objects),
- lists rebuilt every render (`items={raw.map(toOption)}`),
- a `defaultValue` loaded from a different source than `items`.

Without it, those cases can't recognize the re-referenced item as the current
selection. (That's why the async example above sets `getItemId`.) It's an
identity accessor, not an id format — the returned string just has to be unique.

## Accessibility

Combobulate implements the [ARIA editable combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): the input owns focus and `role="combobox"`, options carry `role="option"`, and the active option is tracked with `aria-activedescendant` — so options are reached with the keyboard, not by tabbing into the list.

- **Full-list semantics.** `aria-setsize`/`aria-posinset` reflect the whole filtered list, not the mounted window, so "item 2,847 of 3,300" is announced correctly.
- **Keyboard navigation.** Arrow keys move one row; `PageUp`/`PageDown` move a page, and `Ctrl`/`Cmd`+`Home`/`End` jump to the ends of the full virtualized list — scrolling the true target into the DOM before handing it to the screen reader. (Bare `Home`/`End` stay caret keys in the input.) `ArrowDown`/`ArrowUp` reopen a closed list.
- **Focus-out dismiss.** Moving focus out of the input (Tab, or clicking another control) closes the list.
- **Result & selection announcements.** A polite live region announces the settled result count (debounced so fast typing doesn't flood the screen reader), plus multi-select selection changes (which don't otherwise change the input or the count).

**Virtualization tradeoff:** because only a window of options is mounted, a screen reader's virtual-cursor / rotor sees just the mounted rows — not all 3,300. The list is designed to be **navigated by keyboard** (arrows and jump keys mount rows on demand) rather than browsed with the virtual cursor. Keep this in mind for very large lists.

## Examples

A Vite examples app (sidebar + routes) is the demo surface — six examples over
the same ~3,300 real airports in one virtualized list (the virtualization +
full-list-ARIA story that's the reason this exists), floating by default:

- **Single / Multi · Uncontrolled** — the default model. Single-select fills the
  input with the chosen airport (committed value) and reopening shows the whole
  list with the chosen row marked; multi-select carries the selection as
  removable chips and keeps the list open after each pick.
- **Single / Multi · Controlled** — the parent owns the selection (`value` +
  `onChange`), with a live parent-state readout and Clear / Set buttons driving
  it from outside.
- **Themeable** — the same control styled with a CSS-in-JS theme (JS tokens + CSS
  variables) instead of utility classes; identical look, different strategy.
- **Linked (booking)** — two controlled comboboxes with a Swap button and
  origin/destination dependent lists: the payoff of controlled mode.

```sh
bun run dev
```

Patterns beyond the examples — custom/fuzzy filtering, remote/async search, and
the in-flow (non-floating) layout — are covered by the **Filtering** and
**In-flow (relative) list** sections above.

## Roadmap

A nested-tree layer (expand/collapse, virtualized `role="tree"`,
select-all-under-node) is **not shipped** — it needs a fresh design pass on top
of the Ariakit-backed core.

## License

MIT
