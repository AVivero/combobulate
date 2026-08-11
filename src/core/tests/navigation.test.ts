import { expect, test } from "bun:test";
import { nextIndex } from "../navigation";

const K = (key: string, mod: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  ...mod,
});

test("ArrowDown moves +1 and clamps at the end", () => {
  expect(nextIndex(0, K("ArrowDown"), { count: 3, page: 10 })).toBe(1);
  expect(nextIndex(2, K("ArrowDown"), { count: 3, page: 10 })).toBe(2);
});
test("ArrowDown from -1 goes to first", () => {
  expect(nextIndex(-1, K("ArrowDown"), { count: 3, page: 10 })).toBe(0);
});
test("ArrowUp moves -1 and clamps at the start", () => {
  expect(nextIndex(5, K("ArrowUp"), { count: 100, page: 10 })).toBe(4);
  expect(nextIndex(0, K("ArrowUp"), { count: 100, page: 10 })).toBe(0);
  // -1 (nothing active) clamps the same as 0: Math.max(0, -1 - 1) -> 0.
  expect(nextIndex(-1, K("ArrowUp"), { count: 100, page: 10 })).toBe(0);
});
test("PageDown/PageUp move by page, clamped", () => {
  expect(nextIndex(0, K("PageDown"), { count: 100, page: 10 })).toBe(10);
  expect(nextIndex(5, K("PageUp"), { count: 100, page: 10 })).toBe(0);
});
test("Ctrl/Cmd+Home/End jump to first/last", () => {
  expect(nextIndex(50, K("End", { ctrlKey: true }), { count: 100, page: 10 })).toBe(99);
  expect(nextIndex(50, K("Home", { metaKey: true }), { count: 100, page: 10 })).toBe(0);
});
test("bare Home/End are NOT owned (caret) -> null", () => {
  expect(nextIndex(50, K("Home"), { count: 100, page: 10 })).toBeNull();
  expect(nextIndex(50, K("End"), { count: 100, page: 10 })).toBeNull();
});
test("non-nav keys -> null", () => {
  expect(nextIndex(0, K("a"), { count: 3, page: 10 })).toBeNull();
});
test("an empty list owns nothing, even Ctrl/Cmd+Home/End", () => {
  expect(nextIndex(-1, K("End", { ctrlKey: true }), { count: 0, page: 10 })).toBeNull();
  expect(nextIndex(-1, K("ArrowDown"), { count: 0, page: 10 })).toBeNull();
});
