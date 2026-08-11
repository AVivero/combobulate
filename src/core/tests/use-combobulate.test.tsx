import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { stubElementLayout } from "../../test-utils/stub-element-layout";
import type { CombobulateStoreInternal } from "../store";
import { useCombobulate } from "../use-combobulate";

/**
 * Hook-level tests. `useCombobulate` returns the store handle, so state is read
 * through `result.current.getState()` and driven through the store's imperative
 * methods. The pure store logic is also covered headlessly in `store.test.tsx`/
 * `committed-value.test.tsx`; these verify the hook wires it up correctly
 * (wrapped callbacks, the virtualizer, items/loading sync). The bridge's
 * "scroll an unmounted target into view, then highlight" half needs a real
 * scroll container, so highlight-on-open lands in `primitives.test.tsx`.
 */

let restore: () => void;
beforeAll(() => {
  restore = stubElementLayout();
});
afterAll(() => restore());

const ITEMS = ["Paris", "Madrid", "Berlin", "Málaga"];

test("filters with the normalized default filter", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS }));
  act(() => result.current.setInputValue("mala"));
  expect(result.current.getState().filteredItems).toEqual(["Málaga"]);
});

test("a custom filterItems overrides the default", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, filterItems: (items) => items.slice(0, 1) }),
  );
  act(() => result.current.setInputValue("zzz"));
  expect(result.current.getState().filteredItems).toEqual(["Paris"]);
});

test("single select replaces and reports the item", () => {
  const seen: unknown[] = [];
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, onChange: (v) => seen.push(v) }),
  );
  act(() => result.current.select("Paris"));
  act(() => result.current.select("Berlin"));
  expect(result.current.getState().selectedItems).toEqual(["Berlin"]);
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
  expect(result.current.getState().selectedItems).toEqual(["Paris", "Berlin"]);
  act(() => result.current.select("Paris"));
  expect(result.current.getState().selectedItems).toEqual(["Berlin"]);
  expect(result.current.isSelected("Berlin")).toBe(true);
});

test("itemValue is the id verbatim and maps back to the filtered index", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  const value = result.current.itemValue("Madrid");
  // Verbatim — not case-folded. It doubles as the Ariakit option id.
  expect(value).toBe("Madrid");
  act(() => result.current.setActiveValue(value));
  expect(result.current.getState().activeIndex).toBe(1);
});

test("ids differing only in case are distinct items, not a collision", () => {
  const { result } = renderHook(() => useCombobulate({ items: ["AB", "ab"], getItemId: (c) => c }));
  act(() => result.current.setActiveValue(result.current.itemValue("ab")));
  expect(result.current.getState().activeIndex).toBe(1);
  act(() => result.current.setActiveValue(result.current.itemValue("AB")));
  expect(result.current.getState().activeIndex).toBe(0);
});

test("activeIndex is -1 when the active value is not in the filtered list", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS }));
  act(() => result.current.setActiveValue("nope"));
  expect(result.current.getState().activeIndex).toBe(-1);
});

test("keep-visible: changing the active value scrolls that index into view", () => {
  const big = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
  const { result } = renderHook(() => useCombobulate({ items: big, defaultOpen: true }));
  const internal = result.current as CombobulateStoreInternal<string>;
  const virtualizer = internal._internal.virtualizer;
  if (!virtualizer) throw new Error("virtualizer not injected");

  const calls: number[] = [];
  virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof virtualizer.scrollToIndex;

  act(() => result.current.setActiveValue(result.current.itemValue("Item 500")));
  expect(calls).toContain(500);
});

test("keep-visible stays quiet while closed", () => {
  const big = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
  const { result } = renderHook(() => useCombobulate({ items: big }));
  const internal = result.current as CombobulateStoreInternal<string>;
  const virtualizer = internal._internal.virtualizer;
  if (!virtualizer) throw new Error("virtualizer not injected");

  const calls: number[] = [];
  virtualizer.scrollToIndex = ((i: number) => {
    calls.push(i);
  }) as typeof virtualizer.scrollToIndex;
  act(() => result.current.setActiveValue(result.current.itemValue("Item 500")));
  expect(calls).toEqual([]);
});

test("syncs changed items into the store", () => {
  const { result, rerender } = renderHook(
    ({ items }: { items: string[] }) => useCombobulate({ items, defaultOpen: true }),
    { initialProps: { items: ITEMS } },
  );
  expect(result.current.getState().filteredItems).toEqual(ITEMS);
  rerender({ items: ["Xanadu"] });
  expect(result.current.getState().filteredItems).toEqual(["Xanadu"]);
});

test("syncs changed loading into the store", () => {
  const { result, rerender } = renderHook(
    ({ loading }: { loading: boolean }) => useCombobulate({ items: ITEMS, loading }),
    { initialProps: { loading: false } },
  );
  expect(result.current.getState().loading).toBe(false);
  rerender({ loading: true });
  expect(result.current.getState().loading).toBe(true);
});

test("getInputValue: selecting fills the input with the item's label", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, getInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.getState().inputValue).toBe("Madrid");
});

test("getInputValue: fill does NOT fire onInputChange (typing does)", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      getInputValue: (c) => c,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // programmatic fill — no onInputChange
  expect(seen).toEqual([]);
  act(() => result.current.setInputValue("ber")); // user typing — fires
  expect(seen).toEqual(["ber"]);
});

test("getInputValue: while showing a selection, the full list is shown", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, getInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid" (a committed label)
  // "Madrid" would substring-filter to just Madrid, but showing-a-selection bypasses:
  expect(result.current.getState().filteredItems).toEqual(ITEMS);
});

test("getInputValue: typing after a pick filters normally (dirty)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, getInputValue: (c) => c }),
  );
  act(() => result.current.select("Madrid"));
  act(() => result.current.setInputValue("ber")); // now a search, not the committed label
  expect(result.current.getState().filteredItems).toEqual(["Berlin"]);
});

test("getInputValue is ignored in multi-select", () => {
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      multiple: true,
      getInputValue: (c) => c,
    }),
  );
  act(() => result.current.select("Madrid"));
  expect(result.current.getState().inputValue).toBe(""); // no fill; input stays a search box
  expect(result.current.getState().filteredItems).toEqual(ITEMS);
});

test("without getInputValue, selecting does not touch the input (regression guard)", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  act(() => result.current.select("Madrid"));
  expect(result.current.getState().inputValue).toBe("");
});

test("revert-on-close: a dirty search reverts to the committed selection without firing onInputChange", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      getInputValue: (c) => c,
      defaultOpen: true,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // programmatic fill — no onInputChange
  act(() => result.current.setInputValue("ber")); // user typing — fires onInputChange
  act(() => result.current.setOpen(false)); // dirty -> reverts to "Madrid" via RAW setter
  expect(result.current.getState().inputValue).toBe("Madrid"); // reverted
  // The revert must NOT fire onInputChange: only the user's "ber" keystroke did.
  expect(seen).toEqual(["ber"]);
});

test("revert-on-close: with nothing selected, an abandoned search clears", () => {
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      getInputValue: (c) => c,
      defaultOpen: true,
    }),
  );
  act(() => result.current.setInputValue("ber"));
  act(() => result.current.setOpen(false));
  expect(result.current.getState().inputValue).toBe(""); // committedValue is "" -> clears
});

test("revert-on-close: a clean input (just filled) is left untouched", () => {
  const seen: string[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      getInputValue: (c) => c,
      defaultOpen: true,
      onInputChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid" (clean, == committed)
  act(() => result.current.setOpen(false)); // not dirty -> no revert
  expect(result.current.getState().inputValue).toBe("Madrid");
  expect(seen).toEqual([]); // clean input: the revert branch does not run, input unchanged
});

test("revert-on-close does nothing without getInputValue (regression guard)", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, getItemId: (c) => c, defaultOpen: true }),
  );
  act(() => result.current.setInputValue("ber"));
  act(() => result.current.setOpen(false));
  expect(result.current.getState().inputValue).toBe("ber"); // untouched
});

test("opening a plain search does not force-highlight (regression guard)", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  act(() => result.current.setOpen(true));
  expect(result.current.getState().activeIndex).toBe(-1);
});

test("committed-value: clearing the input to empty clears the selection", () => {
  const seen: unknown[] = [];
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      getInputValue: (c) => c,
      onChange: (v) => seen.push(v),
    }),
  );
  act(() => result.current.select("Madrid")); // inputValue -> "Madrid", selected ["Madrid"]
  expect(result.current.getState().selectedItems).toEqual(["Madrid"]);
  act(() => result.current.setInputValue("")); // user backspaces the whole input
  expect(result.current.getState().selectedItems).toEqual([]); // selection cleared
  expect(seen).toEqual(["Madrid", null]); // select fired "Madrid", clear fired null
});

test("committed-value: clearing does nothing without getInputValue (regression guard)", () => {
  const { result } = renderHook(() => useCombobulate({ items: ITEMS, getItemId: (c) => c }));
  act(() => result.current.select("Madrid"));
  act(() => result.current.setInputValue(""));
  expect(result.current.getState().selectedItems).toEqual(["Madrid"]); // no model -> unchanged
});

test("committed-value: clearing does nothing in multi-select (regression guard)", () => {
  const { result } = renderHook(() =>
    useCombobulate({
      items: ITEMS,
      getItemId: (c) => c,
      multiple: true,
      getInputValue: (c) => c,
    }),
  );
  act(() => result.current.select("Paris"));
  act(() => result.current.select("Berlin"));
  act(() => result.current.setInputValue(""));
  expect(result.current.getState().selectedItems).toEqual(["Paris", "Berlin"]); // chips carry it
});

test("controlled: value is the source of truth; select requests then parent reflects", () => {
  const { result } = renderHook(() => {
    const [val, setVal] = useState<string | null>(null);
    const store = useCombobulate<string>({
      items: ITEMS,
      value: val,
      onChange: (v) => setVal(v as string | null),
    });
    return { store, val };
  });
  expect(result.current.store.getState().selectedItems).toEqual([]);
  act(() => result.current.store.select("Berlin"));
  expect(result.current.val).toBe("Berlin"); // onChange drove parent state
  expect(result.current.store.getState().selectedItems).toEqual(["Berlin"]); // reflected in
});

test("controlled: external value change (swap) updates the selection", () => {
  const { result } = renderHook(() => {
    const [val, setVal] = useState<string | null>("Paris");
    return { store: useCombobulate<string>({ items: ITEMS, value: val }), setVal };
  });
  expect(result.current.store.getState().selectedItems).toEqual(["Paris"]);
  act(() => result.current.setVal("Madrid"));
  expect(result.current.store.getState().selectedItems).toEqual(["Madrid"]);
});

test("controlled single-select with getInputValue pre-fills the committed input", () => {
  const { result } = renderHook(() =>
    useCombobulate({ items: ITEMS, value: "Paris", getInputValue: (c) => `City: ${c}` }),
  );
  expect(result.current.getState().inputValue).toBe("City: Paris");
});

test("controlled: combined value+items change (dependent list / swap) refreshes committed input", () => {
  const { result } = renderHook(() => {
    const [value, setValue] = useState<string | null>("Paris");
    const [excluded, setExcluded] = useState<string>("Berlin");
    const items = ITEMS.filter((c) => c !== excluded);
    const store = useCombobulate<string>({
      items,
      value,
      getItemId: (c) => c,
      getInputValue: (c) => `City: ${c}`,
    });
    const swap = () => {
      setValue("Berlin");
      setExcluded("Paris");
    };
    return { store, swap };
  });
  expect(result.current.store.getState().inputValue).toBe("City: Paris");
  act(() => result.current.swap());
  expect(result.current.store.getState().selectedItems).toEqual(["Berlin"]);
  expect(result.current.store.getState().inputValue).toBe("City: Berlin");
});
