# Combobulate cmdk Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild combobulate's core as a headless, accessible, properly virtualized combobox on top of cmdk — deleting the hand-rolled state machine, the styled preset, and the demo playground.

**Architecture:** cmdk owns keyboard nav, roles, and the highlighted item (surfaced via controlled `value`/`onValueChange`, with `shouldFilter={false}`). A single `useCombobulate()` hook owns everything cmdk doesn't: filtering, selection, input/open state, the TanStack virtualizer, and the value→index bridge that keeps the active row mounted. `Combobulate.*` primitives wrap cmdk and add full-list `aria-setsize`/`aria-posinset` plus correct jump keys. `@floating-ui/react` provides the opt-in dropdown.

**Tech Stack:** React 19, cmdk 1.1.1, @tanstack/react-virtual 3, @floating-ui/react 0.27, TypeScript 5.7, Bun (test/run), Biome, tsup, Playwright, Storybook (react-vite).

**Spec:** [2026-07-16-combobulate-cmdk-rebuild-design.md](../specs/2026-07-16-combobulate-cmdk-rebuild-design.md)

## Global Constraints

- **TypeScript:** Favor `type` aliases over `interface`. Use intersections (`type B = A & {...}`), never `interface B extends A`.
- **Abstraction:** Prefer a little duplication over premature abstraction. No options/hooks/layers without a real present consumer (YAGNI).
- **Lego rule:** `src/core/*` contains **no tree concepts** (no expandedIds/depth/parentId/getChildren).
- **Tooling:** Bun. `bun test`, `bun run lint`, `bun run typecheck`, `bun run build`, `bun run e2e`.
- **Biome:** Zero warnings required. Bans non-null `!` (`noNonNullAssertion`), unchecked index access, assignment-in-expression (use block-body arrows). An inert `biome-ignore` emits an unused-suppression warning — only add one that actually suppresses. Autofix with `bunx biome check --write src/`.
- **`noUncheckedIndexedAccess: true`** — every `array[i]` is `T | undefined`. Guard with `if (item === undefined) return`, never `!`.
- **Dependency rule:** peer = React only (singleton requirement). `cmdk`, `@floating-ui/react`, `@tanstack/react-virtual` are regular `dependencies`. `fuse.js` is never bundled (devDependency, stories only).
- **v1 surface:** headless only. No preset, no `styles.css`, no tree exports.
- **Commit frequently.** Conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

---

## File Structure

**Created:**
- `src/core/use-combobulate.ts` — the single orchestration hook (state, filter, selection, virtualizer, bridge, jump keys).
- `src/core/primitives.tsx` — `Root`, `Input`, `List`, `Item`, `Empty`, `LiveRegion` (cmdk-backed).
- `src/core/context.ts` — combobulate context (moved from `src/primitives/context.ts`).
- `src/core/merge-props.ts` — moved from `src/primitives/merge-props.ts` (still needed: floating's `onKeyDown` composes with the jump-key handler).
- `src/core/cmdk-behavior.test.tsx` — characterization tests pinning cmdk's value/keyboard semantics.
- `src/stories/*.stories.tsx` — integration docs/demos.
- `src/stories/data/{airports.json,types.ts}` — salvaged dataset.
- `scripts/build-airports.ts` — salvaged dataset builder.
- `.storybook/{main.ts,preview.ts}`.

**Modified:**
- `src/core/types.ts` — replaced with `UseCombobulateOptions` / `CombobulateApi`.
- `src/floating/use-floating.ts` — retargeted to `CombobulateApi`.
- `src/floating/floating-primitives.tsx` — retargeted context import.
- `src/index.ts` — new public surface.
- `package.json`, `tsconfig.json`, `tsup.config.ts`, `playwright.config.ts`, `biome.json`.

**Deleted:**
- `src/core/use-autocomplete.ts`, `src/core/use-autocomplete-virtual.ts` (+ their tests), `src/core/use-autocomplete-aria.test.tsx`
- `src/primitives/` (after moving context + merge-props)
- `src/presets/` (all, incl. `styles.css`)
- `examples/` (entire playground)
- `e2e/{hero,nested-tree,multi-select,async-typeahead,world-airports,floating}.e2e.ts` (rewritten in Task 9)

**Retained (survives untouched):** `src/core/item-utils.ts`, `src/floating/types.ts`, `src/test-utils/stub-element-layout.ts`.

**Parked (frozen, excluded from build):** `src/tree/*` — source kept, dropped from exports/tests/tsconfig.

---

### Task 1: Reset the repo — salvage data, delete demos/presets, park the tree, fix deps

**Files:**
- Create: `src/stories/data/airports.json`, `src/stories/data/types.ts`, `scripts/build-airports.ts`
- Modify: `package.json`, `tsconfig.json`, `tsup.config.ts`, `biome.json`, `src/index.ts`
- Delete: `examples/`, `src/presets/`, `src/tree/*.test.*`, `e2e/nested-tree.e2e.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a green baseline (`bun test`, `bun run typecheck`, `bun run lint` all pass) where `src/index.ts` still exports the **old** engine minus presets/tree. The old engine is deleted in Task 7, once the new one replaces it.

- [ ] **Step 1: Salvage the airport dataset and its builder**

```bash
mkdir -p src/stories/data
git mv examples/playground/src/data/airports.json src/stories/data/airports.json
git mv examples/playground/src/data/types.ts src/stories/data/types.ts
git mv examples/playground/scripts/build-airports.ts scripts/build-airports.ts
```

`geography.json` and `popular.ts` are nested/hero-specific — they are not salvaged (nesting is parked, hero is cut).

- [ ] **Step 2: Delete the demos, presets, tree tests, and nested e2e**

```bash
git rm -r --quiet examples src/presets
git rm --quiet src/tree/tree-primitives.test.tsx src/tree/tree-utils.test.ts src/tree/use-tree.test.tsx
git rm --quiet e2e/nested-tree.e2e.ts
```

- [ ] **Step 3: Drop preset + tree exports from `src/index.ts`**

Replace the whole file with (old engine still exported — it is removed in Task 7):

```ts
export { useAutocomplete } from "./core/use-autocomplete";
export type { AutocompleteApi, UseAutocompleteOptions } from "./core/types";
export { useAutocompleteVirtual } from "./core/use-autocomplete-virtual";
export type {
  AutocompleteVirtualApi,
  UseAutocompleteVirtualOptions,
} from "./core/use-autocomplete-virtual";
import { Popover } from "./floating/floating-primitives";
import { Combobulate as CombobulateBase } from "./primitives/combobulate";
/** Headless Combobulate primitives (base + floating layer). */
export const Combobulate = { ...CombobulateBase, Popover };
export type {
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./primitives/combobulate";
export { useAutocompleteFloating } from "./floating/use-floating";
export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";
```

- [ ] **Step 4: Park the tree — exclude it from typecheck/build**

In `tsconfig.json`, add an `exclude` sibling to `include` (the tree depends on core types that Task 3 rewrites; excluding it stops it rot-blocking CI):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "types": ["bun", "react", "react-dom"]
  },
  "include": ["src", "test-setup.ts", "tsup.config.ts", "e2e", "playwright.config.ts"],
  "exclude": ["src/tree", "examples"]
}
```

Add a freeze note at the top of `src/tree/use-tree.ts` (above the imports):

```ts
/**
 * PARKED — not part of the v1 public surface.
 *
 * The nested tree layer is frozen while the core is rebuilt on cmdk. This
 * directory is excluded from tsconfig/build and exports, and is retained
 * verbatim so it can be re-homed onto the cmdk core when nesting is un-parked.
 * It does NOT compile against the current core types. See
 * docs/superpowers/specs/2026-07-16-combobulate-cmdk-rebuild-design.md §2.
 */
```

- [ ] **Step 5: Fix dependencies and scripts in `package.json`**

Install cmdk, promote the virtualizer to a real dependency, drop workspaces + the styles export:

```bash
bun remove @tanstack/react-virtual
bun add cmdk@^1.1.1 @tanstack/react-virtual@^3.10.9
bun add -d fuse.js@^7.0.0
```

Then hand-edit `package.json` so these keys read exactly:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "lint": "biome check .",
    "format": "biome format --write .",
    "e2e": "playwright test"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "dependencies": {
    "@floating-ui/react": "^0.27",
    "@tanstack/react-virtual": "^3.10.9",
    "cmdk": "^1.1.1"
  },
```

Remove entirely: the `"workspaces"` key, the `"./styles.css"` export, the `"sideEffects"` key (no CSS ships), and the `"dev"` script (the playground is gone; Storybook replaces it in Task 8).

- [ ] **Step 6: Point tsup at the single JS entry**

Replace `tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // react/react-dom are peers; tsup externalizes `dependencies` automatically,
  // so cmdk, @floating-ui/react and @tanstack/react-virtual stay unbundled too.
  external: ["react", "react-dom"],
});
```

- [ ] **Step 7: Drop the playground path from `biome.json` ignores**

Replace the `files.ignore` array (the playground path no longer exists; the generated dataset moved):

```json
  "files": {
    "ignore": [
      "dist",
      "node_modules",
      "playwright-report",
      "test-results",
      ".claude",
      "storybook-static",
      "src/stories/data/*.json"
    ]
  }
```

- [ ] **Step 8: Verify the baseline is green**

Run: `bun run typecheck && bun run lint && bun test`
Expected: all pass. Tests for `use-autocomplete`, `use-autocomplete-virtual`, `combobulate`, `item-utils`, and the floating layer still run (the old engine is intact); no preset/tree tests remain.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: reset for cmdk rebuild — salvage airport data, cut demos/presets, park tree, fix deps"
```

---

### Task 2: Characterize cmdk's value and keyboard semantics

**Why:** The whole design assumes (a) `onValueChange` round-trips the exact `value` string we set on `Command.Item`, and (b) cmdk binds Home/End itself on the `<Command>` root, so an Input-level handler can preempt it via `stopPropagation`. Both are load-bearing and neither is documented. Pin them with executable tests **before** building on them.

**Files:**
- Create: `src/core/cmdk-behavior.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: verified facts consumed by Tasks 3–5. If a test reveals different behavior, **stop and report** — Task 5's design depends on it.

- [ ] **Step 1: Write the characterization tests**

```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Command } from "cmdk";
import { useState } from "react";

/** Renders a plain cmdk command with filtering off — our exact usage mode. */
function Harness({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState("Alpha-ID");
  return (
    <Command
      shouldFilter={false}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    >
      <Command.Input />
      <Command.List>
        <Command.Item value="Alpha-ID">Alpha</Command.Item>
        <Command.Item value="Beta-ID">Beta</Command.Item>
        <Command.Item value="Gamma-ID">Gamma</Command.Item>
      </Command.List>
    </Command>
  );
}

test("onValueChange round-trips the item value (documents any case-folding)", async () => {
  const seen: string[] = [];
  render(<Harness onValue={(v) => seen.push(v)} />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "{ArrowDown}");

  // Pin whatever cmdk actually emits. If this is "beta-id" rather than
  // "Beta-ID", cmdk case-folds values and `itemValue()` in Task 3 MUST
  // lowercase ids so the value round-trips through our value->index map.
  expect(seen.length).toBeGreaterThan(0);
  const emitted = seen[seen.length - 1];
  expect(typeof emitted).toBe("string");
  expect(emitted?.toLowerCase()).toBe("beta-id");
});

test("cmdk sets aria-activedescendant on the input", async () => {
  render(<Harness onValue={() => {}} />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
});

test("cmdk itself binds Home/End (so our Input handler must stopPropagation)", async () => {
  const seen: string[] = [];
  render(<Harness onValue={(v) => seen.push(v)} />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "{End}");
  // If cmdk binds End, it moves highlight to the last item and emits a value.
  // If this expectation fails, cmdk does NOT bind End and Task 5's
  // stopPropagation is unnecessary (harmless, but note it in the PR).
  expect(seen.some((v) => v.toLowerCase() === "gamma-id")).toBe(true);
});

test("an Input-level keydown handler runs before cmdk's root handler", async () => {
  const order: string[] = [];
  function Ordered() {
    return (
      <Command shouldFilter={false} onKeyDown={() => order.push("root")}>
        <Command.Input onKeyDown={() => order.push("input")} />
        <Command.List>
          <Command.Item value="a">A</Command.Item>
        </Command.List>
      </Command>
    );
  }
  render(<Ordered />);
  await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}");
  expect(order[0]).toBe("input");
});
```

- [ ] **Step 2: Run the tests**

Run: `bun test src/core/cmdk-behavior.test.tsx`
Expected: PASS. If any assertion fails, the failure message documents cmdk's real behavior — **stop and report before continuing to Task 3.**

- [ ] **Step 3: Record the findings**

Add a comment block at the top of `src/core/cmdk-behavior.test.tsx` stating what was observed, e.g.:

```tsx
/**
 * Characterization tests for cmdk 1.1.x, pinning the behavior our core relies on:
 *
 *  1. `onValueChange` emits the item's `value` string (see the round-trip test
 *     for whether cmdk case-folds it — `itemValue()` normalizes to lowercase so
 *     the round-trip is stable either way).
 *  2. cmdk owns `aria-activedescendant` on the input — we never set it.
 *  3. cmdk binds Home/End on the `<Command>` root; because the root handler runs
 *     on bubble and our handler sits on the Input, `stopPropagation()` in the
 *     jump-key interceptor (Task 5) reliably preempts it.
 *
 * If a cmdk upgrade breaks one of these, this file fails first and tells you why.
 */
```

- [ ] **Step 4: Commit**

```bash
git add src/core/cmdk-behavior.test.tsx
git commit -m "test: characterize cmdk value + keyboard semantics the core relies on"
```

---

### Task 3: The `useCombobulate` hook

**Files:**
- Modify: `src/core/types.ts` (replace contents)
- Create: `src/core/use-combobulate.ts`, `src/core/use-combobulate.test.tsx`

**Interfaces:**
- Consumes: `defaultFilterItems`, `defaultGetSearchText`, `isSameItem` from `./item-utils` (unchanged, already present).
- Produces:
  - `useCombobulate<T>(options: UseCombobulateOptions<T>): CombobulateApi<T>`
  - `type UseCombobulateOptions<T>` and `type CombobulateApi<T>` (full shape below) — Tasks 4, 5, 6 consume these exact names.

- [ ] **Step 1: Write the failing tests**

Create `src/core/use-combobulate.test.tsx`:

```tsx
import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { useCombobulate } from "./use-combobulate";

let restore: () => void;
beforeAll(() => {
  restore = stubElementLayout();
});
afterAll(() => restore());

const ITEMS = ["Paris", "Madrid", "Berlin", "Málaga"];

test("filters with the normalized default filter", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS }));
  act(() => result.current.setInputValue("mala"));
  expect(result.current.filteredItems).toEqual(["Málaga"]);
});

test("a custom filterItems overrides the default", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, filterItems: (items) => items.slice(0, 1) }),
  );
  act(() => result.current.setInputValue("zzz"));
  expect(result.current.filteredItems).toEqual(["Paris"]);
});

test("single select replaces and reports the item", () => {
  const seen: unknown[] = [];
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, onChange: (v) => seen.push(v) }));
  act(() => result.current.select("Paris"));
  act(() => result.current.select("Berlin"));
  expect(result.current.selectedItems).toEqual(["Berlin"]);
  expect(seen).toEqual(["Paris", "Berlin"]);
});

test("multi select toggles membership", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, multiple: true }));
  act(() => result.current.select("Paris"));
  act(() => result.current.select("Berlin"));
  expect(result.current.selectedItems).toEqual(["Paris", "Berlin"]);
  act(() => result.current.select("Paris"));
  expect(result.current.selectedItems).toEqual(["Berlin"]);
  expect(result.current.isSelected("Berlin")).toBe(true);
});

test("itemValue is the id verbatim and maps back to the filtered index", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  const value = result.current.itemValue("Madrid", 1);
  // Verbatim — not case-folded. cmdk round-trips it unchanged.
  expect(value).toBe("Madrid");
  act(() => result.current.setActiveValue(value));
  expect(result.current.activeIndex).toBe(1);
});

test("ids differing only in case are distinct items, not a collision", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ["AB", "ab"], getItemId: (c) => c }),
  );
  act(() => result.current.setActiveValue(result.current.itemValue("ab", 1)));
  expect(result.current.activeIndex).toBe(1);
  act(() => result.current.setActiveValue(result.current.itemValue("AB", 0)));
  expect(result.current.activeIndex).toBe(0);
});

test("activeIndex is -1 when the active value is not in the filtered list", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS }));
  act(() => result.current.setActiveValue("nope"));
  expect(result.current.activeIndex).toBe(-1);
});

test("bridge: changing the active value scrolls that index into mount", () => {
  const big = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
  const { result } = renderHook(() => useCombobulate({ items: big, defaultOpen: true }));

  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;

  act(() => result.current.setActiveValue(result.current.itemValue("Item 500", 500)));
  expect(calls).toContain(500);
});

test("bridge stays quiet while closed", () => {
  const big = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
  const { result } = renderHook(() => useCombobulate({ items: big }));
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;
  act(() => result.current.setActiveValue(result.current.itemValue("Item 500", 500)));
  expect(calls).toEqual([]);
});

test("announcement reflects loading, empty, and counts", () => {
  const { result, rerender } = renderHook(
    ({ loading }: { loading: boolean }) => useCombobulate({ items: ITEMS, defaultOpen: true, loading }),
    { initialProps: { loading: true } },
  );
  expect(result.current.announcement).toBe("Loading…");
  rerender({ loading: false });
  act(() => result.current.setInputValue("zzz"));
  expect(result.current.announcement).toBe("No results");
  act(() => result.current.setInputValue("par"));
  expect(result.current.announcement).toBe("1 result");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: FAIL — `Cannot find module './use-combobulate'`.

- [ ] **Step 3: Write the types**

Replace `src/core/types.ts` entirely:

```ts
import type { Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";

/**
 * Options accepted by {@link useCombobulate}. Deliberately tree-unaware.
 *
 * This hook is **uncontrolled**: selection, input text, and open state are
 * owned internally and surfaced via `onChange`/`onInputChange`/`onOpenChange`
 * callbacks plus `default*` seed values.
 */
export type UseCombobulateOptions<T> = {
  /** Full list of items to search over. */
  items: T[];
  /** Accessor for an item's searchable/display text. */
  getSearchText?: (item: T) => string;
  /**
   * Accessor for an item's stable id. Falls back to the positional index.
   * Ids must be unique — they become cmdk item values (see
   * {@link CombobulateApi.itemValue}).
   */
  getItemId?: (item: T) => string;
  /** Custom filter. Defaults to a normalized substring match. */
  filterItems?: (items: T[], query: string) => T[];
  /** Initial selection for the uncontrolled case. */
  defaultValue?: T | T[] | null;
  /** Fired when selection changes. */
  onChange?: (value: T | T[] | null) => void;
  /** Fired synchronously on every input change. */
  onInputChange?: (value: string) => void;
  /** Initial open state for the uncontrolled case. */
  defaultOpen?: boolean;
  /** Fired when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Allow selecting multiple items. */
  multiple?: boolean;
  /** External loading flag for async data. Drives the live-region announcement. */
  loading?: boolean;
  /** Estimated row height in px. Required by TanStack Virtual. Default 32. */
  estimateSize?: (index: number) => number;
  /** Rows to render above/below the viewport. Default 8. */
  overscan?: number;
};

/** Public API returned by {@link useCombobulate}. */
export type CombobulateApi<T> = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (next: boolean) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  filteredItems: T[];
  /** cmdk's highlighted item value (the controlled `value` on `<Command>`). */
  activeValue: string;
  setActiveValue: (value: string) => void;
  /** Index of {@link CombobulateApi.activeValue} in `filteredItems`, or -1. */
  activeIndex: number;
  selectedItems: T[];
  select: (item: T) => void;
  /** Replace the entire selection in one update. Fires `onChange` once. */
  setSelectedItems: (items: T[]) => void;
  isSelected: (item: T) => boolean;
  /** Resolve an item's logical id (caller's `getItemId`, else the index). */
  getItemId: (item: T, index: number) => string;
  /**
   * The item's cmdk `value` string: the logical id, used verbatim.
   *
   * cmdk emits `value` back through `onValueChange` unchanged — no
   * case-folding, no trimming (pinned by `cmdk-behavior.test.tsx`), so the
   * round-trip through `valueToIndex` needs no normalization. Deliberately
   * NOT lowercased: that would make ids differing only in case collide
   * silently in the map.
   */
  itemValue: (item: T, index: number) => string;
  /** Screen-reader announcement string (result count / no-results / loading). */
  announcement: string;
  /** External loading flag, forwarded so primitives can render loading states. */
  loading: boolean;
  /** Whether multi-select is enabled; drives `aria-checked` on options. */
  multiple: boolean;
  /** Internal virtualizer. Exposed for the primitives, not part of the API contract. */
  virtualizer: Virtualizer<HTMLElement, Element>;
  /** Ref for the virtualized scroll container. */
  scrollRef: RefObject<HTMLElement | null>;
};
```

- [ ] **Step 4: Write the hook**

Create `src/core/use-combobulate.ts`:

```ts
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem } from "./item-utils";
import type { CombobulateApi, UseCombobulateOptions } from "./types";

/** Convert the selected items to the value type expected by `onChange`. */
function toChangeValue<T>(items: T[], multiple: boolean): T | T[] | null {
  return multiple ? items : (items[0] ?? null);
}

/**
 * Orchestration hook for a cmdk-backed, virtualized combobox.
 *
 * cmdk owns arrow-key navigation, option roles, and the highlighted item
 * (surfaced here as `activeValue`/`setActiveValue`, wired to `<Command>`'s
 * controlled `value`). This hook owns everything cmdk does not: filtering,
 * selection, input/open state, the virtualizer, and the bridge that keeps the
 * highlighted row mounted so cmdk's `aria-activedescendant` always resolves.
 */
export function useCombobulate<T>(options: UseCombobulateOptions<T>): CombobulateApi<T> {
  const {
    items,
    getSearchText = defaultGetSearchText as (item: T) => string,
    getItemId,
    filterItems,
    multiple = false,
    onChange,
    onInputChange,
    onOpenChange,
    defaultOpen = false,
    defaultValue = null,
    loading = false,
    estimateSize = () => 32,
    overscan = 8,
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeValue, setActiveValue] = useState("");
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  const filteredItems = useMemo(() => {
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText]);

  const getItemIdCb = useCallback(
    (item: T, index: number) => (getItemId ? getItemId(item) : String(index)),
    [getItemId],
  );

  // Used verbatim: cmdk round-trips `value` through `onValueChange` unchanged
  // (pinned by cmdk-behavior.test.tsx), so no normalization is needed — and
  // lowercasing would make ids differing only in case collide in the map below.
  const itemValue = useCallback(
    (item: T, index: number) => getItemIdCb(item, index),
    [getItemIdCb],
  );

  /** Reverse index for the bridge: cmdk's value string -> position in `filteredItems`. */
  const valueToIndex = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item, index) => {
      map.set(itemValue(item, index), index);
    });
    return map;
  }, [filteredItems, itemValue]);

  const activeIndex = valueToIndex.get(activeValue) ?? -1;

  const scrollRef = useRef<HTMLElement | null>(null);
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  /**
   * The bridge. cmdk moves the highlight among *mounted* rows; scrolling the
   * new active index into view mounts it (and its neighbours), so the next
   * keystroke always has a real row to move to and `aria-activedescendant`
   * always points at a node that exists.
   */
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [isOpen, activeIndex, virtualizer]);

  const setOpen = useCallback(
    (next: boolean) => {
      setIsOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const setInputValue = useCallback(
    (value: string) => {
      setInputValueState(value);
      onInputChange?.(value);
    },
    [onInputChange],
  );

  // `onChange` fires OUTSIDE the state updater. React invokes updater
  // functions twice in StrictMode, so a side effect inside one would fire the
  // consumer's callback twice in dev (StrictMode is on by default in Next.js
  // and every Vite React template). Mirrors `setSelectedItems` below.
  const select = useCallback(
    (item: T) => {
      const next = multiple
        ? selectedItems.some((i) => isSameItem(i, item, getItemId))
          ? selectedItems.filter((i) => !isSameItem(i, item, getItemId))
          : [...selectedItems, item]
        : [item];
      setSelectedItemsState(next);
      onChange?.(toChangeValue(next, multiple));
    },
    [multiple, onChange, getItemId, selectedItems],
  );

  const setSelectedItems = useCallback(
    (next: T[]) => {
      const clamped = multiple ? [...next] : next.slice(0, 1);
      setSelectedItemsState(clamped);
      onChange?.(toChangeValue(clamped, multiple));
    },
    [multiple, onChange],
  );

  const isSelected = useCallback(
    (item: T) => selectedItems.some((i) => isSameItem(i, item, getItemId)),
    [selectedItems, getItemId],
  );

  // Closed is checked first: a closed combobox announces nothing, even while
  // `loading` — its live region is not on screen to narrate.
  const announcement = !isOpen
    ? ""
    : loading
      ? "Loading…"
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;

  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    setOpen,
    inputValue,
    setInputValue,
    filteredItems,
    activeValue,
    setActiveValue,
    activeIndex,
    selectedItems,
    select,
    setSelectedItems,
    isSelected,
    getItemId: getItemIdCb,
    itemValue,
    announcement,
    loading,
    multiple,
    virtualizer,
    scrollRef,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/core/use-combobulate.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 6: Lint and typecheck**

Run: `bunx biome check --write src/ && bun run typecheck`
Expected: no warnings, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/use-combobulate.ts src/core/use-combobulate.test.tsx
git commit -m "feat(core): useCombobulate — cmdk-backed state, filtering, selection, virtual bridge"
```

---

### Task 4: cmdk-backed primitives with full-list ARIA

**Files:**
- Create: `src/core/context.ts`, `src/core/primitives.tsx`, `src/core/primitives.test.tsx`
- Move: `src/primitives/merge-props.ts` → `src/core/merge-props.ts`

**Interfaces:**
- Consumes: `useCombobulate`, `CombobulateApi<T>` (Task 3).
- Produces:
  - `Combobulate = { Root, Input, List, Item, Empty, LiveRegion }` from `./primitives`
  - `useCombobulateContext<T>()` from `./context` (Task 6's `Popover` consumes it)
  - `mergeProps` from `./merge-props`
  - types `CombobulateRootProps<T>`, `CombobulateListProps<T>`, `CombobulateItemProps<T>`

**ARIA note (decision):** cmdk owns `aria-selected` on options — in its model that marks the **highlighted** row, which is the single-select combobox convention, and it also owns `aria-activedescendant` on the input. We therefore never set either. Our additions are `aria-setsize`/`aria-posinset` (correct across the whole virtual list, which cmdk cannot know) and, for multi-select only, `aria-checked` (valid on `role="option"`) to express *chosen* state distinctly from *highlighted*. `data-chosen` is emitted for styling.

- [ ] **Step 1: Move `merge-props` (still needed — floating composes `onKeyDown` with our handler)**

```bash
git mv src/primitives/merge-props.ts src/core/merge-props.ts
```

- [ ] **Step 2: Write the context**

Create `src/core/context.ts`:

```ts
import { createContext, useContext } from "react";
import type { CombobulateApi } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: the context is generic over the
// item type; consumers re-narrow via useCombobulateContext<T>().
const CombobulateContext = createContext<CombobulateApi<any> | null>(null);

export const CombobulateProvider = CombobulateContext.Provider;

/** Read the combobulate api from context. Throws outside a `Combobulate.Root`. */
export function useCombobulateContext<T>(): CombobulateApi<T> {
  const api = useContext(CombobulateContext);
  if (api === null) {
    throw new Error("Combobulate components must be rendered inside <Combobulate.Root>.");
  }
  return api as CombobulateApi<T>;
}
```

- [ ] **Step 3: Write the failing tests**

Create `src/core/primitives.test.tsx`:

```tsx
import { afterAll, beforeAll, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Combobulate } from "./primitives";
import { useCombobulate } from "./use-combobulate";

let restore: () => void;
beforeAll(() => {
  restore = stubElementLayout();
});
afterAll(() => restore());

const BIG = Array.from({ length: 500 }, (_, i) => `Item ${i}`);

function Harness({ items = BIG, multiple = false }: { items?: string[]; multiple?: boolean }) {
  const api = useCombobulate({ items, defaultOpen: true, multiple, getItemId: (i) => i });
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input aria-label="Search" />
      <Combobulate.List>
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

test("virtualizes: mounts a window, not all 500 items", () => {
  render(<Harness />);
  const options = screen.getAllByRole("option");
  expect(options.length).toBeGreaterThan(0);
  expect(options.length).toBeLessThan(100);
});

test("options carry full-list aria-setsize and absolute aria-posinset", () => {
  render(<Harness />);
  const first = screen.getAllByRole("option")[0];
  expect(first?.getAttribute("aria-setsize")).toBe("500");
  expect(first?.getAttribute("aria-posinset")).toBe("1");
});

test("multi-select marks chosen state with aria-checked, single-select does not", () => {
  const { rerender } = render(<Harness multiple />);
  expect(screen.getAllByRole("option")[0]?.getAttribute("aria-checked")).toBe("false");
  rerender(<Harness />);
  expect(screen.getAllByRole("option")[0]?.getAttribute("aria-checked")).toBeNull();
});

test("Empty renders only when nothing matches", () => {
  render(<Harness items={[]} />);
  expect(screen.getByText("No results")).toBeDefined();
});

test("LiveRegion announces the result count", () => {
  render(<Harness items={["Paris"]} />);
  expect(screen.getByRole("status").textContent).toBe("1 result");
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `bun test src/core/primitives.test.tsx`
Expected: FAIL — `Cannot find module './primitives'`.

- [ ] **Step 5: Write the primitives**

Create `src/core/primitives.tsx`:

```tsx
import { Command } from "cmdk";
import { type ReactNode, forwardRef } from "react";
import { CombobulateProvider, useCombobulateContext } from "./context";
import { mergeProps } from "./merge-props";
import type { CombobulateApi } from "./types";

/** Props for {@link Combobulate}'s `Root` component. */
export type CombobulateRootProps<T> = {
  /** The value returned by `useCombobulate`. */
  api: CombobulateApi<T>;
  /** Accessible label for the command surface. */
  label?: string;
  children: ReactNode;
};

/**
 * Root provider. Renders cmdk's `<Command>` with filtering disabled (we filter
 * in `useCombobulate`) and its highlight controlled by the api, which is what
 * lets the virtualization bridge observe and drive the active row.
 */
function Root<T>({ api, label, children }: CombobulateRootProps<T>) {
  return (
    <CombobulateProvider value={api}>
      <Command
        shouldFilter={false}
        label={label}
        value={api.activeValue}
        onValueChange={api.setActiveValue}
      >
        {children}
      </Command>
    </CombobulateProvider>
  );
}

/**
 * The combobox text input. cmdk supplies `role="combobox"` and owns
 * `aria-activedescendant`.
 *
 * Handlers from the api and any same-named handler in `props` are composed
 * (ours first, then the consumer's) rather than one clobbering the other —
 * this is what lets the floating layer's Escape-to-dismiss `onKeyDown` sit
 * alongside the jump-key interceptor when consumers spread
 * `{...floating.referenceProps}` here.
 */
const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const api = useCombobulateContext();
    const own = {
      value: api.inputValue,
      onFocus: () => api.setOpen(true),
    };
    const merged = mergeProps(own, props);
    return (
      <Command.Input
        {...merged}
        ref={ref}
        onValueChange={(value: string) => {
          api.setInputValue(value);
          if (!api.isOpen) api.setOpen(true);
        }}
      />
    );
  },
);

/** Props for {@link Combobulate}'s `List` component. */
export type CombobulateListProps<T> = {
  /** Render-prop invoked once per visible (virtualized) item. */
  children: (item: T, index: number) => ReactNode;
  style?: React.CSSProperties;
};

/**
 * Virtualized scroll container. cmdk's `Command.List` supplies the listbox
 * role; the inner scroll element is ours so TanStack Virtual can measure it.
 */
function List<T>({ children, style }: CombobulateListProps<T>) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  const rows = api.virtualizer.getVirtualItems();
  return (
    <Command.List>
      <div
        ref={api.scrollRef as React.Ref<HTMLDivElement>}
        style={{ overflow: "auto", position: "relative", maxHeight: 300, ...style }}
      >
        <div style={{ height: api.virtualizer.getTotalSize(), position: "relative" }}>
          {rows.map((row) => {
            const item = api.filteredItems[row.index];
            if (item === undefined) return null;
            return (
              <div
                key={row.key}
                data-index={row.index}
                ref={api.virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
              >
                {children(item, row.index)}
              </div>
            );
          })}
        </div>
      </div>
    </Command.List>
  );
}

/** Props for {@link Combobulate}'s `Item` component. */
export type CombobulateItemProps<T> = {
  item: T;
  index: number;
  children: ReactNode;
};

/**
 * A single option row.
 *
 * cmdk owns `role="option"` and `aria-selected` (which, in its model, marks the
 * *highlighted* row). We add what cmdk structurally cannot know: `aria-setsize`
 * and `aria-posinset` across the **whole filtered list**, not just the mounted
 * window — the reason this library exists. For multi-select we additionally
 * express *chosen* state as `aria-checked` (valid on `role="option"`) so it
 * stays distinct from cmdk's highlight.
 */
function Item<T>({ item, index, children }: CombobulateItemProps<T>) {
  const api = useCombobulateContext<T>();
  const chosen = api.isSelected(item);
  return (
    <Command.Item
      value={api.itemValue(item, index)}
      onSelect={() => api.select(item)}
      aria-setsize={api.filteredItems.length}
      aria-posinset={index + 1}
      aria-checked={api.multiple ? chosen : undefined}
      data-chosen={chosen ? "" : undefined}
    >
      {children}
    </Command.Item>
  );
}

/**
 * Rendered when there are no filtered items. Presentational only — NOT a live
 * region. `LiveRegion` is the sole `role="status"` announcer; making `Empty` a
 * second one (e.g. via `<output>`, which carries an implicit `role="status"`)
 * would announce "No results" twice. A plain `<div>` with no role also lints
 * clean, since Biome's `useSemanticElements` only fires when a `role` is set.
 */
function Empty({ children }: { children: ReactNode }) {
  const api = useCombobulateContext();
  if (!api.isOpen || api.filteredItems.length > 0) return null;
  return <div>{children}</div>;
}

/**
 * Visually-hidden polite live region announcing result counts and loading
 * state. The wrapper is off-screen but readable by assistive tech.
 */
function LiveRegion() {
  const api = useCombobulateContext();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic={true}
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {api.announcement}
    </div>
  );
}

/** Headless Combobulate primitives. */
export const Combobulate = { Root, Input, List, Item, Empty, LiveRegion };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/core/primitives.test.tsx`
Expected: PASS (5 tests).

If `Empty` double-renders with a `role="status"` conflict against `LiveRegion` in the count test, note that `getByRole("status")` may match both — the test uses distinct item sets so only one is present at a time.

- [ ] **Step 7: Lint and typecheck**

Run: `bunx biome check --write src/ && bun run typecheck`
Expected: no warnings, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/core/context.ts src/core/primitives.tsx src/core/primitives.test.tsx src/core/merge-props.ts
git commit -m "feat(core): cmdk-backed primitives with full-list aria-setsize/posinset"
```

---

### Task 5: Correct jump keys over a virtualized list

**Why:** This is the behavior that makes virtualization *proper* rather than merely working. cmdk binds Home/End to the first/last **mounted** row — with a virtualizer that is the wrong answer (a window, not the list). We intercept on the Input (which runs before cmdk's root handler, per Task 2), scroll the true target into mount, then hand cmdk the value so it highlights through its normal path. PageUp/PageDown are added for the same reason.

**Files:**
- Modify: `src/core/use-combobulate.ts`, `src/core/types.ts`, `src/core/primitives.tsx`
- Create: `src/core/jump-keys.test.tsx`

**Interfaces:**
- Consumes: `CombobulateApi<T>` (Task 3), `Combobulate.Input` (Task 4).
- Produces: `CombobulateApi.onInputKeyDown: (event: React.KeyboardEvent) => void`, wired into `Combobulate.Input`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/jump-keys.test.tsx`:

```tsx
import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { useCombobulate } from "./use-combobulate";

let restore: () => void;
beforeAll(() => {
  restore = stubElementLayout();
});
afterAll(() => restore());

const BIG = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);

/** Minimal stand-in for the parts of React's KeyboardEvent the handler reads. */
function keyEvent(key: string) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    key,
    preventDefault: () => {
      defaultPrevented = true;
    },
    stopPropagation: () => {
      propagationStopped = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
    get propagationStopped() {
      return propagationStopped;
    },
  };
}

test("End jumps to the true last item of the whole filtered list", () => {
  const { result } = renderHook(() => useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }));
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;

  const event = keyEvent("End");
  act(() => result.current.onInputKeyDown(event as never));

  expect(calls).toContain(999);
  expect(result.current.activeIndex).toBe(999);
  expect(event.defaultPrevented).toBe(true);
  // cmdk binds End on the <Command> root; stopping propagation is what keeps
  // it from also moving the highlight to the last *mounted* row.
  expect(event.propagationStopped).toBe(true);
});

test("Home jumps to the true first item", () => {
  const { result } = renderHook(() => useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }));
  result.current.virtualizer.scrollToIndex = (() => {}) as typeof result.current.virtualizer.scrollToIndex;
  act(() => result.current.setActiveValue(result.current.itemValue("Item 500", 500)));
  act(() => result.current.onInputKeyDown(keyEvent("Home") as never));
  expect(result.current.activeIndex).toBe(0);
});

test("PageDown/PageUp move by a page and clamp at the ends", () => {
  const { result } = renderHook(() => useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }));
  result.current.virtualizer.scrollToIndex = (() => {}) as typeof result.current.virtualizer.scrollToIndex;

  act(() => result.current.setActiveValue(result.current.itemValue("Item 0", 0)));
  act(() => result.current.onInputKeyDown(keyEvent("PageDown") as never));
  expect(result.current.activeIndex).toBe(10);

  act(() => result.current.onInputKeyDown(keyEvent("PageUp") as never));
  expect(result.current.activeIndex).toBe(0);

  act(() => result.current.onInputKeyDown(keyEvent("PageUp") as never));
  expect(result.current.activeIndex).toBe(0);
});

test("unhandled keys pass through untouched (cmdk keeps arrow nav)", () => {
  const { result } = renderHook(() => useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }));
  const event = keyEvent("ArrowDown");
  act(() => result.current.onInputKeyDown(event as never));
  expect(event.defaultPrevented).toBe(false);
  expect(event.propagationStopped).toBe(false);
});

test("jump keys are inert on an empty list", () => {
  const { result } = renderHook(() => useCombobulate({ items: [], defaultOpen: true }));
  const event = keyEvent("End");
  act(() => result.current.onInputKeyDown(event as never));
  expect(event.defaultPrevented).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/core/jump-keys.test.tsx`
Expected: FAIL — `result.current.onInputKeyDown is not a function`.

- [ ] **Step 3: Add `onInputKeyDown` to the api type**

In `src/core/types.ts`, add this member to `CombobulateApi<T>` (directly after `setActiveValue`):

```ts
  /**
   * Keydown handler for the input. Implements the jump keys cmdk cannot get
   * right under virtualization (Home/End/PageUp/PageDown target the whole
   * filtered list, not the mounted window) and passes every other key through
   * to cmdk untouched.
   */
  onInputKeyDown: (event: import("react").KeyboardEvent) => void;
```

- [ ] **Step 4: Implement the handler in `use-combobulate.ts`**

Add the import of `KeyboardEvent` as a type to the existing React import:

```ts
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
```

Add this constant above the hook:

```ts
/** Rows moved per PageUp/PageDown. A fixed page keeps the jump predictable
 *  across variable-height rows, where a measured "viewport of rows" would not. */
const PAGE_SIZE = 10;
```

Insert this callback inside the hook, after `isSelected` and before `announcement`:

```ts
  const filteredRef = useRef(filteredItems);
  filteredRef.current = filteredItems;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const rows = filteredRef.current;
      if (rows.length === 0) return;
      const current = activeIndexRef.current;
      const last = rows.length - 1;

      let target: number | null = null;
      if (event.key === "Home") target = 0;
      else if (event.key === "End") target = last;
      else if (event.key === "PageDown") target = Math.min((current < 0 ? 0 : current) + PAGE_SIZE, last);
      else if (event.key === "PageUp") target = Math.max((current < 0 ? 0 : current) - PAGE_SIZE, 0);
      if (target === null) return;

      const item = rows[target];
      if (item === undefined) return;

      // cmdk binds Home/End on the <Command> root and would otherwise move the
      // highlight to the first/last *mounted* row. Our handler sits on the
      // input, which fires first, so stopping propagation preempts it.
      event.preventDefault();
      event.stopPropagation();

      // Scroll first so the target row mounts, then hand cmdk the value: once
      // the row is in the DOM cmdk resolves it through its normal controlled
      // `value` path and re-points aria-activedescendant at it.
      virtualizer.scrollToIndex(target, { align: "center" });
      setActiveValue(itemValue(item, target));
    },
    [virtualizer, itemValue],
  );
```

Add `onInputKeyDown` to the returned object (after `setActiveValue`):

```ts
    onInputKeyDown,
```

- [ ] **Step 5: Wire it into `Combobulate.Input`**

In `src/core/primitives.tsx`, extend the `own` props object inside `Input` so the handler composes with any consumer/floating handler:

```tsx
    const own = {
      value: api.inputValue,
      onFocus: () => api.setOpen(true),
      onKeyDown: api.onInputKeyDown,
    };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/core/jump-keys.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Run the full suite, lint, typecheck**

Run: `bun test && bunx biome check --write src/ && bun run typecheck`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/use-combobulate.ts src/core/types.ts src/core/primitives.tsx src/core/jump-keys.test.tsx
git commit -m "feat(core): correct Home/End/PageUp/PageDown across the full virtualized list"
```

---

### Task 6: Retarget the floating layer to the cmdk core

**Files:**
- Modify: `src/floating/use-floating.ts`, `src/floating/floating-primitives.tsx`
- Modify: `src/floating/use-floating.test.tsx`, `src/floating/floating-primitives.test.tsx`

**Interfaces:**
- Consumes: `CombobulateApi<T>` (Task 3), `useCombobulateContext` (Task 4).
- Produces: `useAutocompleteFloating<T>(api: CombobulateApi<T>, options?: UseFloatingOptions): AutocompleteFloating`, and `Popover`.

- [ ] **Step 1: Retarget the hook's types**

In `src/floating/use-floating.ts`, replace the import:

```ts
import type { CombobulateApi } from "../core/types";
```

and the signature:

```ts
export function useAutocompleteFloating<T>(
  api: CombobulateApi<T>,
  options: UseFloatingOptions = {},
): AutocompleteFloating {
```

The body is unchanged — `api.isOpen`, `api.setOpen`, `api.selectedItems`, and `api.getItemId(item, i)` all exist with the same shapes on `CombobulateApi`.

- [ ] **Step 2: Retarget the Popover's context import**

In `src/floating/floating-primitives.tsx`, change the context import to the new location:

```ts
import { useCombobulateContext } from "../core/context";
```

Replace any `useCombobulateContext` usages' expectations of `api.getListProps()` (removed in the rebuild — cmdk supplies the listbox role) by rendering the floating wrapper only:

```tsx
/** Floating dropdown surface. Renders nothing while the combobox is closed. */
export function Popover({ floating, children }: PopoverProps) {
  const api = useCombobulateContext();
  if (!api.isOpen) return null;
  return (
    <div ref={floating.floating} style={floating.floatingStyles} {...floating.floatingProps}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Update the floating tests to build on `useCombobulate`**

In both `src/floating/use-floating.test.tsx` and `src/floating/floating-primitives.test.tsx`, replace every

```ts
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
```

with

```ts
import { useCombobulate } from "../core/use-combobulate";
```

and every call site `useAutocompleteVirtual({...})` with `useCombobulate({...})`. Any harness that renders primitives must import `Combobulate` from `../core/primitives` instead of `../primitives/combobulate`. Keep the assertions as they are — the floating behavior contract has not changed.

- [ ] **Step 4: Run the floating tests**

Run: `bun test src/floating/`
Expected: PASS. If an assertion depends on `getListProps`/`listId` (removed), rewrite it to assert on the rendered `role="listbox"` that cmdk emits instead.

- [ ] **Step 5: Lint and typecheck**

Run: `bunx biome check --write src/ && bun run typecheck`
Expected: no warnings, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/floating
git commit -m "refactor(floating): retarget the floating layer to the cmdk core"
```

---

### Task 7: Swap the public API and delete the old engine

**Files:**
- Modify: `src/index.ts`
- Delete: `src/core/use-autocomplete.ts`, `src/core/use-autocomplete.test.tsx`, `src/core/use-autocomplete-virtual.ts`, `src/core/use-autocomplete-virtual.test.tsx`, `src/core/use-autocomplete-aria.test.tsx`, `src/primitives/`

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces: the v1 public surface consumed by Tasks 8–9.

- [ ] **Step 1: Write the new public surface**

Replace `src/index.ts` entirely:

```ts
export { useCombobulate } from "./core/use-combobulate";
export type { CombobulateApi, UseCombobulateOptions } from "./core/types";
import { Popover } from "./floating/floating-primitives";
import { Combobulate as CombobulateBase } from "./core/primitives";
/** Headless Combobulate primitives (core + floating layer). */
export const Combobulate = { ...CombobulateBase, Popover };
export type {
  CombobulateItemProps,
  CombobulateListProps,
  CombobulateRootProps,
} from "./core/primitives";
export { useAutocompleteFloating } from "./floating/use-floating";
export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";
```

- [ ] **Step 2: Delete the old engine**

```bash
git rm --quiet src/core/use-autocomplete.ts src/core/use-autocomplete.test.tsx \
  src/core/use-autocomplete-virtual.ts src/core/use-autocomplete-virtual.test.tsx \
  src/core/use-autocomplete-aria.test.tsx
git rm -r --quiet src/primitives
```

- [ ] **Step 3: Verify nothing still references the old engine**

Run: `grep -rn "useAutocompleteVirtual\|use-autocomplete\|primitives/combobulate\|AutocompleteApi" src/ e2e/ --include='*.ts' --include='*.tsx' | grep -v '^src/tree/'`
Expected: no output. (`src/tree/` is parked and excluded from the build — its references are intentionally left frozen.)

- [ ] **Step 4: Full verification**

Run: `bun test && bun run typecheck && bun run lint && bun run build`
Expected: all pass; `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` produced and **no `dist/styles.css`**.

- [ ] **Step 5: Confirm the bundle does not inline the engines**

Run: `grep -c "from \"cmdk\"\|require(\"cmdk\")" dist/index.js dist/index.cjs`
Expected: at least 1 in each — cmdk stays an external import rather than being bundled in.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat!: swap public API to the cmdk core; delete the hand-rolled engine"
```

---

### Task 8: Storybook — the integration docs and demos

**Files:**
- Create: `.storybook/main.ts`, `.storybook/preview.ts`
- Create: `src/stories/Basic.stories.tsx`, `src/stories/AsyncTypeahead.stories.tsx`, `src/stories/MultiSelect.stories.tsx`, `src/stories/WorldAirports.stories.tsx`, `src/stories/Floating.stories.tsx`
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Consumes: the v1 public surface (Task 7), `src/stories/data/airports.json` + `types.ts` (Task 1).
- Produces: story ids consumed by Task 9's e2e:
  - `combobulate-basic--default`
  - `combobulate-async-typeahead--default`
  - `combobulate-multi-select--default`
  - `combobulate-world-airports--default`
  - `combobulate-floating--default`

- [ ] **Step 1: Install Storybook**

```bash
bun add -d @storybook/react-vite@^8 @storybook/react@^8 storybook@^8 @vitejs/plugin-react@^4 vite@^5
```

- [ ] **Step 2: Configure Storybook**

Create `.storybook/main.ts`:

```ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
};

export default config;
```

Create `.storybook/preview.ts`:

```ts
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: { layout: "centered" },
};

export default preview;
```

Add scripts to `package.json`:

```json
    "storybook": "storybook dev -p 6006 --no-open",
    "build-storybook": "storybook build",
```

Add `.storybook` to `tsconfig.json`'s `include` array so the config typechecks:

```json
  "include": ["src", "test-setup.ts", "tsup.config.ts", "e2e", "playwright.config.ts", ".storybook"],
```

- [ ] **Step 3: Basic story**

Create `src/stories/Basic.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function Basic() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  return (
    <Combobulate.Root api={api} label="Cities">
      <Combobulate.Input aria-label="City" placeholder="Search cities…" />
      <Combobulate.List>
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

const meta: Meta<typeof Basic> = { title: "Combobulate/Basic", component: Basic };
export default meta;
export const Default: StoryObj<typeof Basic> = {};
```

- [ ] **Step 4: World Airports story (the scale + jump-key story)**

Create `src/stories/WorldAirports.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];

function WorldAirports() {
  const api = useCombobulate({
    items: AIRPORTS,
    getItemId: (a) => a.iata,
    getSearchText: (a) => `${a.city} ${a.name} ${a.iata}`,
    estimateSize: () => 44,
  });
  return (
    <div style={{ width: 380 }}>
      <Combobulate.Root api={api} label="Airports">
        <Combobulate.Input aria-label="Airport" placeholder="Search ~3,300 airports…" />
        <Combobulate.List>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              <span>
                {item.city} — {item.name} ({item.iata})
              </span>
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>No airports match</Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof WorldAirports> = {
  title: "Combobulate/World Airports",
  component: WorldAirports,
};
export default meta;
export const Default: StoryObj<typeof WorldAirports> = {};
```

**Note:** open `src/stories/data/types.ts` first and use its real exported type name and field names. If the salvaged type is not named `Airport` or its fields differ (e.g. `iata_code`), adjust this story to match rather than renaming the data.

- [ ] **Step 5: Async typeahead story (Fuse injected)**

Create `src/stories/AsyncTypeahead.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import Fuse from "fuse.js";
import { useEffect, useState } from "react";
import { Combobulate, useCombobulate } from "../index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const ALL = airports as Airport[];
const fuse = new Fuse(ALL, { keys: ["city", "name", "iata"], threshold: 0.3, ignoreLocation: true });

/** Simulates a remote search: debounce-free, 400ms latency, Fuse-ranked. */
function useRemoteSearch(query: string) {
  const [items, setItems] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      setItems(fuse.search(query).slice(0, 50).map((r) => r.item));
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);
  return { items, loading };
}

function AsyncTypeahead() {
  const [query, setQuery] = useState("");
  const { items, loading } = useRemoteSearch(query);
  const api = useCombobulate({
    items,
    loading,
    getItemId: (a) => a.iata,
    onInputChange: setQuery,
    // Results are already ranked by the "server" — don't filter again.
    filterItems: (list) => list,
  });
  return (
    <div style={{ width: 380 }}>
      <Combobulate.Root api={api} label="Remote airport search">
        <Combobulate.Input aria-label="Airport" placeholder="Type 2+ characters…" />
        <Combobulate.List>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              {item.city} ({item.iata})
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>{loading ? "Searching…" : "No airports match"}</Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof AsyncTypeahead> = {
  title: "Combobulate/Async Typeahead",
  component: AsyncTypeahead,
};
export default meta;
export const Default: StoryObj<typeof AsyncTypeahead> = {};
```

- [ ] **Step 6: Multi-select chips story**

Create `src/stories/MultiSelect.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function MultiSelect() {
  const api = useCombobulate({ items: CITIES, multiple: true, getItemId: (c) => c });
  return (
    <div style={{ width: 380 }}>
      <div data-testid="chips" style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {api.selectedItems.map((city) => (
          <button key={city} type="button" onClick={() => api.select(city)}>
            {city} ✕
          </button>
        ))}
      </div>
      <Combobulate.Root api={api} label="Cities">
        <Combobulate.Input aria-label="Cities" placeholder="Pick several…" />
        <Combobulate.List>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              {api.isSelected(item) ? "✓ " : ""}
              {item}
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>No results</Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof MultiSelect> = { title: "Combobulate/Multi Select", component: MultiSelect };
export default meta;
export const Default: StoryObj<typeof MultiSelect> = {};
```

- [ ] **Step 7: Floating story**

Create `src/stories/Floating.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useAutocompleteFloating, useCombobulate } from "../index";

const CITIES = Array.from({ length: 400 }, (_, i) => `City ${i}`);

function Floating() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  const floating = useAutocompleteFloating(api, { closeOnSelect: true });
  return (
    <div style={{ width: 320 }}>
      <Combobulate.Root api={api} label="Cities">
        <Combobulate.Input
          ref={floating.reference as unknown as React.Ref<HTMLInputElement>}
          {...floating.referenceProps}
          aria-label="City"
          placeholder="Floating dropdown…"
        />
        <Combobulate.Popover floating={floating}>
          <Combobulate.List>
            {(item, index) => (
              <Combobulate.Item item={item} index={index}>
                {item}
              </Combobulate.Item>
            )}
          </Combobulate.List>
        </Combobulate.Popover>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof Floating> = { title: "Combobulate/Floating", component: Floating };
export default meta;
export const Default: StoryObj<typeof Floating> = {};
```

- [ ] **Step 8: Verify Storybook builds and the stories render**

Run: `bun run build-storybook`
Expected: builds to `storybook-static/` with no errors.

Then run `bun run storybook` and confirm each of the five stories renders and is interactive. Stop the server afterwards.

- [ ] **Step 9: Lint and typecheck**

Run: `bunx biome check --write src/ .storybook/ && bun run typecheck`
Expected: no warnings, no type errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(stories): Storybook as the integration docs — basic, async, multi-select, airports, floating"
```

---

### Task 9: End-to-end tests against Storybook

**Files:**
- Modify: `playwright.config.ts`
- Create: `e2e/virtualized-combobox.e2e.ts`, `e2e/jump-keys.e2e.ts`
- Rewrite: `e2e/async-typeahead.e2e.ts`, `e2e/multi-select.e2e.ts`, `e2e/floating.e2e.ts`
- Delete: `e2e/hero.e2e.ts`, `e2e/world-airports.e2e.ts`

**Interfaces:**
- Consumes: the story ids from Task 8.
- Produces: the verification that the differentiator actually works in a real browser.

- [ ] **Step 1: Point Playwright at Storybook**

Replace `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  webServer: {
    command: "bun run storybook",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:6006" },
});
```

Stories are driven in isolation via Storybook's iframe: `/iframe.html?id=<story-id>&viewMode=story`.

- [ ] **Step 2: Delete the demo-era e2e**

```bash
git rm --quiet e2e/hero.e2e.ts e2e/world-airports.e2e.ts
```

- [ ] **Step 3: Write the virtualization e2e**

Create `e2e/virtualized-combobox.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-world-airports--default&viewMode=story";

test("mounts only a window of the ~3,300 airports", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("combobox").click();
  const count = await page.getByRole("option").count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(100);
});

test("options report their absolute position in the full filtered list", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("combobox").click();
  const first = page.getByRole("option").first();
  // cmdk alone cannot know these — it only sees the mounted window.
  await expect(first).toHaveAttribute("aria-posinset", "1");
  const setsize = await first.getAttribute("aria-setsize");
  expect(Number(setsize)).toBeGreaterThan(3000);
});

test("arrow nav to a far row keeps aria-activedescendant mounted and in view", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  for (let i = 0; i < 60; i++) await input.press("ArrowDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // Ids can contain colons (React useId), so use an attribute selector.
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
});
```

- [ ] **Step 4: Write the jump-key e2e (the differentiator)**

Create `e2e/jump-keys.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-world-airports--default&viewMode=story";

test("End highlights the true last airport, not the last mounted row", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  const total = Number(await page.getByRole("option").first().getAttribute("aria-setsize"));
  await input.press("End");

  const activeId = await input.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  // The whole point: position equals the full list length, not the window's end.
  await expect(active).toHaveAttribute("aria-posinset", String(total));
  await expect(active).toBeInViewport();
});

test("Home returns to the true first airport", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.press("End");
  await input.press("Home");

  const activeId = await input.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-posinset", "1");
  await expect(active).toBeInViewport();
});

test("PageDown moves a page at a time and stays mounted", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.press("Home");
  await input.press("PageDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  const active = page.locator(`[id="${activeId}"]`);
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-posinset", "11");
});
```

- [ ] **Step 5: Rewrite the remaining e2e against their stories**

`e2e/async-typeahead.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-async-typeahead--default&viewMode=story";

test("announces loading, then results", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await input.fill("madr");

  const status = page.getByRole("status");
  await expect(status).toHaveText("Loading…");
  await expect(status).toHaveText(/result/, { timeout: 5_000 });
  expect(await page.getByRole("option").count()).toBeGreaterThan(0);
});
```

`e2e/multi-select.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-multi-select--default&viewMode=story";

test("selecting several items adds chips; clicking a chip removes it", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();

  await page.getByRole("option", { name: /Paris/ }).click();
  await page.getByRole("option", { name: /Berlin/ }).click();

  const chips = page.getByTestId("chips").getByRole("button");
  await expect(chips).toHaveCount(2);

  await chips.first().click();
  await expect(page.getByTestId("chips").getByRole("button")).toHaveCount(1);
});

test("options expose chosen state via aria-checked", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  const paris = page.getByRole("option", { name: /Paris/ });
  await expect(paris).toHaveAttribute("aria-checked", "false");
  await paris.click();
  await expect(page.getByRole("option", { name: /Paris/ })).toHaveAttribute("aria-checked", "true");
});
```

`e2e/floating.e2e.ts`:

```ts
import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=combobulate-floating--default&viewMode=story";

test("opens on focus and dismisses on outside click", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await expect(page.getByRole("option").first()).toBeVisible();

  await page.mouse.click(5, 5);
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("dismisses on Escape", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await expect(page.getByRole("option").first()).toBeVisible();
  await input.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
});

test("closes on select (single-select)", async ({ page }) => {
  await page.goto(STORY);
  const input = page.getByRole("combobox");
  await input.click();
  await page.getByRole("option").first().click();
  await expect(page.getByRole("option")).toHaveCount(0);
});
```

- [ ] **Step 6: Run the e2e suite**

Run: `bun run e2e`
Expected: all pass. The jump-key specs are the ones that must not be "fixed" by weakening the assertion — if `End` lands on anything other than `aria-posinset === setsize`, the bridge is broken, not the test.

- [ ] **Step 7: Full verification**

Run: `bun test && bun run typecheck && bun run lint && bun run build && bun run e2e`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test(e2e): drive the cmdk core through Storybook; cover jump keys and virtualization"
```

---

### Task 10: Update the README to the rebuilt library

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the v1 public surface (Task 7) and the stories (Task 8).
- Produces: docs matching what actually ships.

- [ ] **Step 1: Rewrite `README.md`**

Replace the whole file:

````markdown
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
  scroll the true target into mount, then hand cmdk the value.

## Install

```sh
bun add combobulate
```

Only `react` and `react-dom` are peers. cmdk, TanStack Virtual, and Floating UI
come along as regular dependencies.

## Use

```tsx
import { Combobulate, useCombobulate } from "combobulate";

const CITIES = ["Paris", "Madrid", "Berlin" /* …thousands more */];

function CityPicker() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });

  return (
    <Combobulate.Root api={api} label="Cities">
      <Combobulate.Input aria-label="City" placeholder="Search cities…" />
      <Combobulate.List>
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

Combobulate ships **no styles** — every element is yours to class up.

## Filtering

The default is a diacritic-insensitive substring match. Bring your own matcher
(Fuse.js, match-sorter, a remote API) with `filterItems`:

```tsx
const fuse = new Fuse(AIRPORTS, { keys: ["city", "iata"], threshold: 0.3 });

useCombobulate({
  items: AIRPORTS,
  filterItems: (items, query) =>
    query ? fuse.search(query).map((r) => r.item) : items,
});
```

For remote search, feed `items` yourself and pass `loading` — the live region
announces it. `onInputChange` fires on every keystroke.

## Floating dropdown

Opt in with `useAutocompleteFloating` + `Combobulate.Popover`: anchors to the
input, flips when there's no room below, matches the input width, caps its
height to the viewport, and dismisses on outside-click or Escape.

```tsx
const combo = useCombobulate({ items: CITIES });
const floating = useAutocompleteFloating(combo, { closeOnSelect: true });

<Combobulate.Root api={combo}>
  <Combobulate.Input ref={floating.reference} {...floating.referenceProps} />
  <Combobulate.Popover floating={floating}>
    <Combobulate.List>{/* … */}</Combobulate.List>
  </Combobulate.Popover>
</Combobulate.Root>;
```

## Examples

Storybook is the demo surface and the integration docs — basic, async typeahead
(Fuse), multi-select chips, ~3,300 real airports in one virtualized list, and
floating placement:

```sh
bun run storybook
```

## Roadmap

The nested-tree layer (`useTree`, virtualized `role="tree"`, select-all-under)
is **parked** while the core settles on cmdk. Its source lives in `src/tree/`,
frozen and excluded from the build.

## License

MIT
````

- [ ] **Step 2: Verify every code sample matches the real API**

Run: `grep -n "useAutocompleteVirtual\|NestedAutocomplete\|styles.css\|<Autocomplete" README.md`
Expected: no output (all belong to the deleted surface).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite the README for the cmdk-backed, headless v1"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §2 scope: tree parked, preset cut, demos cut | 1 |
| §3 layering + `Combobulate.*` over cmdk | 4, 7 |
| §4 bridge (mounted active row) | 3 |
| §4 full-list `aria-setsize`/`posinset` | 4 |
| §4 correct jump keys | 5 |
| §5 filtering + async | 3, 8 |
| §6 selection + multi-select | 3, 4, 8 |
| §7 floating layer | 6, 8 |
| §8 survives/dies/parked | 1, 4, 7 |
| §9 dependencies | 1 |
| §10 Storybook | 8 |
| §11 public API | 7 |
| §12 testing | 2–9 |
| §13 risks | 2 (characterization), 5 + 9 (jump-key verification) |

**Deviations from the spec, deliberate:**

1. **`merge-props.ts` survives.** The spec called it likely-deletable. It isn't: the
   floating layer spreads its own `onKeyDown` onto the same Input that carries the
   jump-key handler, so composition is a real, present requirement (§3 of CLAUDE.md's
   abstraction rule is satisfied — it has a real consumer).
2. **`aria-selected` is left to cmdk; multi-select chosen state uses `aria-checked`.**
   The spec didn't pin this. cmdk uses `aria-selected` for the *highlighted* row, so
   overriding it would break `aria-activedescendant` semantics.
3. **Task 2 (characterization) was not in the spec.** Added because the design rests on
   two undocumented cmdk behaviors; pinning them with tests before building is cheaper
   than discovering them in Task 5.
4. **`useCombobulate` is the final hook name** (spec §11 left it open), collapsing
   `useAutocomplete` + `useAutocompleteVirtual` now that virtualization is core.
5. **README rewrite (Task 10)** was implied by the spec but had no task; added.

**Placeholder scan:** none — every code step carries complete code; no "TBD"/"handle edge
cases"/"similar to Task N".

**Type consistency:** `CombobulateApi`/`UseCombobulateOptions` are defined once (Task 3),
extended once (`onInputKeyDown`, Task 5), and consumed under those exact names in Tasks
4–7. `itemValue`, `activeValue`, `setActiveValue`, `activeIndex`, `isSelected`, `scrollRef`,
and `virtualizer` are used consistently across the hook, primitives, tests, and floating layer.

**Known risk carried into execution:** Task 5's "scroll to mount, then set cmdk's value" is
the highest-risk seam (spec §13). Task 2 pins the preconditions; Task 5's unit tests cover the
logic; Task 9's `jump-keys.e2e.ts` proves it in a real browser. If cmdk fails to re-point
`aria-activedescendant` at the freshly mounted row in the same tick, the fallback is a
one-frame deferred `setActiveValue` (spec §13) — implement it there, not by weakening the test.
