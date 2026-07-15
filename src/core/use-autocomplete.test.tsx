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
    useAutocomplete({
      items: ITEMS,
      onChange: (v) => {
        changed = v;
      },
    }),
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

test("debounce delays filtering", async () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS, debounce: 50 }));
  act(() => result.current.setInputValue("ma"));
  expect(result.current.filteredItems.length).toBe(ITEMS.length);
  await act(() => new Promise((r) => setTimeout(r, 70)));
  expect(result.current.filteredItems).toEqual(["Madrid", "Málaga"]);
});
