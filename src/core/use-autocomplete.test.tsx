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

test("select uses id-based identity for object items with getItemId, so a fresh equal reference toggles it off", () => {
  type City = { id: string; label: string };
  const a: City = { id: "a", label: "A" };
  const b: City = { id: "b", label: "B" };
  const { result } = renderHook(() =>
    useAutocomplete<City>({
      items: [a, b],
      multiple: true,
      getItemId: (item) => item.id,
      getSearchText: (item) => item.label,
    }),
  );

  act(() => result.current.select(a));
  expect(result.current.selectedItems).toEqual([a]);

  // A fresh object reference that is logically equal (same id) to `a`.
  const freshA: City = { id: "a", label: "A" };
  expect(freshA).not.toBe(a);

  // aria-selected must reflect id-based identity, not reference identity.
  expect(result.current.getItemProps(freshA, 0)["aria-selected"]).toBe(true);

  act(() => result.current.select(freshA));
  expect(result.current.selectedItems).toEqual([]);
  expect(result.current.getItemProps(freshA, 0)["aria-selected"]).toBe(false);
});

test("setSelectedItems replaces selection wholesale and fires onChange once", () => {
  let changed: unknown;
  let calls = 0;
  const { result } = renderHook(() =>
    useAutocomplete({
      items: ITEMS,
      multiple: true,
      onChange: (v) => {
        changed = v;
        calls += 1;
      },
    }),
  );
  act(() => result.current.setSelectedItems(["Paris", "Madrid"]));
  expect(result.current.selectedItems).toEqual(["Paris", "Madrid"]);
  expect(changed).toEqual(["Paris", "Madrid"]);
  expect(calls).toBe(1);
});

test("setSelectedItems clamps to single-select invariant", () => {
  let changed: unknown;
  let calls = 0;
  const { result } = renderHook(() =>
    useAutocomplete({
      items: ITEMS,
      multiple: false,
      onChange: (v) => {
        changed = v;
        calls += 1;
      },
    }),
  );
  act(() => result.current.setSelectedItems(["Paris", "Madrid"]));
  expect(result.current.selectedItems).toEqual(["Paris"]);
  expect(changed).toBe("Paris");
  expect(calls).toBe(1);
});

test("announcement reflects open/result/loading state", () => {
  const { result, rerender } = renderHook(
    ({ loading }: { loading: boolean }) => useAutocomplete({ items: ITEMS, loading }),
    { initialProps: { loading: false } },
  );
  expect(result.current.announcement).toBe(""); // closed
  act(() => result.current.open());
  expect(result.current.announcement).toBe("4 results");
  act(() => result.current.setInputValue("zzz"));
  expect(result.current.announcement).toBe("No results");
  rerender({ loading: true });
  expect(result.current.announcement).toBe("Loading…");
});

test("announcement uses singular phrasing for exactly one result", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => {
    result.current.open();
    result.current.setInputValue("berlin");
  });
  expect(result.current.announcement).toBe("1 result");
});
