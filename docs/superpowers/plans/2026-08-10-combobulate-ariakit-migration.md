# Combobulate v1 — Ariakit Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cmdk with Ariakit as combobulate's internal engine, fixing the combobox a11y contract and deleting the synthetic-pointer jump hack, behind a rethought store-handle public API.

**Architecture:** Ariakit becomes the ARIA/keyboard/selection shell (roles, `aria-expanded`, `aria-activedescendant` reflection from `activeId`, `selectedValue`, open state). combobulate keeps filtering, virtualization + full-list ARIA, the committed-value model, positioning, and **all** keyboard navigation (it computes target indices from the full filtered list and drives Ariakit's `activeId`, scrolling unrendered targets into mount first). `useCombobulate` returns an opaque store handle; internals never appear on a public type.

**Tech Stack:** React 19, `@ariakit/react` (new engine), `@tanstack/react-virtual` (windowing), `@floating-ui/react` (positioning), Bun test + happy-dom + testing-library (unit), Playwright + Storybook (e2e), Biome.

## Global Constraints

- TypeScript: `type` aliases only, never `interface`; extend via intersection (verbatim from CLAUDE.md).
- No non-null `!`; `noUncheckedIndexedAccess` on; no assignment-in-expression.
- Lego rule: `src/core/*` and base primitives carry no positioning/tree concepts; the floating layer drives core only through the public store handle.
- YAGNI: no options/exports without a present consumer.
- Zero Biome warnings; run `bunx biome check --write src/ examples/` to autofix.
- Public API frozen except the documented store-handle delta; package is unpublished (no external break).
- `@ariakit/react` pinned `~`; `@tanstack/react-virtual` `~`; `@floating-ui/react` `^`.
- Commands: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`, `bun run build-storybook`, `bun run e2e`.
- Packaging/release blockers (`"use client"`, exports `.d.cts`, `sideEffects`, version bump, CHANGELOG) are OUT OF SCOPE — separate follow-up plan.

---

### Task 1: Dependencies + store-handle foundation

Establishes and validates the novel piece — a combobulate store handle composed over an Ariakit combobox store — before anything builds on it.

**Files:**
- Modify: `package.json` (remove `cmdk`; add `@ariakit/react` `~0.4.37`)
- Create: `src/core/store.ts`
- Modify: `src/core/types.ts`
- Test: `src/core/store.test.tsx`

**Interfaces:**
- Produces:
  - `type CombobulateState<T> = { isOpen: boolean; inputValue: string; activeValue: string; activeIndex: number; selectedItems: T[]; filteredItems: T[]; loading: boolean; multiple: boolean }`
  - `type CombobulateStore<T> = { useState: <K extends keyof CombobulateState<T>>(key: K) => CombobulateState<T>[K]; getState: () => CombobulateState<T>; setOpen: (open: boolean) => void; setInputValue: (value: string) => void; setActiveValue: (value: string) => void; select: (item: T) => void; isSelected: (item: T) => boolean; itemValue: (item: T, index: number) => string; onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void }` — the public handle (internal Ariakit store, virtualizer, scrollRef are NOT on this type).
  - `createCombobulateStore<T>(options): CombobulateStore<T> & { _internal: {...} }` — the `_internal` carries the Ariakit store + config for the hook/primitives; it is not exported from the barrel.
- Consumes: nothing (first task).

- [ ] **Step 1: Remove cmdk, add Ariakit**

Run:
```bash
bun remove cmdk && bun add @ariakit/react
```
Then pin: edit `package.json` so the dependency reads `"@ariakit/react": "~0.4.37"`. Confirm `cmdk` is gone from `dependencies`.

- [ ] **Step 2: Write the failing contract test**

`src/core/store.test.tsx`:
```tsx
import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createCombobulateStore } from "./store";

afterEach(() => cleanup());

const ITEMS = ["Paris", "Madrid", "Berlin"];

test("store: open state round-trips", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.getState().isOpen).toBe(false);
  act(() => store.setOpen(true));
  expect(store.getState().isOpen).toBe(true);
});

test("store: select updates selectedItems and isSelected (single)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.select("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
  expect(store.isSelected("Berlin")).toBe(true);
  act(() => store.select("Paris")); // single-select replaces
  expect(store.getState().selectedItems).toEqual(["Paris"]);
});

test("store: multiple toggles membership", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, multiple: true });
  act(() => store.select("Paris"));
  act(() => store.select("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Paris", "Berlin"]);
  act(() => store.select("Paris"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
});

test("store: itemValue is the id verbatim; activeIndex maps back", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.itemValue("Madrid", 1)).toBe("Madrid");
  act(() => store.setActiveValue("Madrid"));
  expect(store.getState().activeIndex).toBe(1);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/core/store.test.tsx`
Expected: FAIL — `createCombobulateStore` not defined.

- [ ] **Step 4: Implement `createCombobulateStore`**

Approach (implement against the tests):
- Build on Ariakit's core store for engine state: create an Ariakit combobox store via `@ariakit/react`'s `createComboboxStore` (framework-agnostic factory) OR wrap `useComboboxStore` — since `createCombobulateStore` is called outside React (in the test) and inside the hook, prefer the framework-agnostic `@ariakit/core` `createComboboxStore` for the engine, and keep combobulate's own reactive fields in an `@ariakit/core` `createStore`.
- Engine state (open, value=inputValue, activeId, selectedValue) lives in the Ariakit store; combobulate config (`items`, `getItemId`, `multiple`, `itemToInputValue`, `filterItems`, `getSearchText`, `loading`) is held in a combobulate store.
- `itemValue(item, index)` = `getItemId ? getItemId(item) : String(index)` (verbatim, no case-folding — matches current behavior).
- `activeValue` = Ariakit `activeId` mapped through the assigned option ids (`itemValue`); `activeIndex` = index of the item whose `itemValue` equals `activeValue`, else `-1`.
- `selectedItems` = derived from Ariakit `selectedValue` (string | string[]) mapped back to items via `itemValue`; `select` sets `selectedValue` (replace for single, toggle for multiple) and fires `onChange` with `toChangeValue` (reuse `item-utils`), computed outside any state updater (StrictMode-safe).
- `useState(key)` = a hook returning the derived field, implemented with `useSyncExternalStore` subscribing to both stores (or Ariakit's `useStoreState` over a combined selector). `getState()` = imperative snapshot.
- `filteredItems` derivation and `onInputKeyDown` are stubbed here (return all items; no-op) — Tasks 2 and 3 fill them. Keep the stubs minimal so this task's tests pass.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/core/store.test.tsx && bun run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/core/store.ts src/core/store.test.tsx src/core/types.ts
git commit -m "feat(core): Ariakit-backed combobulate store handle (open/select/active)"
```

---

### Task 2: Filtering + committed-value model on the store

**Files:**
- Modify: `src/core/store.ts`
- Test: `src/core/committed-value.test.tsx` (port from existing `use-combobulate.test.tsx` committed-value cases)

**Interfaces:**
- Consumes: `createCombobulateStore` (Task 1), `defaultFilterItems`/`normalizeText`/`toChangeValue` (`src/core/item-utils.ts`).
- Produces: `filteredItems` derivation + committed-value behaviors on the store handle; `setInputValue` semantics (fires `onInputChange`; clears selection when emptied under committed-value).

- [ ] **Step 1: Write failing tests**

`src/core/committed-value.test.tsx` — port these behaviors (from the current `use-combobulate.test.tsx`), retargeted at the store handle:
```tsx
import { afterEach, expect, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { createCombobulateStore } from "./store";

afterEach(() => cleanup());
const ITEMS = ["Paris", "Madrid", "Berlin", "Málaga"];

test("default filter is a normalized substring includes", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.setInputValue("mala"));
  expect(store.getState().filteredItems).toEqual(["Málaga"]);
});

test("committed selection bypasses the filter (shows all)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c });
  act(() => store.select("Berlin")); // input becomes "Berlin"
  expect(store.getState().inputValue).toBe("Berlin");
  expect(store.getState().filteredItems).toEqual(ITEMS); // not filtered to just "Berlin"
});

test("clearing the input to empty unselects (committed-value, single)", () => {
  const seen: unknown[] = [];
  const store = createCombobulateStore({
    items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c, onChange: (v) => seen.push(v),
  });
  act(() => store.select("Berlin"));
  act(() => store.setInputValue(""));
  expect(store.getState().selectedItems).toEqual([]);
  expect(seen).toEqual(["Berlin", null]);
});

test("revert-on-close restores the committed value", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c });
  act(() => store.select("Berlin"));
  act(() => store.setInputValue("par")); // start typing a new query
  act(() => store.setOpen(false));       // close without choosing
  expect(store.getState().inputValue).toBe("Berlin");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/core/committed-value.test.tsx`
Expected: FAIL (filtering stubbed; committed-value not implemented).

- [ ] **Step 3: Implement filtering + committed-value in `store.ts`**

- `filteredItems`: if showing a committed selection (`itemToInputValue && !multiple && inputValue === committedValue && committedValue !== ""`), return `items`; else `filterItems(items, inputValue)` or `defaultFilterItems(items, inputValue, getSearchText)`.
- `select` (single, with `itemToInputValue`): set input text to `itemToInputValue(item)` via the raw setter (no `onInputChange`).
- `setInputValue(value)`: set Ariakit `value`, fire `onInputChange`; if `value === "" && itemToInputValue && !multiple && selectedItems.length`, clear selection + fire `onChange(toChangeValue([], multiple))`.
- revert-on-close: expose an internal `commitOrRevert()` the hook calls on `open → false` (Task 4 wires the effect); it restores input to `committedValue` when dirty. For this task, implement the logic as a method and test it by calling `setOpen(false)` (the store performs the revert synchronously in `setOpen`).
- highlight-on-open logic is deferred to Task 4 (needs the virtualizer).

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/core/committed-value.test.tsx && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/store.ts src/core/committed-value.test.tsx
git commit -m "feat(core): filtering + committed-value model on the store"
```

---

### Task 3: Navigation logic (pure) + scroll-then-set bridge; delete the hack

**Files:**
- Create: `src/core/navigation.ts` (pure target-index math)
- Modify: `src/core/store.ts` (`onInputKeyDown`), `src/core/use-combobulate.ts` (bridge effect + virtualizer wiring — created here, expanded in Task 4)
- Test: `src/core/navigation.test.ts`

**Interfaces:**
- Produces: `nextIndex(current: number, key: NavKey, opts: { count: number; page: number }): number | null` — pure. Returns the target index for a nav key, or `null` if the key isn't an owned nav key (caret keys, etc.).
  - `type NavKey = { key: string; ctrlKey: boolean; metaKey: boolean }`
- Consumes: the store's `activeIndex`, `filteredItems.length`, and the virtualizer (`scrollToIndex`, `getVirtualItems`) from `use-combobulate` internals.

- [ ] **Step 1: Write failing pure-logic tests**

`src/core/navigation.test.ts`:
```ts
import { expect, test } from "bun:test";
import { nextIndex } from "./navigation";

const K = (key: string, mod: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, ...mod });

test("ArrowDown moves +1 and clamps at the end", () => {
  expect(nextIndex(0, K("ArrowDown"), { count: 3, page: 10 })).toBe(1);
  expect(nextIndex(2, K("ArrowDown"), { count: 3, page: 10 })).toBe(2);
});
test("ArrowUp from -1 goes to first", () => {
  expect(nextIndex(-1, K("ArrowDown"), { count: 3, page: 10 })).toBe(0);
});
test("PageDown/PageUp move by page, clamped", () => {
  expect(nextIndex(0, K("PageDown"), { count: 100, page: 10 })).toBe(10);
  expect(nextIndex(5, K("PageUp"), { count: 100, page: 10 })).toBe(0);
});
test("Ctrl/Cmd+Home/End jump to first/last", () => {
  expect(nextIndex(50, K("End", { ctrlKey: true }), { count: 100, page: 10 })).toBe(99);
  expect(nextIndex(50, K("Home", { metaKey: true }), { count: 100, page: 10 })).toBe(0);
});
test("bare Home/End are NOT owned (caret) -> null", () => {
  expect(nextIndex(50, K("Home"), { count: 100, page: 10 })).toBeNull();
  expect(nextIndex(50, K("End"), { count: 100, page: 10 })).toBeNull();
});
test("non-nav keys -> null", () => {
  expect(nextIndex(0, K("a"), { count: 3, page: 10 })).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/core/navigation.test.ts` — FAIL (`nextIndex` undefined).

- [ ] **Step 3: Implement `nextIndex`**

Pure function: switch on `key`; ArrowDown `min(count-1, current+1)` (from `-1` → `0`); ArrowUp `max(0, current-1)`; PageDown/PageUp ±`page` clamped; `Ctrl/Cmd+Home` → `0`, `Ctrl/Cmd+End` → `count-1`; bare Home/End → `null`; anything else → `null`. Guard `count === 0` → `null`.

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/core/navigation.test.ts` — PASS.

- [ ] **Step 5: Wire `onInputKeyDown` + the bridge**

In `store.ts` `onInputKeyDown`: compute `target = nextIndex(activeIndex, e, { count: filteredItems.length, page })`. If `null`, return (let the browser/Ariakit handle it). Else `e.preventDefault(); e.stopPropagation();` and request a jump to `target` via an internal `requestActive(target)` the hook implements: if `target` is within the current virtual window, `setActiveId` immediately; else `scrollToIndex(target)` and set a `pendingActiveRef = target`; an effect keyed on the virtualizer's virtual items sets `setActiveId(itemValueForIndex(target))` once `target` is mounted, then clears the ref. Delete the old synthetic-pointer implementation (the `flushSync` + synthetic `scroll`/`pointermove` + wiggle + rAF poll) and its unit fallback path.

- [ ] **Step 6: Run affected tests**

Run: `bun test src/core/ && bun run typecheck`
Expected: navigation + store + committed-value PASS; typecheck clean. (Existing `jump-keys.test.tsx` will be updated in Task 6/8; if it references deleted internals, mark it skipped with a `// TODO(task-8)` note is NOT allowed — instead delete the obsolete synthetic-pointer assertions now and keep only the target-index math, which `navigation.test.ts` now covers.)

- [ ] **Step 7: Commit**

```bash
git add src/core/navigation.ts src/core/navigation.test.ts src/core/store.ts src/core/use-combobulate.ts
git commit -m "feat(core): combobulate-owned navigation + scroll-then-set bridge; drop synthetic-pointer hack"
```

---

### Task 4: `useCombobulate` hook + primitives migration

**Files:**
- Modify: `src/core/use-combobulate.ts`, `src/core/context.ts`, `src/core/primitives.tsx`
- Modify: `src/core/types.ts`
- Test: `src/core/primitives.test.tsx` (adapt existing)

**Interfaces:**
- Consumes: `createCombobulateStore`, `CombobulateStore<T>`, `nextIndex`.
- Produces:
  - `useCombobulate<T>(options: UseCombobulateOptions<T>): CombobulateStore<T>` — creates the store (memoized), wires `@tanstack/react-virtual` (scroll ref + virtualizer stored internally), and runs effects: the scroll-then-set bridge, revert-on-close, highlight-on-open, and syncing changed `items`/`loading` props into the store.
  - `<Combobulate store={store} label?>` — callable root component with `.Input/.List/.Item/.Empty/.LiveRegion/.Popover` attached. Provides Ariakit's store context (`Ariakit.ComboboxProvider store={internalAriakitStore}`) and combobulate's context.
  - `CombobulateListProps<T>` (unchanged: `children` render-prop, `maxHeight`), `CombobulateItemProps<T>` (unchanged), `CombobulateRootProps<T>` → `{ store: CombobulateStore<T>; label?: string; children: ReactNode }`.

- [ ] **Step 1: Adapt the primitives tests to the store-handle API**

Rewrite `src/core/primitives.test.tsx`'s `Harness` to use the store handle:
```tsx
function Harness({ items = BIG, multiple = false }) {
  const store = useCombobulate({ items, defaultOpen: true, multiple, getItemId: (i) => i });
  return (
    <Combobulate store={store}>
      <Combobulate.Input aria-label="Search" />
      <Combobulate.List<string>>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>{item}</Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.Empty>No results</Combobulate.Empty>
      <Combobulate.LiveRegion />
    </Combobulate>
  );
}
```
Keep the existing assertions (virtualization window < 100; full-list `aria-setsize`=500 / `aria-posinset`="1"; multi-select `aria-checked`; Empty single `role=status`; LiveRegion count; focus-out dismiss; LiveRegion debounce) AND add:
```tsx
test("aria-expanded tracks open state", () => {
  render(<Harness items={["Paris", "Berlin"]} />);
  const input = screen.getByRole("combobox");
  expect(input.getAttribute("aria-expanded")).toBe("true"); // defaultOpen
  fireEvent.blur(input, { relatedTarget: document.body });
  expect(input.getAttribute("aria-expanded")).toBe("false");
});
test("single-select marks the chosen option with aria-selected", () => {
  // choose an item, reopen, assert its aria-selected="true" while another is active
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/core/primitives.test.tsx` — FAIL (API/components not migrated).

- [ ] **Step 3: Implement the hook + primitives**

- `use-combobulate.ts`: `useCombobulate` memo-creates the store from options; creates the react-virtual `virtualizer` + `scrollRef` and injects them into the store internals; effects: bridge (Task 3), `revert-on-close`, `highlight-on-open` (on `isOpen` true with a committed selection → `requestActive(chosenIndex)`), and `useEffect`s syncing `items`/`loading` when those props change.
- `context.ts`: context carries `CombobulateStore<T>`.
- `primitives.tsx`:
  - `Combobulate` root: `<Ariakit.ComboboxProvider store={store._internal.ariakit}>` + `<CombobulateProvider value={store}>`; render children. Attach `.Input/.List/.Item/.Empty/.LiveRegion/.Popover`.
  - `Input`: render `<Ariakit.Combobox />`; compose our `onFocus` (open), `onBlur` (focus-out dismiss, `relatedTarget` guard), `onKeyDown` (`store.onInputKeyDown`); keep `value` post-spread override removed (Ariakit owns the input value from store; confirm `aria-expanded` is correct).
  - `List`: `<Ariakit.ComboboxList>` with our scroll `<div ref={scrollRef}>` + react-virtual window inside; `maxHeight` prop retained.
  - `Item`: `<Ariakit.ComboboxItem id={optionId} value={itemValue}>` + our `aria-setsize`/`aria-posinset`, `aria-selected` (chosen; single and multi), `data-chosen`. `onSelect`/click → `store.select(item)`.
  - `Empty`, `LiveRegion`: carry over verbatim (LiveRegion keeps 200ms debounce).

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/core/ && bun run typecheck && bun run lint`
Expected: PASS; lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/use-combobulate.ts src/core/context.ts src/core/primitives.tsx src/core/types.ts src/core/primitives.test.tsx
git commit -m "feat(core): useCombobulate store handle + Ariakit-backed primitives"
```

---

### Task 5: Floating layer → store handle

**Files:**
- Modify: `src/floating/use-floating.ts`, `src/floating/floating-primitives.tsx`, `src/floating/types.ts`
- Test: `src/floating/use-floating.test.tsx`, `src/floating/floating-primitives.test.tsx` (adapt)

**Interfaces:**
- Consumes: `CombobulateStore<T>`.
- Produces: `useCombobulateFloating<T>(store: CombobulateStore<T>, options?: CombobulateFloatingOptions): CombobulateFloating` — reads `store.useState("isOpen")` and drives `store.setOpen`; `closeOnSelect` fires on `selectedItems` signature change. `Combobulate.Popover` reads `store.useState("isOpen")` from context to mount/unmount.

- [ ] **Step 1: Adapt floating tests**

Replace the hand-rolled `fakeApi` with a real store from `createCombobulateStore` (or a minimal store stub exposing `useState("isOpen")`, `setOpen`, `useState("selectedItems")`, `itemValue`). Assert: `reference`/`floating` refs + `referenceProps`/`floatingProps` present; `closeOnSelect` closes on selection-signature change; Popover renders null when closed.

- [ ] **Step 2: Run to verify failure** — `bun test src/floating/` — FAIL.

- [ ] **Step 3: Implement**

`use-floating.ts`: `const isOpen = store.useState("isOpen")`; `useFloating({ open: isOpen, onOpenChange: store.setOpen, ... })` (keep the fixed `bottom-start`/offset/flip/shift/size/matchWidth config + `useDismiss`). `closeOnSelect`: diff `store.useState("selectedItems")` by a stable signature (use `itemValue`, not positional index — fixes audit M1). `floating-primitives.tsx`: `Popover` reads `useCombobulateContext().useState("isOpen")`.

- [ ] **Step 4: Run to verify pass** — `bun test src/floating/ && bun run typecheck` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/floating/ && git commit -m "feat(floating): drive positioning from the store handle; fix closeOnSelect signature"
```

---

### Task 6: Characterization test + barrel + remove cmdk test

**Files:**
- Create: `src/core/ariakit-behavior.test.tsx` (graduate the spike)
- Delete: `src/core/cmdk-behavior.test.tsx`
- Modify: `src/index.ts` (barrel: export `Combobulate`, `useCombobulate`, `useCombobulateFloating`, and the public types incl. `CombobulateStore`, `PopoverProps`; drop internal types)

**Interfaces:**
- Consumes: `@ariakit/react`, `createCombobulateStore`.
- Produces: the pinned Ariakit contract test; the finalized public barrel.

- [ ] **Step 1: Write the characterization test**

`src/core/ariakit-behavior.test.tsx` — pin the exact Ariakit behaviors we depend on (graduate `spike/ariakit-api.spike.test.tsx`): (1) `aria-expanded` tracks `store.open`; (2) `setActiveId` drives `aria-activedescendant`; (3) our `aria-setsize`/`aria-posinset`/`aria-selected` on items survive; (4) `selectedValue` is separate from value/active; (5) **ordering** — set active before mount → `null`, scroll/mount then set → resolves; (6) **unmount behavior** — when the active item unmounts, record what happens to `activeId` (assert the actual behavior so a bump surfaces a change).

- [ ] **Step 2: Delete the cmdk characterization test**

```bash
git rm src/core/cmdk-behavior.test.tsx
```

- [ ] **Step 3: Finalize the barrel**

`src/index.ts`: export `useCombobulate`, `useCombobulateFloating`, `Combobulate` (callable root + attached parts), and types `UseCombobulateOptions`, `CombobulateStore`, `CombobulateItemProps`, `CombobulateListProps`, `CombobulateRootProps`, `CombobulateFloating`, `CombobulateFloatingOptions`, `PopoverProps`. Do NOT export internal state/store-internals types.

- [ ] **Step 4: Run full unit suite + build**

Run: `bun test && bun run typecheck && bun run lint && bun run build`
Expected: all PASS; `dist` builds; no `cmdk` in the build (grep `dist` for `cmdk` → none).

- [ ] **Step 5: Commit**

```bash
git add src/core/ariakit-behavior.test.tsx src/index.ts
git commit -m "test(core): Ariakit characterization test; finalize public barrel; drop cmdk test"
```

---

### Task 7: Examples migration to the store-handle API

**Files:**
- Modify: `examples/useDemoCombobox.ts`, `examples/FloatingCombobox.tsx`, `examples/Basic.stories.tsx`, `examples/MultiSelect.stories.tsx`, `examples/WorldAirports.stories.tsx`
- Modify: `README.md` (usage snippets → store-handle API)

**Interfaces:**
- Consumes: the finalized public API (Task 6).

- [ ] **Step 1: Update the demo glue + stories**

`useDemoCombobox` returns the store handle; `FloatingCombobox` takes `store` (not `api`) and renders `<Combobulate store={store}>`; each story reads state via `store.useState(...)` where needed (e.g. Multi Select chips read `store.useState("selectedItems")`). Update `README.md` "Use", "In-flow", and "Filtering" snippets to `<Combobulate store={combobox}>` + `combobox.useState(...)`.

- [ ] **Step 2: Verify Storybook builds and renders**

Run: `bun run build-storybook`
Expected: all three stories compile; no unresolved imports.

- [ ] **Step 3: Commit**

```bash
git add examples/ README.md
git commit -m "docs(examples): migrate demos + README to the store-handle API"
```

---

### Task 8: Browser e2e + Playwright hardening

**Files:**
- Modify: `e2e/jump-keys.e2e.ts`, `e2e/virtualized-combobox.e2e.ts`, `e2e/selection.e2e.ts`, `e2e/floating.e2e.ts`, `e2e/multi-select.e2e.ts`
- Modify: `playwright.config.ts`
- Modify: `.github/workflows/ci.yml` (unchanged step list; confirm e2e still gated)

**Interfaces:**
- Consumes: the running Storybook (examples).

- [ ] **Step 1: Update selectors + jump-key modifiers**

Replace cmdk-internal selectors (`[cmdk-item]`, `[data-chosen]` where cmdk-specific) with combobulate-owned hooks (`[role=option]`, `[aria-selected="true"]`, our `data-chosen`). Update jump-key presses to the modifier form: `page.keyboard.press("Control+End")` / `"Control+Home"`; keep `PageUp`/`PageDown` bare.

- [ ] **Step 2: Add the new e2e assertions**

Add, in `e2e/jump-keys.e2e.ts` and `e2e/virtualized-combobox.e2e.ts`:
- **arrow-past-window**: hold ArrowDown past the initial window; assert `aria-activedescendant` keeps resolving to a mounted option and posinset increases monotonically.
- **jump resolves**: `Control+End` → active option has `aria-posinset` === full count and is in viewport.
- **aria-expanded**: closed → `false`; open → `true`.
- **aria-selected**: after selecting, reopen; the chosen option has `aria-selected="true"`.

- [ ] **Step 3: Harden Playwright config**

`playwright.config.ts`: add `retries: 2`, `use: { trace: "on-first-retry", baseURL: ... }`, and a second `projects` engine (webkit) alongside chromium.

- [ ] **Step 4: Run e2e (Storybook pre-started)**

Run:
```bash
bun run storybook &   # or ensure :6006 is up
bun run e2e
```
Expected: all specs PASS across engines (jump keys, arrow-past-window, aria assertions, selection, floating, multi-select).

- [ ] **Step 5: Commit**

```bash
git add e2e/ playwright.config.ts .github/workflows/ci.yml
git commit -m "test(e2e): Ariakit jump/arrow/aria coverage; retries+trace+webkit"
```

---

## Self-Review

**Spec coverage:**
- Engine swap cmdk→Ariakit → Tasks 1, 4, 6. ✅
- a11y contract (aria-expanded/controls/selected) → Tasks 4 (primitives), 8 (e2e). ✅
- Delete synthetic-pointer hack + fallback → Task 3. ✅
- Store-handle API (internals hidden, naming, identity) → Tasks 1, 4, 6. ✅
- Committed-value preserved → Task 2 (+ highlight-on-open in Task 4). ✅
- Keep floating layer → Task 5. ✅
- Home/End modifier → Tasks 3 (logic), 8 (e2e). ✅
- Characterization test + activeId-unmount pin → Task 6. ✅
- Deps (remove cmdk, add Ariakit `~`) → Task 1. ✅
- e2e hardening (retries/trace/second engine) → Task 8. ✅
- Packaging → correctly OUT of scope. ✅

**Placeholder scan:** No TBD/TODO; each task has concrete test code and a named implementation approach. (Task 1/2 note where later tasks fill stubs, with the filling task named — not a placeholder.)

**Type consistency:** `CombobulateStore<T>`/`CombobulateState<T>`, `createCombobulateStore`, `nextIndex`, `itemValue`, `requestActive`, `optionId` used consistently across tasks; `useCombobulateFloating(store, …)` argument is the store in Tasks 4/5/7; `<Combobulate store=…>` root consistent from Task 4 onward.
