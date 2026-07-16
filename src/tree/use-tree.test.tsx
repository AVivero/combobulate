import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { useTree } from "./use-tree";

type Node = {
  id: string;
  label: string;
  children?: Node[];
};

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

function fakeCombo(rows: { id: string }[], activeIndex: number) {
  const calls: { setActiveIndex: number[]; coreKeys: string[] } = {
    setActiveIndex: [],
    coreKeys: [],
  };
  const combo = {
    activeIndex,
    setActiveIndex: (i: number) => calls.setActiveIndex.push(i),
    selectedItems: [] as unknown[],
    setSelectedItems: () => {},
    getInputProps: () => ({
      onKeyDown: (e: KeyboardEvent) => calls.coreKeys.push(e.key),
    }),
  };
  return { combo, calls };
}

function key(k: string): KeyboardEvent {
  let prevented = false;
  return {
    key: k,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent;
}

test("ArrowRight on a collapsed parent expands it", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: [] }));
  const { combo } = fakeCombo(result.current.rows, 0); // active = "fruit" (collapsed parent)
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowRight")));
  expect(result.current.rows.map((r) => r.id)).toContain("apple");
});

test("ArrowRight on an expanded parent moves into the first child", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  const { combo, calls } = fakeCombo(result.current.rows, 0); // active = "fruit" (expanded)
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowRight")));
  expect(calls.setActiveIndex).toEqual([1]);
});

test("ArrowLeft on an expanded parent collapses it", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  const { combo } = fakeCombo(result.current.rows, 0);
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowLeft")));
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "veg"]);
});

test("ArrowLeft on a child moves active to its parent index", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  // rows: fruit(0), apple(1), citrus(2), veg(3); active = apple(1), parent fruit(0)
  const { combo, calls } = fakeCombo(result.current.rows, 1);
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowLeft")));
  expect(calls.setActiveIndex).toEqual([0]);
});

test("non-arrow keys delegate to the core handler", () => {
  const { result } = renderHook(() => useTree(base));
  const { combo, calls } = fakeCombo(result.current.rows, 0);
  act(() => result.current.composeKeyDown(combo as never)(key("Enter")));
  expect(calls.coreKeys).toEqual(["Enter"]);
});

test("ArrowRight on a leaf row is inert (no expand, no move)", () => {
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: ["fruit"] }));
  // rows: fruit(0), apple(1), citrus(2), veg(3); active = apple(1), a leaf.
  const { combo, calls } = fakeCombo(result.current.rows, 1);
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowRight")));
  expect(calls.setActiveIndex).toEqual([]);
  expect(calls.coreKeys).toEqual([]);
  // rows unchanged — nothing expanded or collapsed.
  expect(result.current.rows.map((r) => r.id)).toEqual(["fruit", "apple", "citrus", "veg"]);
});

test("ArrowLeft on a collapsed root (no parent) is inert", () => {
  // active = "fruit": collapsed (so nothing to collapse) and parentId null (so
  // nowhere to move). Exercises the `parentId !== null` guard's false branch.
  const { result } = renderHook(() => useTree({ ...base, defaultExpandedIds: [] }));
  const { combo, calls } = fakeCombo(result.current.rows, 0);
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowLeft")));
  expect(calls.setActiveIndex).toEqual([]);
  expect(calls.coreKeys).toEqual([]);
});

test("out-of-range activeIndex delegates to the core handler", () => {
  const { result } = renderHook(() => useTree(base));
  const { combo, calls } = fakeCombo(result.current.rows, 99); // no such row
  act(() => result.current.composeKeyDown(combo as never)(key("ArrowRight")));
  // No row → tree nav is skipped and the key falls through to the core handler.
  expect(calls.coreKeys).toEqual(["ArrowRight"]);
  expect(calls.setActiveIndex).toEqual([]);
});

function selectionCombo(initial: Node[]) {
  const state = { selectedItems: initial };
  const combo = {
    activeIndex: -1,
    setActiveIndex: () => {},
    selectedItems: state.selectedItems,
    setSelectedItems: (next: Node[]) => {
      state.selectedItems = next;
      combo.selectedItems = next;
    },
    getInputProps: () => ({ onKeyDown: () => {} }),
  };
  return combo;
}

// Look up a fixture node by id, returning the same object reference that
// appears in TREE (avoids non-null assertions under noUncheckedIndexedAccess).
function findNode(nodes: Node[], id: string): Node | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function getNode(id: string): Node {
  const found = findNode(TREE, id);
  if (!found) throw new Error(`fixture node not found: ${id}`);
  return found;
}

const apple = getNode("apple");
const orange = getNode("orange");
const carrot = getNode("carrot");

test("getAggregateState reflects descendant-leaf selection", () => {
  const { result } = renderHook(() => useTree({ ...base, aggregateSelectAll: true }));
  const none = selectionCombo([]);
  expect(result.current.getAggregateState(none as never, "fruit")).toBe("unchecked");
  const some = selectionCombo([apple]);
  expect(result.current.getAggregateState(some as never, "fruit")).toBe("indeterminate");
  const all = selectionCombo([apple, orange]);
  expect(result.current.getAggregateState(all as never, "fruit")).toBe("checked");
});

test("toggleAllUnder adds all missing descendant leaves", () => {
  const { result } = renderHook(() => useTree({ ...base, aggregateSelectAll: true }));
  const combo = selectionCombo([]);
  act(() => result.current.toggleAllUnder(combo as never, "fruit"));
  expect(combo.selectedItems.map((n) => n.id).sort()).toEqual(["apple", "orange"]);
});

test("toggleAllUnder clears descendant leaves when already fully selected", () => {
  const { result } = renderHook(() => useTree({ ...base, aggregateSelectAll: true }));
  const combo = selectionCombo([apple, orange, carrot]);
  act(() => result.current.toggleAllUnder(combo as never, "fruit"));
  // fruit's leaves removed; carrot (under veg) untouched
  expect(combo.selectedItems.map((n) => n.id)).toEqual(["carrot"]);
});
