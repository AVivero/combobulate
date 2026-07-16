# Combobulate Floating Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `src/floating/` layer (on `@floating-ui/react`) giving the
dropdown a collision-aware floating position + dismiss on outside-click/Escape,
default-on in the presets, with the core and base primitives staying
positioning-agnostic.

**Architecture:** Mirrors the tree layer. A `useAutocompleteFloating` hook wraps
Floating UI; a `<Combobulate.Popover>` primitive is the positioned, dismissing
container around `<Combobulate.List>`. The only base-primitive change is making
`Combobulate.Input` a `forwardRef` so the floating layer can anchor to it.

**Tech Stack:** React 19, `@floating-ui/react` ^0.27, Bun (tests), Playwright (e2e).

Spec: `docs/superpowers/specs/2026-07-16-combobulate-floating-layer-design.md`

## Global Constraints

- Core (`src/core/*`) and base primitives (`List`/`Item`/`Empty`/`LiveRegion`)
  gain **no** Floating UI dependency and **no** positioning logic. Only
  `Combobulate.Input` changes — to `forwardRef` (backward-compatible).
- `@floating-ui/react` is a **direct dependency**, imported only from
  `src/floating/*` (tree-shaken out when the floating layer isn't imported).
- Presets float + dismiss by default; existing preset API is unchanged.
- Placement `bottom-start`; middleware `offset` + `flip` + `shift` + `size`
  (match input width, cap max-height to available viewport).
- Dismiss: outside-click + Escape. Single-select closes on pick; multi stays open.
- Repo conventions: `type` over `interface`; no non-null `!`;
  `noUncheckedIndexedAccess` on; block-body arrows for captures. Zero Biome warnings.

---

## File Structure

```
src/floating/
  types.ts                  # UseFloatingOptions, AutocompleteFloating
  use-floating.ts           # useAutocompleteFloating hook
  use-floating.test.tsx     # api wiring + close-on-select
  floating-primitives.tsx   # Combobulate.Popover
  floating-primitives.test.tsx
src/primitives/combobulate.tsx   # Input -> forwardRef (Popover NOT added here)
src/index.ts                     # export hook + types, augment Combobulate.Popover
src/presets/autocomplete.tsx         # default-on floating
src/presets/nested-autocomplete.tsx  # default-on floating
examples/playground/src/sections/Hero.tsx   # adopt Popover
examples/playground/src/sections/Hero.css   # drop manual dropdown positioning
e2e/floating.e2e.ts              # new
README.md                        # floating layer section
```

---

### Task 1: Dependency + `useAutocompleteFloating` hook

**Files:**
- Modify: `package.json` (add dep)
- Create: `src/floating/types.ts`, `src/floating/use-floating.ts`,
  `src/floating/use-floating.test.tsx`

**Interfaces:**
- Consumes: the combo api (`AutocompleteVirtualApi<T>` — needs `isOpen`,
  `setOpen`, `selectedItems`, `getItemId`).
- Produces:
  - `type UseFloatingOptions = { placement?: Placement; offset?: number;
    padding?: number; matchWidth?: boolean; dismissOnOutsideClick?: boolean;
    closeOnSelect?: boolean }`
  - `type AutocompleteFloating = { reference: (el: Element | null) => void;
    floating: (el: HTMLElement | null) => void; floatingStyles: React.CSSProperties;
    referenceProps: Record<string, unknown>; floatingProps: Record<string, unknown> }`
  - `useAutocompleteFloating<T>(api, options?): AutocompleteFloating`

- [ ] **Step 1: Add the dependency**

Add to `package.json` `dependencies`: `"@floating-ui/react": "^0.27"`. Run `bun install`.
Run: `bun install` — Expected: resolves, lockfile updated.

- [ ] **Step 2: Types**

`src/floating/types.ts`:
```ts
import type { CSSProperties } from "react";
import type { Placement } from "@floating-ui/react";

/** Options for {@link useAutocompleteFloating}. */
export type UseFloatingOptions = {
  /** Anchor placement. Default "bottom-start". */
  placement?: Placement;
  /** Gap (px) between input and dropdown. Default 4. */
  offset?: number;
  /** Viewport padding (px) for flip/shift/size. Default 8. */
  padding?: number;
  /** Match the dropdown width to the input. Default true. */
  matchWidth?: boolean;
  /** Dismiss when the user clicks outside. Default true. */
  dismissOnOutsideClick?: boolean;
  /** Close the dropdown when a selection is made (single-select). Default false. */
  closeOnSelect?: boolean;
};

/** Wiring returned by {@link useAutocompleteFloating}. */
export type AutocompleteFloating = {
  reference: (el: Element | null) => void;
  floating: (el: HTMLElement | null) => void;
  floatingStyles: CSSProperties;
  referenceProps: Record<string, unknown>;
  floatingProps: Record<string, unknown>;
};
```

- [ ] **Step 3: Failing test**

`src/floating/use-floating.test.tsx`:
```tsx
import { expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAutocompleteFloating } from "./use-floating";

function fakeApi(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    setOpen: mock(() => {}),
    selectedItems: [] as string[],
    getItemId: (item: string) => item,
    ...overrides,
  };
}

test("returns the floating wiring shape", () => {
  const api = fakeApi();
  const { result } = renderHook(() => useAutocompleteFloating(api as never));
  expect(typeof result.current.reference).toBe("function");
  expect(typeof result.current.floating).toBe("function");
  expect(result.current.floatingStyles).toBeDefined();
});

test("closeOnSelect closes when the selection changes to non-empty", () => {
  const api = fakeApi({ selectedItems: [] });
  const { rerender } = renderHook(
    ({ a }) => useAutocompleteFloating(a as never, { closeOnSelect: true }),
    { initialProps: { a: api } },
  );
  act(() => rerender({ a: fakeApi({ selectedItems: ["JFK"], setOpen: api.setOpen }) }));
  expect(api.setOpen).toHaveBeenCalledWith(false);
});

test("closeOnSelect:false leaves the dropdown open on selection", () => {
  const api = fakeApi({ selectedItems: [] });
  const { rerender } = renderHook(
    ({ a }) => useAutocompleteFloating(a as never, { closeOnSelect: false }),
    { initialProps: { a: api } },
  );
  act(() => rerender({ a: fakeApi({ selectedItems: ["JFK"], setOpen: api.setOpen }) }));
  expect(api.setOpen).not.toHaveBeenCalled();
});
```
Run: `bun test src/floating/use-floating.test.tsx` — Expected: FAIL (module missing).

- [ ] **Step 4: Implement the hook**

`src/floating/use-floating.ts`:
```ts
import {
  autoUpdate,
  flip,
  type Placement,
  offset as offsetMw,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { useEffect, useRef } from "react";
import type { AutocompleteVirtualApi } from "../core/use-autocomplete-virtual";
import type { AutocompleteFloating, UseFloatingOptions } from "./types";

/**
 * Opt-in floating behavior for a Combobulate combobox. Wraps Floating UI so the
 * dropdown anchors to the input, flips/shifts to stay on screen, and dismisses
 * on outside-click/Escape — driving the combo's own open state.
 */
export function useAutocompleteFloating<T>(
  api: AutocompleteVirtualApi<T>,
  options: UseFloatingOptions = {},
): AutocompleteFloating {
  const {
    placement = "bottom-start" as Placement,
    offset: offsetPx = 4,
    padding = 8,
    matchWidth = true,
    dismissOnOutsideClick = true,
    closeOnSelect = false,
  } = options;

  const { refs, floatingStyles, context } = useFloating({
    open: api.isOpen,
    onOpenChange: (open) => api.setOpen(open),
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offsetMw(offsetPx),
      flip({ padding }),
      shift({ padding }),
      size({
        padding,
        apply({ rects, elements, availableHeight }) {
          const style: Record<string, string> = { maxHeight: `${availableHeight}px` };
          if (matchWidth) style.width = `${rects.reference.width}px`;
          Object.assign(elements.floating.style, style);
        },
      }),
    ],
  });

  const dismiss = useDismiss(context, { outsidePress: dismissOnOutsideClick });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // Close on select (single-select): fire when the selection signature changes
  // to a non-empty value. Kept in the floating layer so the core stays untouched.
  const signature = api.selectedItems.map((item, i) => api.getItemId(item, i)).join("|");
  const prevSignature = useRef(signature);
  useEffect(() => {
    if (closeOnSelect && signature !== prevSignature.current && api.selectedItems.length > 0) {
      api.setOpen(false);
    }
    prevSignature.current = signature;
  }, [signature, closeOnSelect, api]);

  return {
    reference: refs.setReference,
    floating: refs.setFloating,
    floatingStyles,
    referenceProps: getReferenceProps(),
    floatingProps: getFloatingProps(),
  };
}
```
Run: `bun test src/floating/use-floating.test.tsx` — Expected: PASS. Then
`bun run typecheck` and `bunx biome check src/floating` — Expected: clean.

- [ ] **Step 5: Commit**
```bash
git add package.json bun.lock src/floating/types.ts src/floating/use-floating.ts src/floating/use-floating.test.tsx
git commit -m "feat(floating): useAutocompleteFloating hook on @floating-ui/react"
```

---

### Task 2: `Input` forwardRef + `Combobulate.Popover`

**Files:**
- Modify: `src/primitives/combobulate.tsx` (Input → forwardRef)
- Create: `src/floating/floating-primitives.tsx`, `src/floating/floating-primitives.test.tsx`

**Interfaces:**
- Consumes: `AutocompleteFloating` (Task 1), `useCombobulateContext`.
- Produces: `Popover<T>({ floating, children })` — a positioned container that
  renders `children` only when `api.isOpen`.

- [ ] **Step 1: Make `Input` forward its ref**

In `src/primitives/combobulate.tsx`, replace the `Input` function with a
`forwardRef` version (import `forwardRef` from react):
```tsx
const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const api = useCombobulateContext();
    return <input {...api.getInputProps()} {...props} ref={ref} />;
  },
);
```
Keep it in the exported `Combobulate` object as `Input`. (`ref` after `{...props}`
so the caller's ref wins; `getInputProps()` first so caller props can override.)

- [ ] **Step 2: Failing test**

`src/floating/floating-primitives.test.tsx`:
```tsx
import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "../primitives/combobulate";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Popover } from "./floating-primitives";
import { useAutocompleteFloating } from "./use-floating";

afterEach(() => cleanup());

function Demo({ open }: { open: boolean }) {
  const api = useAutocompleteVirtual({ items: ["Paris"], defaultOpen: open });
  const floating = useAutocompleteFloating(api);
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input ref={floating.reference} {...floating.referenceProps} />
      <Popover floating={floating}>
        <div data-testid="panel">panel</div>
      </Popover>
    </Combobulate.Root>
  );
}

test("Popover renders its children when open", () => {
  const restore = stubElementLayout();
  render(<Demo open={true} />);
  expect(screen.queryByTestId("panel")).not.toBeNull();
  restore();
});

test("Popover renders nothing when closed", () => {
  const restore = stubElementLayout();
  render(<Demo open={false} />);
  expect(screen.queryByTestId("panel")).toBeNull();
  restore();
});
```
Run: `bun test src/floating/floating-primitives.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement `Popover`**

`src/floating/floating-primitives.tsx`:
```tsx
import type { ReactNode } from "react";
import { useCombobulateContext } from "../primitives/context";
import type { AutocompleteFloating } from "./types";

/** Props for {@link Popover}. */
export type PopoverProps = {
  /** The value from `useAutocompleteFloating`. */
  floating: AutocompleteFloating;
  children: ReactNode;
};

/**
 * Positioned, self-dismissing dropdown container. Wrap `Combobulate.List` in it.
 * Renders nothing while the combobox is closed. The `size` middleware caps the
 * height, so it's a flex column and the inner list scrolls to fill it.
 */
export function Popover<T>({ floating, children }: PopoverProps) {
  const api = useCombobulateContext<T>();
  if (!api.isOpen) return null;
  return (
    <div
      ref={floating.floating}
      {...floating.floatingProps}
      style={{
        ...floating.floatingStyles,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
}
```
Run: `bun test src/floating/floating-primitives.test.tsx` — Expected: PASS.
Then `bun run typecheck` and `bunx biome check src/floating src/primitives` — clean.

- [ ] **Step 4: Commit**
```bash
git add src/primitives/combobulate.tsx src/floating/floating-primitives.tsx src/floating/floating-primitives.test.tsx
git commit -m "feat(floating): Combobulate.Popover + Input forwardRef"
```

---

### Task 3: Exports + presets default-on

**Files:**
- Modify: `src/index.ts`, `src/presets/autocomplete.tsx`,
  `src/presets/nested-autocomplete.tsx`
- Modify if needed: `src/presets/autocomplete.test.tsx`,
  `src/presets/nested-autocomplete.test.tsx`

**Interfaces:**
- Consumes: `useAutocompleteFloating`, `Popover`.
- Produces: `Combobulate.Popover` on the exported object; `useAutocompleteFloating`
  and floating types exported.

- [ ] **Step 1: Exports**

In `src/index.ts`: import `Popover` and add it to the augmented `Combobulate`
object (`{ ...CombobulateBase, Tree, TreeItem, AggregateCheckbox, Popover }`);
`export { useAutocompleteFloating } from "./floating/use-floating";` and
`export type { UseFloatingOptions, AutocompleteFloating } from "./floating/types";`.

- [ ] **Step 2: Autocomplete preset floats (single-select)**

In `src/presets/autocomplete.tsx`, call the floating hook and wire it. The list
must defer its height to the popover, so pass a `style` that drops the fixed
max-height and fills the flex parent:
```tsx
const api = useAutocompleteVirtual({ /* …unchanged… */ });
const floating = useAutocompleteFloating(api, { closeOnSelect: true });
return (
  <div className="cbl-root">
    <Combobulate.Root api={api}>
      <Combobulate.Input
        className="cbl-input"
        placeholder={placeholder}
        ref={floating.reference}
        {...floating.referenceProps}
      />
      <Combobulate.Popover floating={floating}>
        <Combobulate.List style={{ position: "static", maxHeight: "none", flex: "1 1 auto", minHeight: 0 }}>
          {(item: T, index: number) => (
            <Combobulate.Item item={item} index={index}>
              <div className="cbl-option">{renderItem(item)}</div>
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>
          <div className="cbl-empty">{emptyMessage}</div>
        </Combobulate.Empty>
      </Combobulate.Popover>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  </div>
);
```
(`LiveRegion` stays OUTSIDE the popover.)

- [ ] **Step 3: NestedAutocomplete preset floats**

Apply the same wiring in `src/presets/nested-autocomplete.tsx`: call
`useAutocompleteFloating(combo, { closeOnSelect: !multiple })`, add
`ref={floating.reference} {...floating.referenceProps}` to the `Combobulate.Input`,
and wrap the `<Tree>` in `<Combobulate.Popover floating={floating}>`. The `Tree`
is the scroll container, so give it the same fill style
(`style={{ position: "static", maxHeight: "none", flex: "1 1 auto", minHeight: 0 }}`
via its existing `style` prop).

- [ ] **Step 4: Fix preset tests if the structure change breaks them**

Run: `bun test src/presets` under `stubElementLayout` (already used there).
Existing tests query by role (`combobox`, `option`) which still resolve inside
the popover. If a test asserted list DOM structure directly, update it to the
popover-wrapped structure. Do NOT weaken assertions — keep them testing behavior.
Expected after any fixes: all preset tests pass.

- [ ] **Step 5: Verify + commit**

Run: `bun test`, `bun run typecheck`, `bun run build`, `bunx biome check .` — all clean.
```bash
git add src/index.ts src/presets
git commit -m "feat(floating): export layer; presets float + dismiss by default"
```

---

### Task 4: Playground — hero adopts Popover, retire manual positioning

**Files:**
- Modify: `examples/playground/src/sections/Hero.tsx`, `Hero.css`
- Modify if needed: `examples/playground/src/sections/AsyncTypeahead.tsx`

**Interfaces:** consumes `useAutocompleteFloating`, `Combobulate.Popover`.

- [ ] **Step 1: Hero uses the floating layer**

For each of the two `useAutocompleteVirtual` instances in `Hero.tsx`, call
`useAutocompleteFloating(api, { closeOnSelect: true })`, add
`ref={floating.reference} {...floating.referenceProps}` to the `Combobulate.Input`,
and wrap the `Combobulate.List` in `<Combobulate.Popover floating={floating}>`
with the fill style from Task 3. Remove the now-obsolete absolute/relative
dropdown-panel positioning rules from `Hero.css` (keep row/option/badge styling).

- [ ] **Step 2: Reconcile the async card**

The async card hid the in-flow listbox with `visibility:hidden` and rendered
skeletons beside it. With the preset now floating (Task 3), verify the loading
skeleton still reads correctly; adjust the skeleton container so it renders
inside/over the floating popover (or keep the current approach if it still shows
under the input). Do not regress the async e2e.

- [ ] **Step 3: Verify existing playground e2e still pass**

Run: `bun run e2e` — Expected: the 10 existing tests pass against the floating
dropdowns. Selectors that assumed an in-flow list may need updating (e.g.
`toBeInViewport` / scroll assumptions); update selectors, not the intent.

- [ ] **Step 4: Commit**
```bash
git commit -am "feat(playground): adopt the floating layer in the hero + presets"
```

---

### Task 5: Floating behavior e2e

**Files:** Create `e2e/floating.e2e.ts`.

- [ ] **Step 1: Failing e2e**

Target an existing floating section (e.g. `world` or `hero`):
```ts
import { expect, test } from "@playwright/test";

test("dropdown floats over content instead of pushing it down", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  const heading = world.getByRole("heading");
  const before = await heading.boundingBox();
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("a");
  await expect(world.getByRole("listbox")).toBeVisible();
  const after = await heading.boundingBox();
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0); // content did not shift
});

test("dropdown closes on outside click", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("a");
  await expect(world.getByRole("listbox")).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click(); // outside
  await expect(world.getByRole("listbox")).toBeHidden();
});

test("dropdown closes on Escape", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("a");
  await expect(world.getByRole("listbox")).toBeVisible();
  await world.getByRole("combobox").press("Escape");
  await expect(world.getByRole("listbox")).toBeHidden();
});

test("single-select closes the dropdown on pick", async ({ page }) => {
  await page.goto("/");
  const world = page.getByTestId("world");
  await world.getByRole("combobox").click();
  await world.getByRole("combobox").fill("london");
  await world.getByRole("option").first().click();
  await expect(world.getByRole("listbox")).toBeHidden();
});
```
Run: `bun run e2e floating` — Expected: FAIL before Tasks 3–4 land; PASS after.

- [ ] **Step 2: Make it pass** (already implemented by Tasks 3–4; adjust selectors/section to a real floating one if needed). Add a flip assertion if feasible (open a combobox near the viewport bottom — e.g. the `world` section — and assert the listbox top is above the input's top).

- [ ] **Step 3: Commit**
```bash
git commit -am "test(floating): e2e for float, dismiss, and close-on-select"
```

---

### Task 6: Docs + full pipeline

**Files:** `README.md`.

- [ ] **Step 1: README floating section**

After the "Nested tree" section, add a short "Floating dropdown" section: the
presets float + dismiss by default; for raw primitives, use
`useAutocompleteFloating` + `<Combobulate.Popover>` (show the ~8-line snippet
from the spec). Note `@floating-ui/react` is bundled only when the floating layer
is imported.

- [ ] **Step 2: Full pipeline**

Run: `bun run lint && bun run typecheck && bun test && bun run build && (cd examples/playground && bun run typecheck && bun run build) && bun run e2e`
Expected: biome clean, tsc clean, unit green (incl. new floating tests), builds
emit dist, e2e all pass (10 existing + new floating spec).

- [ ] **Step 3: Commit**
```bash
git commit -am "docs: document the floating layer"
```

---

## Self-Review

- **Spec coverage:** hook (T1), Popover + Input forwardRef (T2), exports +
  presets default-on + close-on-select (T1/T3), dep as direct (T1), playground
  incl. hero (T4), e2e for float/dismiss/close-on-select (T5), docs (T6). ✓
- **Placeholders:** library code is complete; playground/e2e give concrete
  code with selector-adjustment guidance (real layout only exists at e2e time).
  No `TODO`/`TBD`. ✓
- **Type consistency:** `AutocompleteFloating`/`UseFloatingOptions` defined in T1
  and consumed in T2–T4; `Popover` signature consistent; `reference`/`floating`
  ref-setter names stable across hook, Popover, and preset wiring. ✓
- **Boundary:** only `Input` changes in base primitives; `@floating-ui/react`
  imported solely under `src/floating/*`. ✓
