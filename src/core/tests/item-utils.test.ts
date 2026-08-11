import { expect, test } from "bun:test";
import { defaultFilterItems, defaultGetSearchText, normalizeText } from "../item-utils";

test("normalizeText lowercases and strips diacritics", () => {
  expect(normalizeText("Málaga")).toBe("malaga");
});

test("defaultGetSearchText reads string items directly", () => {
  expect(defaultGetSearchText("Paris")).toBe("Paris");
});

test("defaultGetSearchText reads a `label` field for objects", () => {
  expect(defaultGetSearchText({ label: "Paris", value: "PAR" })).toBe("Paris");
});

test("defaultFilterItems matches normalized substring", () => {
  const items = ["Málaga", "Madrid", "Paris"];
  expect(defaultFilterItems(items, "ma", (s) => s)).toEqual(["Málaga", "Madrid"]);
});

test("defaultFilterItems returns all items for empty query", () => {
  const items = ["A", "B"];
  expect(defaultFilterItems(items, "", (s) => s)).toEqual(["A", "B"]);
});

test("defaultFilterItems returns all items for a whitespace-only query", () => {
  const items = ["A", "B"];
  expect(defaultFilterItems(items, "   ", (s) => s)).toEqual(["A", "B"]);
});
