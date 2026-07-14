# Combobulate Foundation & Core Linear Combobox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a headless, accessible, virtualized **linear** combobox (`useAutocomplete` + base primitives + a styled `<Autocomplete>` preset), fully tested, with a playground that renders 10,000 items smoothly.

**Architecture:** One React + TypeScript package built on TanStack Virtual. `useAutocomplete` owns all state (open, inputValue, activeIndex, selection) as explicit state — never derived from the DOM. Keyboard uses `aria-activedescendant` with a state-owned `activeIndex`; on active change we call `virtualizer.scrollToIndex` so the row mounts before ARIA points at it. Base primitives compose the hook and expose state via `data-*` attributes (zero CSS in core). The tree/nested layer is deliberately **out of scope** here (separate plan) — nothing in this plan may introduce expansion/depth concepts.

**Tech Stack:** Bun (package manager + test runner), TypeScript, React 19, `@tanstack/react-virtual` v3, tsup (bundling), Biome (lint/format), `@testing-library/react` + happy-dom (unit), Playwright + Vite (e2e/playground).

## Global Constraints

- **Language:** TypeScript only. **File names:** kebab-case. **TSDoc on every exported function.**
- **Package name:** `combobulate`. **License:** MIT. **Module formats:** ESM + CJS + `.d.ts`.
- **Peer deps:** `react`, `react-dom`, `@tanstack/react-virtual`. Core ships **zero runtime CSS**.
- **Core is tree-unaware:** no `expandedIds`, `depth`, `parentId`, or tree concepts in any core API, type, or test.
- **State is explicit:** never derive combobox state by reading the DOM.
- **Styling:** state exposed only via `data-*` attributes (`data-active`, `data-selected`, `data-disabled`). No JS-driven `:hover`.
- **Commit style:** Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`). Commit after every green step group.
- **Test command:** `bun test`. **Build:** `bun run build`. **Lint:** `bun run lint`.

---

### Task 1: Repo scaffold, tooling, and green "hello" test

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `tsup.config.ts`, `test-setup.ts`, `LICENSE`, `README.md`
- Create: `src/index.ts`, `src/internal/version.ts`, `src/internal/version.test.ts`

**Interfaces:**
- Produces: `bun test`, `bun run build`, `bun run lint`, `bun run typecheck` all runnable. `src/index.ts` is the package entry.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "combobulate",
  "version": "0.0.0",
  "description": "The headless toolkit for accessible, virtualized autocompletes.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "sideEffects": ["**/*.css"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18",
    "@tanstack/react-virtual": ">=3"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@happy-dom/global-registrator": "^15.11.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@tanstack/react-virtual": "^3.10.9",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

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
  "include": ["src", "test-setup.ts", "tsup.config.ts"]
}
```

- [ ] **Step 3: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true, "a11y": { "recommended": true } }
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "files": { "ignore": ["dist", "node_modules", "examples/**/dist", "playwright-report"] }
}
```

- [ ] **Step 4: Create `bunfig.toml` and `test-setup.ts`**

`bunfig.toml`:
```toml
[test]
preload = ["./test-setup.ts"]
```

`test-setup.ts`:
```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
```

- [ ] **Step 5: Create `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "@tanstack/react-virtual"],
});
```

- [ ] **Step 6: Create `LICENSE` (MIT) and a minimal `README.md`**

`README.md`:
```md
# combobulate

The headless toolkit for accessible, virtualized autocompletes.

> Work in progress. See `docs/superpowers/specs/2026-07-14-combobulate-design.md`.
```

Add a standard MIT `LICENSE` with holder "Alex Vivero" and year 2026.

- [ ] **Step 7: Write the failing test**

`src/internal/version.test.ts`:
```ts
import { expect, test } from "bun:test";
import { VERSION } from "./version";

test("VERSION is a semver-shaped string", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `bun install && bun test src/internal/version.test.ts`
Expected: FAIL — cannot find module `./version`.

- [ ] **Step 9: Write minimal implementation**

`src/internal/version.ts`:
```ts
/** The current Combobulate package version. */
export const VERSION = "0.0.0";
```

`src/index.ts`:
```ts
export { VERSION } from "./internal/version";
```

- [ ] **Step 10: Run test + typecheck + build to verify green**

Run: `bun test && bun run typecheck && bun run build`
Expected: test PASS; typecheck clean; `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` produced.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold combobulate repo (bun, ts, tsup, biome, happy-dom)"
```

---

### Task 2: Item identity & default search-text/filter utilities

**Files:**
- Create: `src/core/item-utils.ts`, `src/core/item-utils.test.ts`

**Interfaces:**
- Produces:
  - `resolveItemId<T>(item: T, index: number, getItemId?: (item: T) => string): string`
  - `defaultGetSearchText(item: unknown): string`
  - `normalizeText(text: string): string` — lowercases + strips diacritics.
  - `defaultFilterItems<T>(items: T[], query: string, getSearchText: (item: T) => string): T[]`

- [ ] **Step 1: Write the failing test**

`src/core/item-utils.test.ts`:
```ts
import { expect, test } from "bun:test";
import {
  defaultFilterItems,
  defaultGetSearchText,
  normalizeText,
  resolveItemId,
} from "./item-utils";

test("normalizeText lowercases and strips diacritics", () => {
  expect(normalizeText("Málaga")).toBe("malaga");
});

test("defaultGetSearchText reads string items directly", () => {
  expect(defaultGetSearchText("Paris")).toBe("Paris");
});

test("defaultGetSearchText reads a `label` field for objects", () => {
  expect(defaultGetSearchText({ label: "Paris", value: "PAR" })).toBe("Paris");
});

test("resolveItemId prefers getItemId, falls back to index", () => {
  expect(resolveItemId({ id: "x" }, 3, (i) => (i as { id: string }).id)).toBe("x");
  expect(resolveItemId("Paris", 3)).toBe("3");
});

test("defaultFilterItems matches normalized substring", () => {
  const items = ["Málaga", "Madrid", "Paris"];
  expect(defaultFilterItems(items, "ma", (s) => s)).toEqual(["Málaga", "Madrid"]);
});

test("defaultFilterItems returns all items for empty query", () => {
  const items = ["A", "B"];
  expect(defaultFilterItems(items, "", (s) => s)).toEqual(["A", "B"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/item-utils.test.ts`
Expected: FAIL — cannot find module `./item-utils`.

- [ ] **Step 3: Write minimal implementation**

`src/core/item-utils.ts`:
```ts
/**
 * Lowercase `text` and strip diacritics (e.g. "Málaga" -> "malaga") so search
 * matching is accent-insensitive.
 */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Default accessor for the searchable/display text of an item. Strings are
 * returned as-is; objects expose their `label` field when present.
 */
export function defaultGetSearchText(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "label" in item) {
    return String((item as { label: unknown }).label);
  }
  return "";
}

/**
 * Resolve a stable id for an item, preferring the caller's `getItemId`
 * accessor and falling back to the item's positional index.
 */
export function resolveItemId<T>(
  item: T,
  index: number,
  getItemId?: (item: T) => string,
): string {
  return getItemId ? getItemId(item) : String(index);
}

/**
 * Default filter: keep items whose normalized search text contains the
 * normalized query as a substring. An empty query keeps everything.
 */
export function defaultFilterItems<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
): T[] {
  const q = normalizeText(query);
  if (q.length === 0) return items;
  return items.filter((item) => normalizeText(getSearchText(item)).includes(q));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/item-utils.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/item-utils.ts src/core/item-utils.test.ts
git commit -m "feat: add item id, normalization, and default filter utilities"
```

---

### Task 3: `useAutocomplete` — state, filtering, and open/close (no virtualization yet)

**Files:**
- Create: `src/core/types.ts`, `src/core/use-autocomplete.ts`, `src/core/use-autocomplete.test.tsx`

**Interfaces:**
- Consumes: `resolveItemId`, `defaultGetSearchText`, `defaultFilterItems` from Task 2.
- Produces:
  - `UseAutocompleteOptions<T>` and `AutocompleteApi<T>` types (in `types.ts`).
  - `useAutocomplete<T>(options: UseAutocompleteOptions<T>): AutocompleteApi<T>`.
  - Returned API (this task): `{ isOpen, open(), close(), setOpen(next), inputValue, setInputValue(v), filteredItems, activeIndex, setActiveIndex(i), moveActive(delta), selectedItems, select(item), getItemId(item, index) }`.

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
/** Options accepted by {@link useAutocomplete}. Deliberately tree-unaware. */
export interface UseAutocompleteOptions<T> {
  /** Full list of items to search over. */
  items: T[];
  /** Accessor for an item's searchable/display text. */
  getSearchText?: (item: T) => string;
  /** Accessor for an item's stable id. Falls back to positional index. */
  getItemId?: (item: T) => string;
  /** Custom filter. Defaults to a normalized substring match. */
  filterItems?: (items: T[], query: string) => T[];
  /** Controlled selection. */
  value?: T | T[] | null;
  /** Initial selection for the uncontrolled case. */
  defaultValue?: T | T[] | null;
  /** Fired when selection changes. */
  onChange?: (value: T | T[] | null) => void;
  /** Controlled input text. */
  inputValue?: string;
  /** Fired on every input change (post-debounce if `debounce` set). */
  onInputChange?: (value: string) => void;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state for the uncontrolled case. */
  defaultOpen?: boolean;
  /** Fired when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Allow selecting multiple items. */
  multiple?: boolean;
  /** Debounce (ms) applied to filtering. Default 0 (off). */
  debounce?: number;
  /** External loading flag for async data. */
  loading?: boolean;
}

/** Public API returned by {@link useAutocomplete}. */
export interface AutocompleteApi<T> {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (next: boolean) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  filteredItems: T[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  moveActive: (delta: number) => void;
  selectedItems: T[];
  select: (item: T) => void;
  getItemId: (item: T, index: number) => string;
}
```

- [ ] **Step 2: Write the failing test**

`src/core/use-autocomplete.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAutocomplete } from "./use-autocomplete";

const ITEMS = ["Paris", "Madrid", "Málaga", "Berlin"];

test("filters items by normalized input value", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => result.current.setInputValue("ma"));
  expect(result.current.filteredItems).toEqual(["Madrid", "Málaga"]);
});

test("open/close toggles isOpen", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  expect(result.current.isOpen).toBe(false);
  act(() => result.current.open());
  expect(result.current.isOpen).toBe(true);
  act(() => result.current.close());
  expect(result.current.isOpen).toBe(false);
});

test("moveActive clamps within filtered bounds", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => result.current.moveActive(1));
  expect(result.current.activeIndex).toBe(0);
  act(() => result.current.moveActive(-5));
  expect(result.current.activeIndex).toBe(0);
  act(() => result.current.moveActive(100));
  expect(result.current.activeIndex).toBe(ITEMS.length - 1);
});

test("select (single) sets selectedItems and calls onChange", () => {
  let changed: unknown;
  const { result } = renderHook(() =>
    useAutocomplete({ items: ITEMS, onChange: (v) => (changed = v) }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.selectedItems).toEqual(["Madrid"]);
  expect(changed).toBe("Madrid");
});

test("select (multiple) accumulates and toggles", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS, multiple: true }));
  act(() => result.current.select("Madrid"));
  act(() => result.current.select("Paris"));
  expect(result.current.selectedItems).toEqual(["Madrid", "Paris"]);
  act(() => result.current.select("Madrid"));
  expect(result.current.selectedItems).toEqual(["Paris"]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/core/use-autocomplete.test.tsx`
Expected: FAIL — cannot find module `./use-autocomplete`.

- [ ] **Step 4: Write minimal implementation**

`src/core/use-autocomplete.ts`:
```ts
import { useCallback, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, resolveItemId } from "./item-utils";
import type { AutocompleteApi, UseAutocompleteOptions } from "./types";

/**
 * Headless state machine for a linear (non-nested) autocomplete/combobox.
 * Owns open state, input text, the active descendant index, filtering, and
 * selection. It is intentionally tree-unaware.
 */
export function useAutocomplete<T>(options: UseAutocompleteOptions<T>): AutocompleteApi<T> {
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
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeIndex, setActiveIndexState] = useState(0);
  const [selectedItems, setSelectedItems] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  const filteredItems = useMemo(() => {
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText]);

  const filteredRef = useRef(filteredItems);
  filteredRef.current = filteredItems;

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
      setActiveIndexState(0);
      onInputChange?.(value);
    },
    [onInputChange],
  );

  const setActiveIndex = useCallback((index: number) => {
    const max = Math.max(0, filteredRef.current.length - 1);
    setActiveIndexState(Math.min(Math.max(index, 0), max));
  }, []);

  const moveActive = useCallback(
    (delta: number) => setActiveIndex(activeIndex + delta),
    [activeIndex, setActiveIndex],
  );

  const select = useCallback(
    (item: T) => {
      setSelectedItems((prev) => {
        let next: T[];
        if (multiple) {
          next = prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
        } else {
          next = [item];
        }
        onChange?.(multiple ? next : (next[0] ?? null));
        return next;
      });
    },
    [multiple, onChange],
  );

  const getItemIdCb = useCallback(
    (item: T, index: number) => resolveItemId(item, index, getItemId),
    [getItemId],
  );

  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    setOpen,
    inputValue,
    setInputValue,
    filteredItems,
    activeIndex,
    setActiveIndex,
    moveActive,
    selectedItems,
    select,
    getItemId: getItemIdCb,
  };
}
```

Add exports to `src/index.ts`:
```ts
export { useAutocomplete } from "./core/use-autocomplete";
export type { AutocompleteApi, UseAutocompleteOptions } from "./core/types";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/core/use-autocomplete.test.tsx && bun run typecheck`
Expected: PASS (5 tests); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/ src/index.ts
git commit -m "feat: add useAutocomplete state machine (filtering, open/close, selection)"
```

---

### Task 4: Debounced filtering

**Files:**
- Modify: `src/core/use-autocomplete.ts`
- Create: `src/core/use-debounced-value.ts`, `src/core/use-debounced-value.test.tsx`
- Modify: `src/core/use-autocomplete.test.tsx` (add a debounce test)

**Interfaces:**
- Produces: `useDebouncedValue<V>(value: V, delayMs: number): V`. When `delayMs` is 0, returns `value` synchronously.
- Modifies: `useAutocomplete` filters against the debounced input when `options.debounce > 0`.

- [ ] **Step 1: Write the failing test**

`src/core/use-debounced-value.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./use-debounced-value";

test("returns value immediately when delay is 0", () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 0), {
    initialProps: { v: "a" },
  });
  rerender({ v: "b" });
  expect(result.current).toBe("b");
});

test("delays updates by the given delay", async () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 50), {
    initialProps: { v: "a" },
  });
  rerender({ v: "b" });
  expect(result.current).toBe("a");
  await act(() => new Promise((r) => setTimeout(r, 70)));
  expect(result.current).toBe("b");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/use-debounced-value.test.tsx`
Expected: FAIL — cannot find module `./use-debounced-value`.

- [ ] **Step 3: Write minimal implementation**

`src/core/use-debounced-value.ts`:
```ts
import { useEffect, useState } from "react";

/**
 * Return a debounced copy of `value` that only updates after `delayMs` of
 * quiet time. A `delayMs` of 0 disables debouncing and returns `value` as-is.
 */
export function useDebouncedValue<V>(value: V, delayMs: number): V {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs === 0) {
      setDebounced(value);
      return;
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return delayMs === 0 ? value : debounced;
}
```

- [ ] **Step 4: Wire debounce into `useAutocomplete`**

In `src/core/use-autocomplete.ts`, import the hook and derive the query used for filtering:
```ts
import { useDebouncedValue } from "./use-debounced-value";
```
Add after reading `inputValue` state (destructure `debounce = 0` from options):
```ts
const debouncedQuery = useDebouncedValue(inputValue, debounce);
```
Change the `filteredItems` memo to use `debouncedQuery` instead of `inputValue`:
```ts
const filteredItems = useMemo(() => {
  if (filterItems) return filterItems(items, debouncedQuery);
  return defaultFilterItems(items, debouncedQuery, getSearchText);
}, [items, debouncedQuery, filterItems, getSearchText]);
```

- [ ] **Step 5: Add a debounce test to `use-autocomplete.test.tsx`**

```tsx
test("debounce delays filtering", async () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS, debounce: 50 }));
  act(() => result.current.setInputValue("ma"));
  expect(result.current.filteredItems.length).toBe(ITEMS.length);
  await act(() => new Promise((r) => setTimeout(r, 70)));
  expect(result.current.filteredItems).toEqual(["Madrid", "Málaga"]);
});
```

- [ ] **Step 6: Run tests to verify green**

Run: `bun test src/core/ && bun run typecheck`
Expected: PASS (all core tests incl. debounce).

- [ ] **Step 7: Commit**

```bash
git add src/core/
git commit -m "feat: add debounced filtering to useAutocomplete"
```

---

### Task 5: Prop getters + `aria-activedescendant` wiring (still no virtualizer)

**Files:**
- Create: `src/core/prop-getters.ts`, `src/core/prop-getters.test.tsx`
- Modify: `src/core/types.ts` (extend `AutocompleteApi` with getters + `listId`)
- Modify: `src/core/use-autocomplete.ts` (return the getters)

**Interfaces:**
- Consumes: `AutocompleteApi` internals from Task 3.
- Produces (added to `AutocompleteApi`):
  - `listId: string`
  - `getRootProps(): { role: "combobox"; "aria-expanded": boolean }`
  - `getInputProps(): { role: "combobox"; "aria-controls": string; "aria-activedescendant": string | undefined; value: string; onChange; onKeyDown; onFocus }`
  - `getListProps(): { id: string; role: "listbox" }`
  - `getItemProps(item, index): { id: string; role: "option"; "aria-selected": boolean; "aria-setsize": number; "aria-posinset": number; "data-active": "" | undefined; "data-selected": "" | undefined; onClick; onPointerMove }`
- Keyboard handled by `getInputProps().onKeyDown`: ArrowDown/Up → `moveActive(±1)` + open; Enter → select active; Escape → close.

- [ ] **Step 1: Write the failing test**

`src/core/prop-getters.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAutocomplete } from "./use-autocomplete";

const ITEMS = ["Paris", "Madrid", "Berlin"];

test("input exposes combobox role and controls the list", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  const input = result.current.getInputProps();
  expect(input.role).toBe("combobox");
  expect(input["aria-controls"]).toBe(result.current.listId);
});

test("aria-activedescendant points at the active item id", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => result.current.open());
  act(() => result.current.setActiveIndex(1));
  const activeId = result.current.getItemProps(ITEMS[1], 1).id;
  expect(result.current.getInputProps()["aria-activedescendant"]).toBe(activeId);
});

test("item props stamp setsize/posinset from the filtered model", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  const props = result.current.getItemProps(ITEMS[2], 2);
  expect(props["aria-setsize"]).toBe(3);
  expect(props["aria-posinset"]).toBe(3);
  expect(props.role).toBe("option");
});

test("active item gets data-active attribute", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => result.current.setActiveIndex(1));
  expect(result.current.getItemProps(ITEMS[1], 1)["data-active"]).toBe("");
  expect(result.current.getItemProps(ITEMS[0], 0)["data-active"]).toBeUndefined();
});

test("ArrowDown opens and moves active; Enter selects", () => {
  let selected: unknown;
  const { result } = renderHook(() =>
    useAutocomplete({ items: ITEMS, onChange: (v) => (selected = v) }),
  );
  const key = (k: string) =>
    act(() =>
      result.current
        .getInputProps()
        .onKeyDown({ key: k, preventDefault() {} } as React.KeyboardEvent),
    );
  key("ArrowDown");
  expect(result.current.isOpen).toBe(true);
  key("ArrowDown");
  expect(result.current.activeIndex).toBe(1);
  key("Enter");
  expect(selected).toBe("Madrid");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/prop-getters.test.tsx`
Expected: FAIL — `getInputProps` is not a function.

- [ ] **Step 3: Write `src/core/prop-getters.ts`**

```ts
import type { KeyboardEvent } from "react";

/** Internal state the prop-getters read from. */
export interface PropGetterState<T> {
  isOpen: boolean;
  listId: string;
  inputValue: string;
  activeIndex: number;
  filteredItems: T[];
  selectedItems: T[];
  getItemId: (item: T, index: number) => string;
  setInputValue: (v: string) => void;
  setActiveIndex: (i: number) => void;
  moveActive: (delta: number) => void;
  setOpen: (next: boolean) => void;
  select: (item: T) => void;
  /** Called after active index changes via keyboard, to keep the row mounted. */
  onActiveChange?: (index: number) => void;
}

/** Build the prop-getter functions bound to the given state. */
export function createPropGetters<T>(state: PropGetterState<T>) {
  const activeId =
    state.isOpen && state.filteredItems[state.activeIndex] !== undefined
      ? state.getItemId(state.filteredItems[state.activeIndex] as T, state.activeIndex)
      : undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!state.isOpen) state.setOpen(true);
        else {
          state.moveActive(1);
          state.onActiveChange?.(state.activeIndex + 1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!state.isOpen) state.setOpen(true);
        else {
          state.moveActive(-1);
          state.onActiveChange?.(state.activeIndex - 1);
        }
        break;
      case "Enter": {
        const item = state.filteredItems[state.activeIndex];
        if (state.isOpen && item !== undefined) {
          event.preventDefault();
          state.select(item);
        }
        break;
      }
      case "Escape":
        state.setOpen(false);
        break;
    }
  };

  return {
    getRootProps: () => ({ role: "combobox" as const, "aria-expanded": state.isOpen }),
    getInputProps: () => ({
      role: "combobox" as const,
      "aria-controls": state.listId,
      "aria-expanded": state.isOpen,
      "aria-activedescendant": activeId,
      value: state.inputValue,
      onChange: (e: { target: { value: string } }) => {
        state.setInputValue(e.target.value);
        if (!state.isOpen) state.setOpen(true);
      },
      onKeyDown,
      onFocus: () => state.setOpen(true),
    }),
    getListProps: () => ({ id: state.listId, role: "listbox" as const }),
    getItemProps: (item: T, index: number) => {
      const isActive = index === state.activeIndex;
      const isSelected = state.selectedItems.includes(item);
      return {
        id: state.getItemId(item, index),
        role: "option" as const,
        "aria-selected": isSelected,
        "aria-setsize": state.filteredItems.length,
        "aria-posinset": index + 1,
        "data-active": isActive ? "" : undefined,
        "data-selected": isSelected ? "" : undefined,
        onClick: () => state.select(item),
        onPointerMove: () => state.setActiveIndex(index),
      };
    },
  };
}
```

- [ ] **Step 4: Wire getters into `useAutocomplete`**

In `src/core/use-autocomplete.ts`: import `useId` from React and `createPropGetters`. Create `const listId = useId();`. Build getters each render:
```ts
const getters = createPropGetters({
  isOpen, listId, inputValue, activeIndex, filteredItems, selectedItems,
  getItemId: getItemIdCb, setInputValue, setActiveIndex, moveActive, setOpen, select,
});
```
Spread `...getters` and `listId` into the returned object. Add the getter signatures + `listId` to `AutocompleteApi` in `types.ts`.

- [ ] **Step 5: Run tests to verify green**

Run: `bun test src/core/ && bun run typecheck`
Expected: PASS (all core tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/
git commit -m "feat: add prop getters with aria-activedescendant and keyboard nav"
```

---

### Task 6: Virtualization + a11y bridge

**Files:**
- Create: `src/core/use-autocomplete-virtual.ts`, `src/core/use-autocomplete-virtual.test.tsx`
- Modify: `src/core/prop-getters.ts` (already exposes `onActiveChange`; no change expected)
- Modify: `src/index.ts` (export the virtual hook)

**Interfaces:**
- Consumes: `useAutocomplete` (Task 3-5), `@tanstack/react-virtual`'s `useVirtualizer`.
- Produces:
  - `useAutocompleteVirtual<T>(options): AutocompleteApi<T> & { virtualizer: Virtualizer; getScrollProps(): { ref } }`
  - The bridge: whenever `activeIndex` changes, call `virtualizer.scrollToIndex(activeIndex)` so the active row is mounted before `aria-activedescendant` resolves.

- [ ] **Step 1: Write the failing test**

`src/core/use-autocomplete-virtual.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAutocompleteVirtual } from "./use-autocomplete-virtual";

const ITEMS = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);

test("exposes a virtualizer and a scroll ref", () => {
  const { result } = renderHook(() =>
    useAutocompleteVirtual({ items: ITEMS, estimateSize: () => 32 }),
  );
  expect(typeof result.current.virtualizer.scrollToIndex).toBe("function");
  expect(result.current.getScrollProps().ref).toBeDefined();
});

test("moving active index requests scrollToIndex", () => {
  const calls: number[] = [];
  const { result } = renderHook(() =>
    useAutocompleteVirtual({ items: ITEMS, estimateSize: () => 32 }),
  );
  // Patch the virtualizer to record scroll requests.
  const original = result.current.virtualizer.scrollToIndex;
  result.current.virtualizer.scrollToIndex = ((i: number, ...rest: unknown[]) => {
    calls.push(i);
    return (original as (...a: unknown[]) => unknown)(i, ...rest);
  }) as typeof original;
  act(() => result.current.setActiveIndex(500));
  expect(calls).toContain(500);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/use-autocomplete-virtual.test.tsx`
Expected: FAIL — cannot find module `./use-autocomplete-virtual`.

- [ ] **Step 3: Write minimal implementation**

`src/core/use-autocomplete-virtual.ts`:
```ts
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import type { AutocompleteApi, UseAutocompleteOptions } from "./types";
import { useAutocomplete } from "./use-autocomplete";

/** Extra options for the virtualized variant of {@link useAutocomplete}. */
export interface UseAutocompleteVirtualOptions<T> extends UseAutocompleteOptions<T> {
  /** Estimated row height in px. Required by TanStack Virtual. */
  estimateSize?: (index: number) => number;
  /** Rows to render above/below the viewport. Default 8. */
  overscan?: number;
}

/** Return type of {@link useAutocompleteVirtual}. */
export interface AutocompleteVirtualApi<T> extends AutocompleteApi<T> {
  virtualizer: Virtualizer<HTMLElement, Element>;
  getScrollProps: () => { ref: React.RefObject<HTMLElement | null> };
}

/**
 * Virtualized autocomplete. Wraps {@link useAutocomplete} and bridges the
 * state-owned active index to TanStack Virtual: whenever the active index
 * changes we call `scrollToIndex`, which mounts the active row so that
 * `aria-activedescendant` always resolves to a real DOM node.
 */
export function useAutocompleteVirtual<T>(
  options: UseAutocompleteVirtualOptions<T>,
): AutocompleteVirtualApi<T> {
  const { estimateSize = () => 32, overscan = 8, ...rest } = options;
  const api = useAutocomplete(rest);
  const scrollRef = useRef<HTMLElement | null>(null);

  const virtualizer = useVirtualizer({
    count: api.filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  // Bridge: keep the active row mounted whenever the active index changes.
  useEffect(() => {
    if (api.isOpen && api.filteredItems.length > 0) {
      virtualizer.scrollToIndex(api.activeIndex, { align: "auto" });
    }
  }, [api.activeIndex, api.isOpen, api.filteredItems.length, virtualizer]);

  return { ...api, virtualizer, getScrollProps: () => ({ ref: scrollRef }) };
}
```

Export from `src/index.ts`:
```ts
export { useAutocompleteVirtual } from "./core/use-autocomplete-virtual";
export type {
  AutocompleteVirtualApi,
  UseAutocompleteVirtualOptions,
} from "./core/use-autocomplete-virtual";
```

- [ ] **Step 4: Run tests to verify green**

Run: `bun test src/core/ && bun run typecheck`
Expected: PASS. (The scroll-request test asserts the bridge fires.)

- [ ] **Step 5: Commit**

```bash
git add src/core/ src/index.ts
git commit -m "feat: bridge state-owned activeIndex to TanStack Virtual (a11y-safe virtualization)"
```

---

### Task 7: Headless base primitives

**Files:**
- Create: `src/primitives/context.ts`, `src/primitives/combobulate.tsx`, `src/primitives/combobulate.test.tsx`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `AutocompleteVirtualApi` / `AutocompleteApi`.
- Produces: `Combobulate` compound component: `Combobulate.Root`, `.Input`, `.List`, `.Item`, `.Empty`. `Root` takes an `api` prop (the value returned by `useAutocomplete*`) and provides it via context; children read it. `List` renders the virtualized scroll container; `Item` is rendered by the consumer via a render-prop over `virtualizer.getVirtualItems()`.

- [ ] **Step 1: Write the failing test**

`src/primitives/combobulate.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "./combobulate";

const ITEMS = ["Paris", "Madrid", "Berlin"];

function Demo() {
  const api = useAutocompleteVirtual({ items: ITEMS, defaultOpen: true });
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
    </Combobulate.Root>
  );
}

test("renders an accessible combobox with option rows", () => {
  render(<Demo />);
  const input = screen.getByRole("combobox");
  expect(input).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/primitives/combobulate.test.tsx`
Expected: FAIL — cannot find module `./combobulate`.

- [ ] **Step 3: Write `src/primitives/context.ts`**

```ts
import { createContext, useContext } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";

// biome-ignore lint/suspicious/noExplicitAny: context is generic over item type
const CombobulateContext = createContext<AutocompleteVirtualApi<any> | null>(null);

/** Provider for the Combobulate primitive tree. */
export const CombobulateProvider = CombobulateContext.Provider;

/** Read the active Combobulate api from context. Throws outside a `Root`. */
export function useCombobulateContext<T>(): AutocompleteVirtualApi<T> {
  const ctx = useContext(CombobulateContext);
  if (!ctx) throw new Error("Combobulate primitives must be used within <Combobulate.Root>");
  return ctx;
}
```

- [ ] **Step 4: Write `src/primitives/combobulate.tsx`**

```tsx
import type { ReactNode } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";
import { CombobulateProvider, useCombobulateContext } from "./context";

/** Root provider. Pass the value returned by `useAutocompleteVirtual`. */
function Root<T>({ api, children }: { api: AutocompleteVirtualApi<T>; children: ReactNode }) {
  return <CombobulateProvider value={api}>{children}</CombobulateProvider>;
}

/** The combobox text input. */
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const api = useCombobulateContext();
  return <input {...api.getInputProps()} {...props} />;
}

/** Virtualized scroll container. `children` is a render-prop per visible item. */
function List<T>({
  children,
  style,
}: {
  children: (item: T, index: number) => ReactNode;
  style?: React.CSSProperties;
}) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  const rows = api.virtualizer.getVirtualItems();
  const { ref } = api.getScrollProps();
  return (
    <div
      {...api.getListProps()}
      ref={ref as React.Ref<HTMLDivElement>}
      style={{ overflow: "auto", position: "relative", maxHeight: 300, ...style }}
    >
      <div style={{ height: api.virtualizer.getTotalSize(), position: "relative" }}>
        {rows.map((row) => {
          const item = api.filteredItems[row.index] as T;
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
  );
}

/** A single option row. */
function Item<T>({
  item,
  index,
  children,
}: {
  item: T;
  index: number;
  children: ReactNode;
}) {
  const api = useCombobulateContext<T>();
  return <div {...api.getItemProps(item, index)}>{children}</div>;
}

/** Rendered when there are no filtered items. */
function Empty({ children }: { children: ReactNode }) {
  const api = useCombobulateContext();
  if (!api.isOpen || api.filteredItems.length > 0) return null;
  return <div role="status">{children}</div>;
}

/** Headless Combobulate primitives. */
export const Combobulate = { Root, Input, List, Item, Empty };
```

Export from `src/index.ts`:
```ts
export { Combobulate } from "./primitives/combobulate";
```

- [ ] **Step 5: Run tests to verify green**

Run: `bun test src/ && bun run typecheck`
Expected: PASS.

> Note: if `toBeInTheDocument`/`toHaveAttribute` matchers are unavailable, assert with `expect(input.getAttribute("aria-expanded")).toBe("true")` instead — happy-dom exposes standard DOM APIs.

- [ ] **Step 6: Commit**

```bash
git add src/primitives/ src/index.ts
git commit -m "feat: add headless Combobulate base primitives (Root/Input/List/Item/Empty)"
```

---

### Task 8: Styled `<Autocomplete>` preset + optional stylesheet

**Files:**
- Create: `src/presets/autocomplete.tsx`, `src/presets/autocomplete.test.tsx`, `src/presets/styles.css`
- Modify: `src/index.ts`, `tsup.config.ts` (bundle the CSS)

**Interfaces:**
- Consumes: `useAutocompleteVirtual`, `Combobulate` primitives.
- Produces: `<Autocomplete<T> items renderItem? placeholder? filterItems? getSearchText? onChange? estimateSize? />` — a batteries-included, class-named component styling via `data-*` selectors in `styles.css`.

- [ ] **Step 1: Write the failing test**

`src/presets/autocomplete.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Autocomplete } from "./autocomplete";

const ITEMS = ["Paris", "Madrid", "Berlin"];

test("typing filters and clicking selects", async () => {
  const user = userEvent.setup();
  let selected: unknown;
  render(<Autocomplete items={ITEMS} onChange={(v) => (selected = v)} placeholder="City" />);
  const input = screen.getByRole("combobox");
  await user.type(input, "ma");
  const options = screen.getAllByRole("option");
  expect(options.map((o) => o.textContent)).toEqual(["Madrid"]);
  await user.click(options[0]);
  expect(selected).toBe("Madrid");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/presets/autocomplete.test.tsx`
Expected: FAIL — cannot find module `./autocomplete`.

- [ ] **Step 3: Write `src/presets/autocomplete.tsx`**

```tsx
import type { ReactNode } from "react";
import { Combobulate } from "../primitives/combobulate";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";

/** Props for the batteries-included {@link Autocomplete} preset. */
export interface AutocompleteProps<T> {
  items: T[];
  renderItem?: (item: T) => ReactNode;
  getSearchText?: (item: T) => string;
  filterItems?: (items: T[], query: string) => T[];
  onChange?: (value: T | T[] | null) => void;
  placeholder?: string;
  estimateSize?: (index: number) => number;
  emptyMessage?: ReactNode;
}

/** A styled, virtualized linear autocomplete built on Combobulate primitives. */
export function Autocomplete<T>({
  items,
  renderItem = (item) => String(item),
  getSearchText,
  filterItems,
  onChange,
  placeholder,
  estimateSize,
  emptyMessage = "No results",
}: AutocompleteProps<T>) {
  const api = useAutocompleteVirtual({ items, getSearchText, filterItems, onChange, estimateSize });
  return (
    <div className="cbl-root">
      <Combobulate.Root api={api}>
        <Combobulate.Input className="cbl-input" placeholder={placeholder} />
        <Combobulate.List style={{}}>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              <div className="cbl-option">{renderItem(item)}</div>
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>
          <div className="cbl-empty">{emptyMessage}</div>
        </Combobulate.Empty>
      </Combobulate.Root>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/presets/styles.css`**

```css
.cbl-root { position: relative; font-family: system-ui, sans-serif; }
.cbl-input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; }
.cbl-option { padding: 8px 12px; cursor: pointer; }
.cbl-option[data-active] { background: #e2e8f0; }
.cbl-option[data-selected] { font-weight: 600; }
.cbl-empty { padding: 8px 12px; color: #64748b; }
```

Note: apply `data-active`/`data-selected` to the `.cbl-option` by having `Item` forward the data attributes — they already sit on the `Item` wrapper div; adjust the CSS selectors to `.cbl-option`'s parent: use `[data-active] .cbl-option { background: #e2e8f0; }` and `[data-selected] .cbl-option { font-weight: 600; }`.

- [ ] **Step 5: Bundle CSS in `tsup.config.ts`**

Add `"src/presets/styles.css"` to the tsup `entry` array (or set `injectStyle: false` and copy). Verify `dist/styles.css` exists after build.

- [ ] **Step 6: Run tests + build to verify green**

Run: `bun test src/ && bun run typecheck && bun run build`
Expected: PASS; `dist/styles.css` present.

- [ ] **Step 7: Commit**

```bash
git add src/presets/ src/index.ts tsup.config.ts
git commit -m "feat: add styled Autocomplete preset with optional stylesheet"
```

---

### Task 9: Playground app (Vite) — the 10k-item showcase

**Files:**
- Create: `examples/playground/package.json`, `examples/playground/vite.config.ts`, `examples/playground/index.html`, `examples/playground/src/main.tsx`, `examples/playground/src/app.tsx`
- Modify: root `package.json` (add `workspaces: ["examples/*"]` and `dev` script)

**Interfaces:**
- Consumes: the built/linked `combobulate` package.
- Produces: a running Vite app at a known port with a `data-testid="ten-k"` autocomplete over 10,000 items — the Playwright e2e target.

- [ ] **Step 1: Add workspaces + dev script to root `package.json`**

```json
"workspaces": ["examples/*"],
"scripts": {
  "build": "tsup",
  "typecheck": "tsc --noEmit",
  "test": "bun test",
  "lint": "biome check .",
  "format": "biome format --write .",
  "dev": "bun --cwd examples/playground run dev",
  "e2e": "playwright test"
}
```

- [ ] **Step 2: Create `examples/playground/package.json`**

```json
{
  "name": "playground",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview --port 4173" },
  "dependencies": { "combobulate": "workspace:*", "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": {
    "@tanstack/react-virtual": "^3.10.9",
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 3: Create `vite.config.ts`, `index.html`, `main.tsx`**

`examples/playground/vite.config.ts`:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react()], server: { port: 5173 } });
```

`examples/playground/index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Combobulate Playground</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`examples/playground/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "combobulate/styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Create `examples/playground/src/app.tsx`**

```tsx
import { Autocomplete } from "combobulate";

const TEN_K = Array.from({ length: 10_000 }, (_, i) => `Item ${i.toString().padStart(5, "0")}`);

/** Showcase app: a virtualized autocomplete over 10,000 items. */
export function App() {
  return (
    <main style={{ maxWidth: 420, margin: "64px auto", display: "grid", gap: 24 }}>
      <h1>Combobulate</h1>
      <section data-testid="ten-k">
        <h2>10,000 items, virtualized</h2>
        <Autocomplete items={TEN_K} placeholder="Search 10k items…" />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify it runs**

Run: `bun install && bun run build && bun run dev`
Expected: Vite serves at `http://localhost:5173`; typing filters; scrolling is smooth; DOM shows only a small number of `[role=option]` nodes at once.

- [ ] **Step 6: Commit**

```bash
git add examples/ package.json
git commit -m "feat: add Vite playground with 10k-item virtualized showcase"
```

---

### Task 10: Playwright e2e — virtualized keyboard nav & mounting

**Files:**
- Create: `playwright.config.ts`, `e2e/linear-combobox.spec.ts`
- Modify: root `package.json` devDeps (`@playwright/test`)

**Interfaces:**
- Consumes: the running playground (`bun run dev`).
- Produces: e2e proving (a) only a subset of options is mounted, (b) keyboard nav to a far-down item scrolls it into view and sets `aria-activedescendant` to a mounted node.

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5173" },
});
```

- [ ] **Step 2: Write the failing e2e test**

`e2e/linear-combobox.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("virtualizes: only a subset of options is mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("ten-k").getByRole("combobox");
  await input.click();
  const optionCount = await page.getByRole("option").count();
  expect(optionCount).toBeGreaterThan(0);
  expect(optionCount).toBeLessThan(100); // 10k items, only a window mounted
});

test("keyboard nav to a far item keeps aria-activedescendant mounted", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("ten-k").getByRole("combobox");
  await input.click();
  for (let i = 0; i < 60; i++) await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  // The active descendant must be a real, mounted DOM node.
  await expect(page.locator(`#${CSS.escape(activeId as string)}`)).toHaveCount(1);
});
```

- [ ] **Step 3: Install browsers & run to verify it exercises the app**

Run: `bun add -d @playwright/test && bunx playwright install chromium && bun run e2e`
Expected: both tests PASS. (If the active-descendant test fails, the bridge in Task 6 regressed.)

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/ package.json
git commit -m "test: add Playwright e2e for virtualized keyboard nav and mounting"
```

---

### Task 11: CI, README, and package polish

**Files:**
- Create: `.github/workflows/ci.yml`, expand `README.md`
- Modify: `package.json` (repository, keywords, homepage)

**Interfaces:**
- Produces: green CI running lint + typecheck + unit tests (+ build) on push/PR; a README with install, quick-start, and the three consumption altitudes.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
```

- [ ] **Step 2: Expand `README.md`**

Include: one-line pitch; `bun add combobulate` (peer deps note); a `useAutocompleteVirtual` headless snippet; a `<Autocomplete>` preset snippet; a short "three ways to use it" section; a link to the design spec; MIT badge. Copy the exact `<Autocomplete items={...} />` usage from Task 8.

- [ ] **Step 3: Add package metadata to `package.json`**

```json
"keywords": ["autocomplete", "combobox", "headless", "virtualized", "accessible", "react"],
"repository": { "type": "git", "url": "git+https://github.com/<user>/combobulate.git" },
"homepage": "https://github.com/<user>/combobulate#readme"
```

- [ ] **Step 4: Run the full local pipeline**

Run: `bun run lint && bun run typecheck && bun test && bun run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add .github/ README.md package.json
git commit -m "chore: add CI, README, and package metadata"
```

---

## Self-Review

**Spec coverage (§ = spec section):**
- §2 layering (core hook + primitives + preset): Tasks 3-8. ✓
- §3 a11y/virtualization bridge (aria-activedescendant + scrollToIndex + data-driven setsize/posinset): Tasks 5-6, verified in Task 10. ✓
- §4 tree layer: **intentionally deferred to Plan 2** — noted at top; this plan keeps the core tree-unaware (Global Constraints). ✓
- §5 filtering/async/debounce: Tasks 2, 4 (default filter, normalization, injectable `filterItems`, debounce); `loading` option is threaded (Task 3 types) and consumed by presets in Plan 2's async scenario. ✓
- §6 API surface: `useAutocomplete`/`useAutocompleteVirtual`/primitives/`Autocomplete` delivered; `useTree`/`NestedAutocomplete` are Plan 2. ✓
- §7 infra (Bun, TS, kebab-case, tsup, Biome, bun test + happy-dom, Playwright, MIT): Tasks 1, 9-11. ✓
- §8 showcase scenario 1 (10k flat): Task 9; scenarios 2-4 (nested, dynamic-height demo, fuzzy/async) land in Plan 2 / follow-up. Scenario 5 (fully headless) is exercised by Task 7's primitives test. ✓
- §9 testing strategy: unit (Tasks 2-8), e2e (Task 10). ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" — each step ships real code or an exact command. ✓

**Type consistency:** `AutocompleteApi<T>` extended additively across Tasks 3→5; `useAutocompleteVirtual` returns `AutocompleteVirtualApi<T>` used consistently by primitives (Task 7) and preset (Task 8); `getItemProps(item, index)` signature identical in Tasks 5, 7, 8; `getScrollProps().ref` consumed exactly as produced. ✓

**Known follow-ups for Plan 2:** `useTree`, tree primitives, `<NestedAutocomplete>`, dynamic-height + nested + fuzzy/async playground scenarios, and their e2e.
