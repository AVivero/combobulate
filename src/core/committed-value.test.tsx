import { afterEach, expect, test } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { createCombobulateStore } from "./store";

afterEach(() => cleanup());
const ITEMS = ["Paris", "Madrid", "Berlin", "Málaga"];

test("default filter is a normalized substring includes", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.setInputValue("mala"));
  expect(store.getState().filteredItems).toEqual(["Málaga"]);
});

test("committed selection bypasses the filter (shows all)", () => {
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    itemToInputValue: (c) => c,
  });
  act(() => store.select("Berlin")); // input becomes "Berlin"
  expect(store.getState().inputValue).toBe("Berlin");
  expect(store.getState().filteredItems).toEqual(ITEMS); // not filtered to just "Berlin"
});

test("clearing the input to empty unselects (committed-value, single)", () => {
  const seen: unknown[] = [];
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    itemToInputValue: (c) => c,
    onChange: (v) => seen.push(v),
  });
  act(() => store.select("Berlin"));
  act(() => store.setInputValue(""));
  expect(store.getState().selectedItems).toEqual([]);
  expect(seen).toEqual(["Berlin", null]);
});

test("revert-on-close restores the committed value", () => {
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    itemToInputValue: (c) => c,
  });
  act(() => store.select("Berlin"));
  act(() => store.setInputValue("par")); // start typing a new query
  act(() => store.setOpen(false)); // close without choosing
  expect(store.getState().inputValue).toBe("Berlin");
});
