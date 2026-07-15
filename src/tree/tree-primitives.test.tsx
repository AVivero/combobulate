import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "../primitives/combobulate";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { AggregateCheckbox, Tree, TreeItem } from "./tree-primitives";
import { useTree } from "./use-tree";

// See `stubElementLayout` for why virtualized lists need this under
// happy-dom. Installed for the lifetime of this file's tests only (via
// `beforeAll`/`afterAll`) so no other test file is affected by the stub.
let restoreElementLayout: () => void;

beforeAll(() => {
  restoreElementLayout = stubElementLayout();
});

afterAll(() => {
  restoreElementLayout();
});

// `@testing-library/react`'s built-in auto-cleanup only registers itself
// against a global `afterEach`, which Bun's test runner does not expose
// unless imported. Without it, `render()` calls across tests in this file
// would accumulate in `document.body` and break `screen`-scoped queries.
afterEach(() => {
  cleanup();
});

interface Node {
  id: string;
  label: string;
  children?: Node[];
}
const TREE: Node[] = [{ id: "fruit", label: "Fruit", children: [{ id: "apple", label: "Apple" }] }];

function Demo() {
  const tree = useTree({
    nodes: TREE,
    getChildren: (n) => n.children,
    getItemId: (n) => n.id,
    getSearchText: (n) => n.label,
    defaultExpandedIds: ["fruit"],
    aggregateSelectAll: true,
  });
  const combo = useAutocompleteVirtual({
    items: tree.items,
    getItemId: (n: Node) => n.id,
    filterItems: (items) => items,
    multiple: true,
    defaultOpen: true,
  });
  return (
    <Combobulate.Root api={combo}>
      <Combobulate.Input aria-label="Food" />
      <Tree tree={tree}>
        {(item: Node, index: number) => (
          <TreeItem item={item} index={index}>
            {item.children ? <AggregateCheckbox nodeId={item.id} /> : null}
            <span>{item.label}</span>
          </TreeItem>
        )}
      </Tree>
    </Combobulate.Root>
  );
}

test("renders role=tree with treeitems carrying aria-level and data-depth", () => {
  render(<Demo />);
  expect(screen.getByRole("tree")).toBeDefined();
  const items = screen.getAllByRole("treeitem");
  expect(items.length).toBeGreaterThan(0);
  const [fruit] = items;
  if (!fruit) throw new Error("expected at least one treeitem");
  expect(fruit.getAttribute("aria-level")).toBe("1");
  expect(fruit.getAttribute("aria-expanded")).toBe("true");
  expect(fruit.getAttribute("data-depth")).toBe("0");
});

test("aggregate checkbox exposes a tri-state role=checkbox", () => {
  render(<Demo />);
  const checkbox = screen.getByRole("checkbox");
  expect(checkbox.getAttribute("aria-checked")).toBe("false"); // nothing selected yet
});
