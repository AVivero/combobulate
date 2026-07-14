import { expect, test } from "bun:test";
import {
  defaultFilterItems,
  defaultGetSearchText,
  normalizeText,
  resolveItemId,
} from "./item-utils";

test("normalizeText lowercases and strips diacritics", () => {
  expect(normalizeText("Málaga")).toBe("malaga");
});

test("defaultGetSearchText reads string items directly", () => {
  expect(defaultGetSearchText("Paris")).toBe("Paris");
});

test("defaultGetSearchText reads a `label` field for objects", () => {
  expect(defaultGetSearchText({ label: "Paris", value: "PAR" })).toBe("Paris");
});

test("resolveItemId prefers getItemId, falls back to index", () => {
  expect(resolveItemId({ id: "x" }, 3, (i) => (i as { id: string }).id)).toBe("x");
  expect(resolveItemId("Paris", 3)).toBe("3");
});

test("defaultFilterItems matches normalized substring", () => {
  const items = ["Málaga", "Madrid", "Paris"];
  expect(defaultFilterItems(items, "ma", (s) => s)).toEqual(["Málaga", "Madrid"]);
});

test("defaultFilterItems returns all items for empty query", () => {
  const items = ["A", "B"];
  expect(defaultFilterItems(items, "", (s) => s)).toEqual(["A", "B"]);
});
