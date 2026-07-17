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
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, onChange: (v) => seen.push(v) }),
  );
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
  const { result } = renderHook(() => useCombobulate({ items: ["AB", "ab"], getItemId: (c) => c }));
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
    ({ loading }: { loading: boolean }) =>
      useCombobulate({ items: ITEMS, defaultOpen: true, loading }),
    { initialProps: { loading: true } },
  );
  expect(result.current.announcement).toBe("Loading…");
  rerender({ loading: false });
  act(() => result.current.setInputValue("zzz"));
  expect(result.current.announcement).toBe("No results");
  act(() => result.current.setInputValue("par"));
  expect(result.current.announcement).toBe("1 result");
});
