import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createCombobulateStore } from "./store";

afterEach(() => cleanup());

const ITEMS = ["Paris", "Madrid", "Berlin"];

test("store: open state round-trips", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.getState().isOpen).toBe(false);
  act(() => store.setOpen(true));
  expect(store.getState().isOpen).toBe(true);
});

test("store: select updates selectedItems and isSelected (single)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.select("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
  expect(store.isSelected("Berlin")).toBe(true);
  act(() => store.select("Paris")); // single-select replaces
  expect(store.getState().selectedItems).toEqual(["Paris"]);
});

test("store: multiple toggles membership", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, multiple: true });
  act(() => store.select("Paris"));
  act(() => store.select("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Paris", "Berlin"]);
  act(() => store.select("Paris"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
});

test("store: itemValue is the id verbatim; activeIndex maps back", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.itemValue("Madrid", 1)).toBe("Madrid");
  act(() => store.setActiveValue("Madrid"));
  expect(store.getState().activeIndex).toBe(1);
});
