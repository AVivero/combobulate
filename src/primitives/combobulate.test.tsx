import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAutocompleteVirtual } from "../core/use-autocomplete-virtual";
import { Combobulate } from "./combobulate";

const ITEMS = ["Paris", "Madrid", "Berlin"];

// happy-dom has no real layout engine: every element reports 0 for
// offsetWidth/offsetHeight (and getBoundingClientRect), regardless of CSS.
// TanStack Virtual's `calculateRange` treats a zero-size scroll container as
// "nothing is visible" and short-circuits to an empty range, so any test in
// this file that renders a virtualized list would otherwise see zero rows no
// matter how many items are provided. Stub non-zero dimensions on
// `HTMLElement.prototype` for the lifetime of this file's tests only (via
// `beforeAll`/`afterAll`), restoring the original descriptors afterward so
// no other test file is affected by the stub.
const STUBBED_ELEMENT_SIZE_PX = 300;

let originalOffsetHeight: PropertyDescriptor | undefined;
let originalOffsetWidth: PropertyDescriptor | undefined;

beforeAll(() => {
  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return STUBBED_ELEMENT_SIZE_PX;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return STUBBED_ELEMENT_SIZE_PX;
    },
  });
});

afterAll(() => {
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
  }
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
  }
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
