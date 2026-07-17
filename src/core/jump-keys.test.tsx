import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
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

// What THIS layer proves vs the e2e:
//
// The real fix for `aria-activedescendant` (a synthetic `pointermove` at the
// mounted target row, driving cmdk's own selection recompute — see
// use-combobulate.ts's onInputKeyDown) can only be exercised in a real browser
// with layout, so it lives in e2e/jump-keys.e2e.ts. These unit tests prove the
// remaining half: the jump MATH (End→999, Home→0, PageDown→10, PageUp clamp→0)
// and that `activeValue`/`activeIndex` land on the true target index over the
// full virtualized list.
//
// In this DOM-less environment there is no scroll container, so the handler's
// pointer path never fires; it falls through to its state-only commit, which
// runs on a later frame. `activeIndex` therefore settles asynchronously rather
// than within the same `act`, so these tests await it via `waitFor`. The
// asserted indices are unchanged. preventDefault/stopPropagation stay
// synchronous and are asserted as such.

test("End jumps to the true last item of the whole filtered list", async () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;

  const event = keyEvent("End");
  act(() => result.current.onInputKeyDown(event as never));

  expect(calls).toContain(999);
  expect(event.defaultPrevented).toBe(true);
  // cmdk binds End on the <Command> root; stopping propagation is what keeps
  // it from also moving the highlight to the last *mounted* row.
  expect(event.propagationStopped).toBe(true);

  await waitFor(() => expect(result.current.activeIndex).toBe(999));
});

test("Home jumps to the true first item", async () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  result.current.virtualizer.scrollToIndex =
    (() => {}) as typeof result.current.virtualizer.scrollToIndex;
  act(() => result.current.setActiveValue(result.current.itemValue("Item 500", 500)));
  act(() => result.current.onInputKeyDown(keyEvent("Home") as never));
  await waitFor(() => expect(result.current.activeIndex).toBe(0));
});

test("PageDown/PageUp move by a page and clamp at the ends", async () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  result.current.virtualizer.scrollToIndex =
    (() => {}) as typeof result.current.virtualizer.scrollToIndex;

  act(() => result.current.setActiveValue(result.current.itemValue("Item 0", 0)));
  act(() => result.current.onInputKeyDown(keyEvent("PageDown") as never));
  await waitFor(() => expect(result.current.activeIndex).toBe(10));

  act(() => result.current.onInputKeyDown(keyEvent("PageUp") as never));
  await waitFor(() => expect(result.current.activeIndex).toBe(0));

  act(() => result.current.onInputKeyDown(keyEvent("PageUp") as never));
  await waitFor(() => expect(result.current.activeIndex).toBe(0));
});

test("unhandled keys pass through untouched (cmdk keeps arrow nav)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
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
