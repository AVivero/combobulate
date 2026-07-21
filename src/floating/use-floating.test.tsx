import { expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAutocompleteFloating } from "./use-floating";

function fakeApi(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    setOpen: mock(() => {}),
    selectedItems: [] as string[],
    itemValue: (item: string) => item,
    ...overrides,
  };
}

test("returns the floating wiring shape", () => {
  const api = fakeApi();
  const { result } = renderHook(() => useAutocompleteFloating(api as never));
  expect(typeof result.current.reference).toBe("function");
  expect(typeof result.current.floating).toBe("function");
  expect(result.current.floatingStyles).toBeDefined();
});

test("closeOnSelect closes when the selection changes to non-empty", () => {
  const api = fakeApi({ selectedItems: [] });
  const { rerender } = renderHook(
    ({ a }) => useAutocompleteFloating(a as never, { closeOnSelect: true }),
    { initialProps: { a: api } },
  );
  act(() => rerender({ a: fakeApi({ selectedItems: ["JFK"], setOpen: api.setOpen }) }));
  expect(api.setOpen).toHaveBeenCalledWith(false);
});

test("closeOnSelect:false leaves the dropdown open on selection", () => {
  const api = fakeApi({ selectedItems: [] });
  const { rerender } = renderHook(
    ({ a }) => useAutocompleteFloating(a as never, { closeOnSelect: false }),
    { initialProps: { a: api } },
  );
  act(() => rerender({ a: fakeApi({ selectedItems: ["JFK"], setOpen: api.setOpen }) }));
  expect(api.setOpen).not.toHaveBeenCalled();
});
