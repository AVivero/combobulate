import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Combobulate } from "./combobulate";

const ITEMS = ["Paris", "Madrid", "Berlin"];

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

function Demo() {
  const api = useAutocompleteVirtual({ items: ITEMS, defaultOpen: true });
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input aria-label="City" />
      <Combobulate.List>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {String(item)}
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.Empty>No results</Combobulate.Empty>
    </Combobulate.Root>
  );
}

test("renders an accessible combobox with option rows", () => {
  render(<Demo />);
  const input = screen.getByRole("combobox");
  expect(input.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
});

test("Empty renders its children when the open list has no matches", () => {
  render(<Demo />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "zzz-no-match-zzz" } });
  expect(screen.getByText("No results")).toBeTruthy();
  expect(screen.queryAllByRole("option").length).toBe(0);
});

test("primitives throw a guard error when used outside Combobulate.Root", () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    expect(() => render(<Combobulate.Input />)).toThrow(
      "Combobulate primitives must be used within <Combobulate.Root>",
    );
  } finally {
    console.error = originalConsoleError;
  }
});
