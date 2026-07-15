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
