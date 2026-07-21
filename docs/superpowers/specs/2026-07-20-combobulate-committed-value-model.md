# Combobulate — Committed-Value Model Design Spec

> Bake the single-select "the input displays a committed selection" behavior into
> `useCombobulate` as an opt-in, so consumers stop rewriting the same ~40 lines
> of glue.

**Date:** 2026-07-20
**Status:** Approved design → implementation planning
**Repo:** personal GitHub (open source, MIT)

---

## 1. Motivation

`combobulate` is headless: `useCombobulate` keeps `inputValue` (the search text)
separate from `selectedItems`, and never syncs them. That purity is correct for a
core, but it means every single-select consumer rewrites the same behavior to get
a normal combobox — the input showing the picked item, reopening a selection
showing the list (not an empty "no match"), and an abandoned search reverting.
The Storybook demos already carry this as glue (`useDemoCombobox`,
`useSelectionInInput`), and each fix this session landed there. That recurring
glue is the signal: this behavior should be an opt-in the library offers.

This is downshift's `useCombobox` model. We adopt it behind **one option**.

## 2. Scope

**In scope:** a single new opt-in option, `itemToInputValue`, that activates the
committed-value model for **single-select**, and the simplification of the demos
to use it (dogfood).

**Non-goals (explicitly not baked in — decided during brainstorming):**
- **select-all-on-focus** stays demo glue (a one-line `onFocus` in the stories).
- **chosen styling** is not library concern — the core already emits `data-chosen`;
  the CSS is the consumer's.
- The default **includes filter** is already baked in (`defaultFilterItems`).
- **Multi-select** does not participate — chips carry the selection there; the
  input stays a search box.

## 3. The API

One new optional field on `UseCombobulateOptions<T>`:

```ts
/**
 * Single-select only. When set, the combobox adopts the "committed value"
 * model: the input displays the selected item (via this accessor), reopening a
 * selection shows the whole list instead of filtering to it, and an abandoned
 * search reverts to the selection on close. Omit it (the default) and the input
 * stays a pure search box. Ignored when `multiple` is true.
 */
itemToInputValue?: (item: T) => string;
```

Everything below is **gated on `itemToInputValue` being set AND `multiple`
being false**. With the option omitted, `useCombobulate` behaves exactly as
today — this is a purely additive, backward-compatible change.

## 4. Derived state (no new public state field)

The single `inputValue` state is kept (per the brainstorming decision). Two
derived values drive the model:

```ts
const committedValue =
  itemToInputValue && !multiple && selectedItems[0] !== undefined
    ? itemToInputValue(selectedItems[0])
    : "";

const isShowingSelection =
  committedValue !== "" && inputValue === committedValue;
```

`isShowingSelection` means "the input is displaying the committed selection, not a
search query." When it's false, the input is a search (or empty).

## 5. Behaviors

All four are no-ops unless `itemToInputValue` is set and `multiple` is false.

### 5.1 Fill on select
`select(item)` additionally sets `inputValue = itemToInputValue(item)` — but via
the **internal** state setter, NOT the public `setInputValue` (see §6). Selection
identity and `onChange` are unchanged.

### 5.2 Filter bypass while showing a selection
The filtered list is computed as today (`filterItems` or `defaultFilterItems`
over `inputValue`) **except** when `isShowingSelection`, in which case
`filteredItems = items` — the full list. This is what makes reopening a committed
selection show the list rather than filtering everything out.

### 5.3 Highlight the selection on open
When the list opens (`isOpen` goes true) while `isShowingSelection`, set the
active item to the selected one so it is highlighted and scrolled into view
through the existing virtualization bridge:

```
setActiveValue(itemValue(selectedItems[0], indexOfSelectedInFilteredItems))
```

The selected item is in `filteredItems` because the filter is bypassed (§5.2).
Implement via an effect keyed on `isOpen` transitioning to true (the existing
bridge effect then scrolls the new active index into view).

### 5.4 Revert on close
When the list closes (`setOpen(false)`) and the input is **dirty**
(`inputValue !== committedValue` — the user typed a search but didn't pick),
reset `inputValue = committedValue` via the internal setter (§6). If nothing is
selected, `committedValue` is `""`, so an abandoned search clears — downshift's
behavior. A clean input (equal to the committed value already, e.g. right after a
fill-on-select) is left untouched, so close-on-select does not double-handle.

## 6. `onInputChange` is not fired on programmatic changes

Critical. `onInputChange` exists so a consumer can fire a remote request as the
user types. Fill-on-select (§5.1) and revert-on-close (§5.4) change `inputValue`
**programmatically**, so they must set it **without** calling `onInputChange` —
otherwise a remote-search consumer re-fetches for the committed label (the exact
bug seen when the async demo re-searched the filled label).

Implementation: keep the public `setInputValue` (used by `Combobulate.Input`'s
`onChange`) firing `onInputChange` as today; have fill/revert call the raw
`useState` setter directly. Consumers still learn about the selection via
`onChange` and about the close via `onOpenChange`, so no information is lost.

## 7. Multi-select & backward compatibility

- When `multiple: true`, `itemToInputValue` is **ignored** (documented, not an
  error): `committedValue` stays `""`, all four behaviors are inert, the input
  remains a pure search box, chips carry the selection.
- When `itemToInputValue` is omitted, nothing changes for anyone — no fill, no
  revert, no bypass, no open-highlight. Existing tests and consumers are
  unaffected.

## 8. Known edge (accepted)

Because "showing a selection" is inferred from `inputValue === committedValue`
(the single-value model chosen during brainstorming): if a user clears the input
and types a query that **exactly equals** the committed label, it is treated as
"showing the selection" and shows the full list instead of filtering to that one
item. This is the acknowledged quirk of the single-value model; downshift has the
same class of edge. Not mitigated.

## 9. Demo simplification (dogfood)

Once the model is in the library, the single-select demos drop the committed-ref
/ fill glue and pass `itemToInputValue`:

- **Basic, Relative** → `itemToInputValue: (c) => c`.
- **World Airports, Fuzzy Search** → `itemToInputValue: airportLabel`.
- **Async Typeahead** → `itemToInputValue: airportLabel` (single-select remote).
- **Multi Select** → unchanged (no `itemToInputValue`; chips).

`useDemoCombobox`/`useSelectionInInput` shrink to just the remaining demo glue:
the **select-all-on-focus** `onFocus` (kept out of the library per §2). The
committed-selection filter wrapper and the fill effect are deleted — the library
now owns them. The existing e2e (`selection.e2e.ts`, `filtering.e2e.ts`) must
still pass unchanged, proving behavioral parity.

## 10. Where it lives

All of this is in the core hook `src/core/use-combobulate.ts` and the options
type `src/core/types.ts`. It is tree-agnostic and touches no other layer:
`select()` (fill), `setOpen(false)` (revert), the `filteredItems` memo (bypass),
and a new open effect (highlight). The floating layer is unaffected — it drives
`api.setOpen`, which now also reverts. No primitives change.

## 11. Testing

Unit (`src/core/use-combobulate.test.tsx`), all with `itemToInputValue` set
unless noted:
- fill-on-select sets `inputValue` to the item's label;
- `filteredItems` is the full list while `isShowingSelection`, and filters
  normally once the user types (dirty);
- revert-on-close: dirty search reverts to the committed value; to `""` when
  nothing is selected; a clean input is left untouched;
- open while showing a selection sets `activeIndex` to the selected item
  (highlight/scroll bridge);
- `onInputChange` is NOT called on fill or revert, but IS called on user typing
  (spy asserts call count);
- `multiple: true` ignores `itemToInputValue` (no fill, input stays search);
- with `itemToInputValue` omitted, none of the above happens (regression guard).

e2e: the existing `selection.e2e.ts` (fill, reopen-shows-list, chosen marker) and
`filtering.e2e.ts` must pass after the demos switch to the baked-in option —
behavioral parity is the acceptance bar.

## 12. Alternatives considered (rejected during brainstorming)

- **Separate `query` + `displayValue` two-value state.** Cleaner (no equality
  quirk), but a bigger change to the core state machine and the public api shape.
  Rejected for the smaller single-value model.
- **Low-level primitives only** (expose `committedValue`, `revertInput()`, a
  flag). Zero opinion, but doesn't remove the consumer glue — which was the point.

## 13. Constraints

Unchanged repo rules: `type` aliases over `interface`; no non-null `!`;
`noUncheckedIndexedAccess`; Biome zero warnings; the lego rule (`src/core/*` has
no tree concepts — this feature is tree-agnostic); prefer a little duplication
over premature abstraction. The change is additive and opt-in: no breaking change
to the public API.
