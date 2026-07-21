# Committed-Value Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake the single-select "the input displays a committed selection" behavior into `useCombobulate` behind one opt-in accessor, `itemToInputValue`, then simplify the demos to use it.

**Architecture:** All behavior lives in the core hook `src/core/use-combobulate.ts` and the options type `src/core/types.ts`; it is tree-agnostic and touches no other layer. Everything is gated on `itemToInputValue` being set AND `multiple` being false, so it is purely additive and backward-compatible. Two derived values (`committedValue`, `isShowingSelection`) drive four behaviors: fill-on-select, filter-bypass, highlight-on-open, and revert-on-close. Programmatic input changes (fill/revert) use the raw state setter so `onInputChange` does not fire.

**Tech Stack:** React 19, TypeScript 5.7, Bun (test), Biome, cmdk, @tanstack/react-virtual, Playwright/Storybook (demo e2e).

**Spec:** [2026-07-20-combobulate-committed-value-model.md](../specs/2026-07-20-combobulate-committed-value-model.md)

## Global Constraints

- `type` aliases over `interface`; intersections, never `extends`.
- Biome: zero warnings. No non-null `!` (`noNonNullAssertion`), no unchecked index access, no assignment-in-expression (use block-body arrows). An inert `biome-ignore` warns — only keep ones that suppress.
- `noUncheckedIndexedAccess: true` — every `array[i]` is `T | undefined`; guard, never `!`.
- **Lego rule:** `src/core/*` contains no tree concepts. This feature is tree-agnostic.
- **Opt-in & additive:** every behavior is gated on `itemToInputValue` set AND `multiple` false. With the option omitted, `useCombobulate` behaves exactly as today. No breaking change.
- **`onInputChange` must NOT fire on programmatic input changes** (fill-on-select, revert-on-close) — only on user typing.
- **`itemToInputValue` is the accessor name** (chosen during brainstorming).
- Prefer a little duplication over premature abstraction (YAGNI). Test output pristine.
- Tooling: `bun test`, `bun run typecheck`, `bun run lint`, `bun run e2e`.

---

## File Structure

- **Modify** `src/core/types.ts` — add `itemToInputValue?: (item: T) => string` to `UseCombobulateOptions<T>` (Task 1).
- **Modify** `src/core/use-combobulate.ts` — derived `committedValue`/`isShowingSelection`, fill-on-select, filter-bypass (Task 1); revert-on-close (Task 2); highlight-on-open (Task 3).
- **Modify** `src/core/use-combobulate.test.tsx` — unit tests for each behavior (Tasks 1–3).
- **Modify** `src/stories/useDemoCombobox.ts` — drop the committed-ref + filter-wrap glue; pass `itemToInputValue` through; keep select-all-on-focus (Task 4).
- **Delete** `src/stories/useSelectionInInput.ts` — its fill/committed logic is now the library's (Task 4).
- **Modify** `src/stories/{Basic,Relative,WorldAirports,FuzzySearch,AsyncTypeahead}.stories.tsx` — pass `itemToInputValue` (Task 4).
- e2e unchanged: `e2e/selection.e2e.ts` + `e2e/filtering.e2e.ts` must pass after Task 4 (behavioral parity).

---

### Task 1: `itemToInputValue` option + fill-on-select + filter-bypass

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/use-combobulate.ts`
- Modify: `src/core/use-combobulate.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `UseCombobulateOptions<T>.itemToInputValue?: (item: T) => string`; internal derived `committedValue: string` and `isShowingSelection: boolean` in the hook (consumed by Tasks 2 and 3); fill-on-select behavior in `select()`; filter-bypass in the `filteredItems` memo.

- [ ] **Step 1: Write the failing tests**

Add these tests to the end of `src/core/use-combobulate.test.tsx` (before the final line). They use the file's existing imports (`act`, `renderHook`, `stubElementLayout` in `beforeAll`/`afterAll`) and `ITEMS = ["Paris", "Madrid", "Berlin", "Málaga"]`:

```tsx
test("itemToInputValue: selecting fills the input with the item's label", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.inputValue).toBe("Madrid");
});

test("itemToInputValue: fill does NOT fire onInputChange (typing does)", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      itemToInputValue: (c) => c,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // programmatic fill — no onInputChange
  expect(seen).toEqual([]);
  act(() => result.current.setInputValue("ber")); // user typing — fires
  expect(seen).toEqual(["ber"]);
});

test("itemToInputValue: while showing a selection, the full list is shown", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid" (a committed label)
  // "Madrid" would substring-filter to just Madrid, but showing-a-selection bypasses:
  expect(result.current.filteredItems).toEqual(ITEMS);
});

test("itemToInputValue: typing after a pick filters normally (dirty)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  act(() => result.current.setInputValue("ber")); // now a search, not the committed label
  expect(result.current.filteredItems).toEqual(["Berlin"]);
});

test("itemToInputValue is ignored in multi-select", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, multiple: true, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.inputValue).toBe(""); // no fill; input stays a search box
  expect(result.current.filteredItems).toEqual(ITEMS);
});

test("without itemToInputValue, selecting does not touch the input (regression guard)", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  act(() => result.current.select("Madrid"));
  expect(result.current.inputValue).toBe("");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: the first four new tests FAIL (`inputValue` stays `""`; `filteredItems` filtered, not full). The multi-select and regression-guard tests may already pass (they assert today's behavior) — that's fine.

- [ ] **Step 3: Add the option to the types**

In `src/core/types.ts`, add this field to `UseCombobulateOptions<T>` immediately after the `overscan` field (before the closing `};` of the type):

```ts
  /**
   * Single-select only. When set, the combobox adopts the "committed value"
   * model: the input displays the selected item (via this accessor), reopening
   * a selection shows the whole list instead of filtering to it, and an
   * abandoned search reverts to the selection on close. Omit it (the default)
   * and the input stays a pure search box. Ignored when `multiple` is true.
   */
  itemToInputValue?: (item: T) => string;
```

- [ ] **Step 4: Derive the committed value, fill on select, bypass the filter**

In `src/core/use-combobulate.ts`:

(a) Destructure the new option — add `itemToInputValue,` to the `const { ... } = options;` block (e.g. after `overscan = 8,`):

```ts
    overscan = 8,
    itemToInputValue,
```

(b) Derive `committedValue`/`isShowingSelection` immediately after the `selectedItems` state declaration (right after the `const [selectedItems, setSelectedItemsState] = useState<T[]>(...)` block, before the `filteredItems` memo):

```ts
  // Committed-value model (single-select, opt-in via `itemToInputValue`).
  // `committedValue` is what the input shows for the current selection;
  // `isShowingSelection` means the input is displaying that selection rather
  // than an active search query.
  const committedValue =
    itemToInputValue && !multiple && selectedItems[0] !== undefined
      ? itemToInputValue(selectedItems[0])
      : "";
  const isShowingSelection = committedValue !== "" && inputValue === committedValue;
```

(c) Bypass the filter while showing a selection — replace the existing `filteredItems` memo with:

```ts
  const filteredItems = useMemo(() => {
    // While the input still shows the committed selection it's a display value,
    // not a search — show the whole list instead of filtering to it.
    if (isShowingSelection) return items;
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText, isShowingSelection]);
```

(d) Fill on select — replace the `select` callback with (adds the fill line + `itemToInputValue` to deps; everything else unchanged):

```ts
  const select = useCallback(
    (item: T) => {
      const next = multiple
        ? selectedItems.some((i) => isSameItem(i, item, getItemId))
          ? selectedItems.filter((i) => !isSameItem(i, item, getItemId))
          : [...selectedItems, item]
        : [item];
      setSelectedItemsState(next);
      // Fill-on-select (committed-value model): show the pick in the input, via
      // the RAW setter so `onInputChange` does NOT fire — this is a programmatic
      // change, not user typing, and a remote-search consumer must not re-fetch
      // for the label.
      if (itemToInputValue && !multiple) setInputValueState(itemToInputValue(item));
      onChange?.(toChangeValue(next, multiple));
    },
    [multiple, onChange, getItemId, selectedItems, itemToInputValue],
  );
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: PASS (all new tests green, plus the pre-existing suite).

- [ ] **Step 6: Lint and typecheck**

Run: `bunx biome check --write src/ && bun run typecheck`
Expected: zero warnings, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/use-combobulate.ts src/core/use-combobulate.test.tsx
git commit -m "feat(core): itemToInputValue — fill on select + show-all for a committed selection"
```

---

### Task 2: Revert-on-close

**Files:**
- Modify: `src/core/use-combobulate.ts`
- Modify: `src/core/use-combobulate.test.tsx`

**Interfaces:**
- Consumes: `committedValue`, `itemToInputValue`, `multiple`, `inputValue` from Task 1.
- Produces: revert-on-close behavior in `setOpen`.

- [ ] **Step 1: Write the failing tests**

Add to `src/core/use-combobulate.test.tsx`:

```tsx
test("revert-on-close: a dirty search reverts to the committed selection", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c, defaultOpen: true }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid"
  act(() => result.current.setInputValue("ber")); // typed a search, didn't pick
  act(() => result.current.setOpen(false));
  expect(result.current.inputValue).toBe("Madrid"); // reverted
});

test("revert-on-close: with nothing selected, an abandoned search clears", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c, defaultOpen: true }),
  );
  act(() => result.current.setInputValue("ber"));
  act(() => result.current.setOpen(false));
  expect(result.current.inputValue).toBe(""); // committedValue is "" -> clears
});

test("revert-on-close: a clean input (just filled) is left untouched", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      itemToInputValue: (c) => c,
      defaultOpen: true,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid" (clean, == committed)
  act(() => result.current.setOpen(false)); // not dirty -> no revert
  expect(result.current.inputValue).toBe("Madrid");
  expect(seen).toEqual([]); // revert path never fired onInputChange either
});

test("revert-on-close does nothing without itemToInputValue (regression guard)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, defaultOpen: true }),
  );
  act(() => result.current.setInputValue("ber"));
  act(() => result.current.setOpen(false));
  expect(result.current.inputValue).toBe("ber"); // untouched
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: the first two new tests FAIL (input not reverted). The clean-input and regression-guard tests already pass (assert today's behavior).

- [ ] **Step 3: Implement revert in `setOpen`**

In `src/core/use-combobulate.ts`, replace the `setOpen` callback with:

```ts
  const setOpen = useCallback(
    (next: boolean) => {
      // Revert-on-close (committed-value model): if the user typed a search but
      // didn't pick, restore the input to the committed selection (or "" if
      // none) on close. Raw setter so `onInputChange` does not fire. A clean
      // input (already equal to the committed value, e.g. right after a
      // fill-on-select) is left untouched, so close-on-select never double-handles.
      if (!next && itemToInputValue && !multiple && inputValue !== committedValue) {
        setInputValueState(committedValue);
      }
      setIsOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, itemToInputValue, multiple, inputValue, committedValue],
  );
```

Note: `committedValue` is derived in Task 1 above the `setOpen` declaration, so it is in scope. This changes `setOpen`'s identity when `inputValue`/`committedValue` change — that is harmless (the floating layer calls `api.setOpen` through an inline closure, not a memo dependency).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: PASS (all revert tests green, full suite green).

- [ ] **Step 5: Lint and typecheck**

Run: `bunx biome check --write src/ && bun run typecheck`
Expected: zero warnings, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/use-combobulate.ts src/core/use-combobulate.test.tsx
git commit -m "feat(core): revert the input to the committed selection on close"
```

---

### Task 3: Highlight the selection on open

**Files:**
- Modify: `src/core/use-combobulate.ts`
- Modify: `src/core/use-combobulate.test.tsx`

**Interfaces:**
- Consumes: `isShowingSelection`, `selectedItems`, `filteredItems`, `itemValue`, `setActiveValue`, `isOpen` from Task 1 / existing hook.
- Produces: an effect that sets `activeValue` (hence `activeIndex`) to the selected item when the list opens while showing a selection.

- [ ] **Step 1: Write the failing test**

Add to `src/core/use-combobulate.test.tsx`:

```tsx
test("opening while showing a selection highlights the selected item", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Berlin")); // inputValue -> "Berlin"; list closed
  expect(result.current.activeIndex).toBe(-1); // nothing highlighted yet
  act(() => result.current.setOpen(true)); // open while showing the selection
  expect(result.current.activeIndex).toBe(ITEMS.indexOf("Berlin")); // 2
});

test("opening a plain search does not force-highlight (regression guard)", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  act(() => result.current.setOpen(true));
  expect(result.current.activeIndex).toBe(-1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: the first new test FAILS (`activeIndex` stays `-1` after open). The regression guard passes.

- [ ] **Step 3: Implement the open-highlight effect**

In `src/core/use-combobulate.ts`, add this effect immediately after the existing bridge effect (the one that calls `virtualizer.scrollToIndex(activeIndex, ...)`). It needs a ref to detect the closed→open transition:

```ts
  // Highlight the committed selection when the list opens, so it's visible and
  // scrolled into view through the bridge above. Keyed on `isOpen` going true;
  // no-op for a plain search (isShowingSelection false).
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened || !isShowingSelection) return;
    const selected = selectedItems[0];
    if (selected === undefined) return;
    const index = filteredItems.indexOf(selected);
    if (index >= 0) setActiveValue(itemValue(selected, index));
  }, [isOpen, isShowingSelection, selectedItems, filteredItems, itemValue]);
```

`filteredItems` is the full `items` list while showing a selection (Task 1 bypass), so the selected item is present and `indexOf` finds it by reference.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: PASS (both new tests green, full suite green).

- [ ] **Step 5: Lint and typecheck**

Run: `bunx biome check --write src/ && bun run typecheck`
Expected: zero warnings, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/use-combobulate.ts src/core/use-combobulate.test.tsx
git commit -m "feat(core): highlight the committed selection when the list opens"
```

---

### Task 4: Dogfood — simplify the demos to use `itemToInputValue`

**Files:**
- Modify: `src/stories/useDemoCombobox.ts`
- Delete: `src/stories/useSelectionInInput.ts`
- Modify: `src/stories/Basic.stories.tsx`, `src/stories/Relative.stories.tsx`, `src/stories/WorldAirports.stories.tsx`, `src/stories/FuzzySearch.stories.tsx`, `src/stories/AsyncTypeahead.stories.tsx`

**Interfaces:**
- Consumes: `itemToInputValue` option (Task 1) and the whole committed-value model (Tasks 1–3).
- Produces: demos whose single-select behavior is now library-owned; the existing e2e (`selection.e2e.ts`, `filtering.e2e.ts`) pass unchanged = behavioral parity.

- [ ] **Step 1: Rewrite `useDemoCombobox` to drop the glue the library now owns**

Replace `src/stories/useDemoCombobox.ts` entirely. It no longer wraps the filter or fills the input — the library does. It just forwards options and adds the one remaining demo-only nicety, select-all-on-focus:

```ts
import { type FocusEvent, useCallback } from "react";
import { type CombobulateApi, type UseCombobulateOptions, useCombobulate } from "../index";

/**
 * Assembles the headless primitives into a real-combobox experience for the
 * demos. The committed-value model (fill on select, show-all for a committed
 * selection, revert on close, highlight on open) is now the library's job —
 * opt in by passing `itemToInputValue`. This hook adds only the one bit the
 * library deliberately leaves to consumers: select-all on focus, so a committed
 * value is ready to be replaced by the next keystroke.
 */
export function useDemoCombobox<T>(options: UseCombobulateOptions<T>): {
  api: CombobulateApi<T>;
  inputProps: { onFocus: (event: FocusEvent<HTMLInputElement>) => void };
} {
  const api = useCombobulate<T>(options);
  const { itemToInputValue, multiple } = options;
  const selected = !multiple && itemToInputValue ? api.selectedItems[0] : undefined;
  const committed = selected === undefined ? null : itemToInputValue?.(selected) ?? null;

  const onFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (committed !== null && event.currentTarget.value === committed) {
        event.currentTarget.select();
      }
    },
    [committed],
  );

  return { api, inputProps: { onFocus } };
}
```

- [ ] **Step 2: Delete the now-redundant selection hook**

```bash
git rm src/stories/useSelectionInInput.ts
```

Its fill-on-select and committed-tracking logic is now the library's; its select-all-on-focus moved into `useDemoCombobox` (Step 1).

- [ ] **Step 3: Pass `itemToInputValue` from the single-select stories**

In each story, the `useDemoCombobox({ ... })` call currently passes `getLabel:` (or nothing). Change to `itemToInputValue:` so the library's model turns on:

- `src/stories/Basic.stories.tsx` — add `itemToInputValue: (c) => c,` to the `useDemoCombobox({ items: CITIES, getItemId: (c) => c })` options.
- `src/stories/Relative.stories.tsx` — add `itemToInputValue: (c) => c,` to its `useDemoCombobox({ items: CITIES, defaultOpen: true, getItemId: (c) => c })` options.
- `src/stories/WorldAirports.stories.tsx` — replace `getLabel: airportLabel,` with `itemToInputValue: airportLabel,`.
- `src/stories/FuzzySearch.stories.tsx` — replace `getLabel: airportLabel,` with `itemToInputValue: airportLabel,`.
- `src/stories/AsyncTypeahead.stories.tsx` — replace `getLabel: airportLabel,` with `itemToInputValue: airportLabel,`.
- `src/stories/MultiSelect.stories.tsx` — leave unchanged (no `itemToInputValue`; chips carry the selection).

If any story still imports or references `getLabel` after this, remove the dangling reference. Confirm none import `useSelectionInInput`:

Run: `grep -rn "useSelectionInInput\|getLabel" src/stories/`
Expected: no output.

- [ ] **Step 4: Typecheck, lint, unit**

Run: `bun run typecheck && bunx biome check . && bun test`
Expected: typecheck clean, biome zero warnings, unit suite green.

- [ ] **Step 5: Verify e2e parity in a real browser**

Storybook must be running for Playwright (cold-boot under Playwright times out). Start it, wait, then run the demo-behavior e2e single-worker:

```bash
bun run storybook &
# wait until http://localhost:6006 returns 200, then:
bunx playwright test e2e/selection.e2e.ts e2e/filtering.e2e.ts --workers=1 --reporter=line
```

Expected: PASS. These assert fill-on-select, reopen-shows-the-list (not "no match"), the chosen marker, default-includes filtering, and Fuse typo tolerance — the exact behaviors now provided by the library. Then run the full suite to confirm no regression:

```bash
bunx playwright test --workers=1 --reporter=line
```

Expected: all pass. Stop Storybook afterward (`pkill -f storybook`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(demos): use the baked-in itemToInputValue; drop the local selection glue"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §3 the `itemToInputValue` option | 1 |
| §4 derived `committedValue`/`isShowingSelection` | 1 |
| §5.1 fill-on-select | 1 |
| §5.2 filter bypass while showing a selection | 1 |
| §5.3 highlight the selection on open | 3 |
| §5.4 revert-on-close (dirty→committed, none→"", clean untouched) | 2 |
| §6 `onInputChange` not fired on programmatic fill/revert | 1 (fill), 2 (revert) — asserted by spy tests |
| §7 multi-select ignores it; omitted = no change | 1 (multi + regression tests), 2 (regression), 3 (regression) |
| §8 accepted edge (query == committed shows all) | inherent to §5.2; not separately tested (documented) |
| §9 demo simplification / dogfood | 4 |
| §10 lives in core hook + types only | 1–3 |
| §11 testing | 1–4 |

**Placeholder scan:** none — every code step carries complete code; no "TBD"/"handle edge cases"/"similar to Task N".

**Type consistency:** `itemToInputValue: (item: T) => string` is defined once (Task 1, types.ts) and consumed under that exact name in the hook (Tasks 1–3) and the demos (Task 4). `committedValue: string` and `isShowingSelection: boolean` are derived once in Task 1 and referenced by name in Task 2 (`committedValue`) and Task 3 (`isShowingSelection`). `setInputValueState` (raw setter) is the existing state setter used by fill (Task 1) and revert (Task 2); `setActiveValue`, `itemValue`, `filteredItems`, `selectedItems` are existing api members used consistently in Task 3.

**Deviation from spec, deliberate:** none. The plan implements the spec as written; the demo `useDemoCombobox` re-derives `committed` for the select-all-on-focus nicety (spec §2/§9 keep select-all out of the library), a couple of lines of demo glue rather than a new public `isShowingSelection` api field.

**Ordering note:** Task 1 derives `committedValue`/`isShowingSelection` and must land before Tasks 2 (uses `committedValue`) and 3 (uses `isShowingSelection`). Task 4 depends on all three.
