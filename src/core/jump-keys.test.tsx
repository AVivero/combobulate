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
function keyEvent(key: string, mod: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    ...mod,
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
// The jump MATH (End -> 999, Home -> 0, PageDown -> 10, PageUp clamp -> 0,
// Ctrl/Cmd-only Home/End ownership) is pure and already fully pinned by
// navigation.test.ts. What's left to prove here is the WIRING: a real
// keydown on this hook computes the right target via `nextIndex` and asks
// the virtualizer to scroll there, with preventDefault/stopPropagation set
// exactly on the keys combobulate owns.
//
// These tests call the hook directly (`renderHook`, no `<Combobulate.List>`
// rendered), so the virtualizer has no real scroll container and never
// reports a mounted window. The scroll-then-set bridge's other half — the
// target row actually mounting and `activeIndex` settling on it — can only
// be exercised with real layout, in e2e/jump-keys.e2e.ts.

test("Ctrl+End targets the true last item of the whole filtered list", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;

  const event = keyEvent("End", { ctrlKey: true });
  act(() => result.current.onInputKeyDown(event as never));

  expect(calls).toContain(999);
  expect(event.defaultPrevented).toBe(true);
  // combobulate owns Ctrl/Cmd+End; stopping propagation keeps cmdk's own
  // root-level Home/End handling from also moving the highlight.
  expect(event.propagationStopped).toBe(true);
});

test("Cmd+Home targets the true first item", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;
  act(() => result.current.setActiveValue(result.current.itemValue("Item 500", 500)));

  const event = keyEvent("Home", { metaKey: true });
  act(() => result.current.onInputKeyDown(event as never));

  expect(calls).toContain(0);
  expect(event.defaultPrevented).toBe(true);
});

test("bare Home/End are NOT owned (caret movement, not a jump)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const home = keyEvent("Home");
  act(() => result.current.onInputKeyDown(home as never));
  expect(home.defaultPrevented).toBe(false);

  const end = keyEvent("End");
  act(() => result.current.onInputKeyDown(end as never));
  expect(end.defaultPrevented).toBe(false);
});

test("PageDown/PageUp move by a page and clamp at the ends", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;
  act(() => result.current.setActiveValue(result.current.itemValue("Item 0", 0)));

  act(() => result.current.onInputKeyDown(keyEvent("PageDown") as never));
  expect(calls).toContain(10);

  act(() => result.current.onInputKeyDown(keyEvent("PageUp") as never));
  expect(calls).toContain(0);
});

test("ArrowDown/ArrowUp are combobulate-owned, not left to cmdk", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const event = keyEvent("ArrowDown");
  act(() => result.current.onInputKeyDown(event as never));
  expect(event.defaultPrevented).toBe(true);
  expect(event.propagationStopped).toBe(true);
});

test("unhandled (non-nav) keys pass through untouched", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: BIG, defaultOpen: true, getItemId: (i) => i }),
  );
  const event = keyEvent("a");
  act(() => result.current.onInputKeyDown(event as never));
  expect(event.defaultPrevented).toBe(false);
  expect(event.propagationStopped).toBe(false);
});

test("jump keys are inert on an empty list", () => {
  const { result } = renderHook(() => useCombobulate({ items: [], defaultOpen: true }));
  const event = keyEvent("End", { ctrlKey: true });
  act(() => result.current.onInputKeyDown(event as never));
  expect(event.defaultPrevented).toBe(false);
});
