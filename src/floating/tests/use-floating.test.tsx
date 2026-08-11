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
 * Regression for the audit's M1 finding: `closeOnSelect` must fire on EVERY real
 * selection change — including a single-select re-pick of a *different* item with
 * no `getItemId`, where the selection array's length never changes. A prior
 * version diffed a recomputed "signature" string that collapsed to a constant in
 * that case and stopped closing after the first pick; diffing the store's own
 * `selectedItems` array reference keeps it closing every time.
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
