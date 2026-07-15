import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./use-debounced-value";

test("returns value immediately when delay is 0", () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 0), {
    initialProps: { v: "a" },
  });
  rerender({ v: "b" });
  expect(result.current).toBe("b");
});

test("delays updates by the given delay", async () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 50), {
    initialProps: { v: "a" },
  });
  rerender({ v: "b" });
  expect(result.current).toBe("a");
  await act(() => new Promise((r) => setTimeout(r, 70)));
  expect(result.current).toBe("b");
});
