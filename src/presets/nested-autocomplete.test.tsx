import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { NestedAutocomplete } from "./nested-autocomplete";

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
      { id: "orange", label: "Orange" },
    ],
  },
];

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

test("filtering a nested tree keeps the matched leaf with its ancestor", async () => {
  const user = userEvent.setup();
  render(
    <NestedAutocomplete
      nodes={TREE}
      getChildren={(n) => n.children}
      getItemId={(n) => n.id}
      getSearchText={(n) => n.label}
      placeholder="Food"
    />,
  );
  const input = screen.getByRole("combobox");
  await user.type(input, "orange");
  const labels = screen.getAllByRole("treeitem").map((el) => el.textContent);
  expect(labels).toEqual(["Fruit", "Orange"]); // ancestor kept, apple filtered out
});
