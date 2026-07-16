import { expect, test } from "bun:test";
import {
  collectAncestorIds,
  collectDescendantLeafIds,
  computeVisibleRows,
  flattenTree,
} from "./tree-utils";

interface Node {
  id: string;
  label: string;
  children?: Node[];
}

const TREE: Node[] = [
  {
    id: "fruit",
    label: "Fruit",
    children: [
      { id: "apple", label: "Apple" },
      { id: "citrus", label: "Citrus", children: [{ id: "orange", label: "Orange" }] },
    ],
  },
  { id: "veg", label: "Vegetable", children: [{ id: "carrot", label: "Carrot" }] },
];

const getChildren = (n: Node) => n.children;
const getItemId = (n: Node) => n.id;
const getSearchText = (n: Node) => n.label;

test("flattenTree walks depth-first with depth/parentId/hasChildren", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  expect(flat.map((f) => f.id)).toEqual(["fruit", "apple", "citrus", "orange", "veg", "carrot"]);
  // biome-ignore lint/style/noNonNullAssertion: fixture guarantees a match; assigning to a variable precludes optional chaining
  const orange = flat.find((f) => f.id === "orange")!;
  expect(orange.depth).toBe(2);
  expect(orange.parentId).toBe("citrus");
  expect(orange.hasChildren).toBe(false);
  expect(flat.find((f) => f.id === "citrus")?.hasChildren).toBe(true);
});

test("collectAncestorIds returns all ancestors of the given ids", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  expect([...collectAncestorIds(flat, new Set(["orange"]))].sort()).toEqual(["citrus", "fruit"]);
});

test("collectDescendantLeafIds returns only leaf descendants", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  expect(collectDescendantLeafIds(flat, "fruit").sort()).toEqual(["apple", "orange"]);
});

test("computeVisibleRows hides collapsed subtrees (no query)", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  const rows = computeVisibleRows(flat, new Set(["fruit"]), "", getSearchText);
  // fruit expanded → apple, citrus visible; citrus collapsed → orange hidden; veg collapsed
  expect(rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
  expect(rows.find((r) => r.id === "fruit")?.expanded).toBe(true);
  expect(rows.find((r) => r.id === "citrus")?.expanded).toBe(false);
});

test("computeVisibleRows keeps matches plus ancestors and auto-expands", () => {
  const flat = flattenTree(TREE, getChildren, getItemId);
  const rows = computeVisibleRows(flat, new Set(), "orange", getSearchText);
  expect(rows.map((r) => r.id)).toEqual(["fruit", "citrus", "orange"]);
  expect(rows.find((r) => r.id === "citrus")?.expanded).toBe(true); // ancestor force-expanded
});
