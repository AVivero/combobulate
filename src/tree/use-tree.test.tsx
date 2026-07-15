import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTree } from "./use-tree";

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

const base = {
  nodes: TREE,
  getChildren: (n: Node) => n.children,
  getItemId: (n: Node) => n.id,
  getSearchText: (n: Node) => n.label,
};

test("collapsed by default shows only roots", () => {
  const { result } = renderHook(() => useTree(base));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg"]);
  expect(result.current.items.map((i) => i.id)).toEqual(["fruit", "veg"]);
});

test("expand reveals children; collapse hides them", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
  act(() => result.current.collapse("fruit"));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg"]);
  act(() => result.current.expand("fruit"));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
});

test("toggle flips expansion and notifies onExpandedChange", () => {
  let last: Set<string> | undefined;
  const { result } = renderHook(() =>
    useTree({
      ...base,
      onExpandedChange: (ids) => {
        last = ids;
      },
    }),
  );
  act(() => result.current.toggle("veg"));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg", "carrot"]);
  expect(last?.has("veg")).toBe(true);
});

test("successive expand calls in one batch are not lost", () => {
  const { result } = renderHook(() => useTree(base));
  act(() => {
    result.current.expand("fruit");
    result.current.expand("veg");
  });
  expect(result.current.expandedIds.has("fruit")).toBe(true);
  expect(result.current.expandedIds.has("veg")).toBe(true);
});

test("controlled expandedIds ignores internal toggle", () => {
  const { result } = renderHook(() => useTree({ ...base, expandedIds: ["fruit"] }));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
  act(() => result.current.collapse("fruit"));
  // controlled: no onExpandedChange handler updates the prop, so it stays expanded
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
});

test("query filters to matches plus ancestors and auto-expands", () => {
  const { result } = renderHook(() => useTree({ ...base, query: "orange" }));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "citrus", "orange"]);
});
