import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { createCombobulateStore } from "../../core/store";
import { useCombobulateFloating } from "../use-floating";

test("returns the floating wiring shape", () => {
  const store = createCombobulateStore({ items: ["Paris"] });
  const { result } = renderHook(() => useCombobulateFloating(store));
  expect(typeof result.current.reference).toBe("function");
  expect(typeof result.current.floating).toBe("function");
  expect(result.current.floatingStyles).toBeDefined();
  expect(result.current.referenceProps).toBeDefined();
  expect(result.current.floatingProps).toBeDefined();
});

test("closeOnSelect closes the dropdown when a selection is made", () => {
  const store = createCombobulateStore({ items: ["JFK", "LAX"], defaultOpen: true });
  renderHook(() => useCombobulateFloating(store, { closeOnSelect: true }));
  expect(store.getState().isOpen).toBe(true);
  act(() => store.select("JFK"));
  expect(store.getState().isOpen).toBe(false);
});

/**
 * Regression for the audit's M1 finding. Without a `getItemId`, `itemValue`
 * falls back to the item's positional index. A prior version built the
 * close-on-select signature from `store.itemValue(item, i)` where `i` was the
 * item's position *within `selectedItems`* — always `0` for single-select —
 * so the signature stayed the literal string `"0"` across a re-pick and
 * `closeOnSelect` silently stopped firing after the first selection. Diffing
 * the store's own `selectedItems` array reference (which changes on every
 * real selection change, re-pick included) must keep closing every time.
 */
test("closeOnSelect fires again on re-picking a different item with no getItemId", () => {
  const store = createCombobulateStore({ items: ["JFK", "LAX"], defaultOpen: true });
  renderHook(() => useCombobulateFloating(store, { closeOnSelect: true }));
  act(() => store.select("JFK"));
  expect(store.getState().isOpen).toBe(false);
  act(() => store.setOpen(true));
  act(() => store.select("LAX"));
  expect(store.getState().isOpen).toBe(false);
});

test("closeOnSelect:false leaves the dropdown open on selection", () => {
  const store = createCombobulateStore({ items: ["JFK", "LAX"], defaultOpen: true });
  renderHook(() => useCombobulateFloating(store, { closeOnSelect: false }));
  act(() => store.select("JFK"));
  expect(store.getState().isOpen).toBe(true);
});

test("closeOnSelect does not fire spuriously on unrelated re-renders", () => {
  const store = createCombobulateStore({ items: ["JFK", "LAX"], defaultOpen: true });
  const { rerender } = renderHook(
    ({ closeOnSelect }) => useCombobulateFloating(store, { closeOnSelect }),
    { initialProps: { closeOnSelect: true } },
  );
  // Re-render repeatedly with no selection change — the selected-items
  // reference never changes, so this must not close the dropdown.
  act(() => rerender({ closeOnSelect: true }));
  act(() => rerender({ closeOnSelect: true }));
  expect(store.getState().isOpen).toBe(true);
});
