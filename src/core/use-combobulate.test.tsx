import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
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

test("select fires onChange once per call, even under StrictMode", () => {
  const seen: unknown[] = [];
  const { result } = renderHook(
    () => useCombobulate({ items: ITEMS, onChange: (v) => seen.push(v) }),
    { wrapper: StrictMode },
  );
  act(() => result.current.select("Paris"));
  expect(seen).toEqual(["Paris"]);
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

test("announcement is silent when closed, even while loading", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, defaultOpen: false, loading: true }),
  );
  expect(result.current.announcement).toBe("");
});

test("itemToInputValue: selecting fills the input with the item's label", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.inputValue).toBe("Madrid");
});

test("itemToInputValue: fill does NOT fire onInputChange (typing does)", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      itemToInputValue: (c) => c,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // programmatic fill — no onInputChange
  expect(seen).toEqual([]);
  act(() => result.current.setInputValue("ber")); // user typing — fires
  expect(seen).toEqual(["ber"]);
});

test("itemToInputValue: while showing a selection, the full list is shown", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid" (a committed label)
  // "Madrid" would substring-filter to just Madrid, but showing-a-selection bypasses:
  expect(result.current.filteredItems).toEqual(ITEMS);
});

test("itemToInputValue: typing after a pick filters normally (dirty)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, itemToInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  act(() => result.current.setInputValue("ber")); // now a search, not the committed label
  expect(result.current.filteredItems).toEqual(["Berlin"]);
});

test("itemToInputValue is ignored in multi-select", () => {
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      multiple: true,
      itemToInputValue: (c) => c,
    }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.inputValue).toBe(""); // no fill; input stays a search box
  expect(result.current.filteredItems).toEqual(ITEMS);
});

test("without itemToInputValue, selecting does not touch the input (regression guard)", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  act(() => result.current.select("Madrid"));
  expect(result.current.inputValue).toBe("");
});

test("revert-on-close: a dirty search reverts to the committed selection without firing onInputChange", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      itemToInputValue: (c) => c,
      defaultOpen: true,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // programmatic fill — no onInputChange
  act(() => result.current.setInputValue("ber")); // user typing — fires onInputChange
  act(() => result.current.setOpen(false)); // dirty -> reverts to "Madrid" via RAW setter
  expect(result.current.inputValue).toBe("Madrid"); // reverted
  // The revert must NOT fire onInputChange: only the user's "ber" keystroke did.
  expect(seen).toEqual(["ber"]);
});

test("revert-on-close: with nothing selected, an abandoned search clears", () => {
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      itemToInputValue: (c) => c,
      defaultOpen: true,
    }),
  );
  act(() => result.current.setInputValue("ber"));
  act(() => result.current.setOpen(false));
  expect(result.current.inputValue).toBe(""); // committedValue is "" -> clears
});

test("revert-on-close: a clean input (just filled) is left untouched", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      itemToInputValue: (c) => c,
      defaultOpen: true,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid" (clean, == committed)
  act(() => result.current.setOpen(false)); // not dirty -> no revert
  expect(result.current.inputValue).toBe("Madrid");
  expect(seen).toEqual([]); // clean input: the revert branch does not run, input unchanged
});

test("revert-on-close does nothing without itemToInputValue (regression guard)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, defaultOpen: true }),
  );
  act(() => result.current.setInputValue("ber"));
  act(() => result.current.setOpen(false));
  expect(result.current.inputValue).toBe("ber"); // untouched
});
