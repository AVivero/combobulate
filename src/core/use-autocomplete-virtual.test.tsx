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
  const { result } = renderHook(() =>
    useAutocompleteVirtual({ items: ITEMS, estimateSize: () => 32 }),
  );

  // Replace scrollToIndex with a recording spy that does not call through to
  // the real implementation (happy-dom has no real scroll element, so the
  // original can throw).
  const calls: number[] = [];
  result.current.virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof result.current.virtualizer.scrollToIndex;

  act(() => {
    result.current.open();
  });
  act(() => {
    result.current.setActiveIndex(500);
  });

  expect(calls).toContain(500);
});

test("bridge stays quiet when closed or when nothing is highlighted", () => {
  // Case 1: opening while nothing is highlighted (activeIndex === -1) must not
  // scroll — this is exactly what the `activeIndex >= 0` guard protects against.
  const a = renderHook(() => useAutocompleteVirtual({ items: ITEMS, estimateSize: () => 32 }));
  const callsA: number[] = [];
  a.result.current.virtualizer.scrollToIndex = ((i: number) => {
    callsA.push(i);
  }) as typeof a.result.current.virtualizer.scrollToIndex;
  act(() => {
    a.result.current.open();
  });
  expect(callsA).toEqual([]);

  // Case 2: navigating while the list is closed must not scroll.
  const b = renderHook(() => useAutocompleteVirtual({ items: ITEMS, estimateSize: () => 32 }));
  const callsB: number[] = [];
  b.result.current.virtualizer.scrollToIndex = ((i: number) => {
    callsB.push(i);
  }) as typeof b.result.current.virtualizer.scrollToIndex;
  act(() => {
    b.result.current.setActiveIndex(300);
  });
  expect(callsB).toEqual([]);
});
