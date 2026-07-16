import { afterAll, afterEach, beforeAll, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { KeyboardEvent } from "react";
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
      <Combobulate.LiveRegion />
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
  // `selector: "output"` disambiguates from the live region, which now also
  // renders "No results" as its announcement for the same filtered state.
  expect(screen.getByText("No results", { selector: "output" })).toBeTruthy();
  expect(screen.queryAllByRole("option").length).toBe(0);
});

test("LiveRegion renders the announcement in a polite status region", () => {
  render(<Demo />);
  const region = screen.getByRole("status");
  expect(region.getAttribute("aria-live")).toBe("polite");
  expect(region.textContent).toBe("3 results"); // Demo has 3 items, defaultOpen
});

/**
 * Mirrors the documented floating-layer usage
 * (`ref={floating.reference} {...floating.referenceProps}` on
 * `Combobulate.Input`), where a consumer-supplied `onKeyDown` (e.g. Floating
 * UI's own Escape-to-dismiss handler) must augment — not replace — the
 * combobox's own arrow-key/Enter navigation.
 */
function DemoWithConsumerKeyDown({
  onKeyDown,
}: {
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const api = useAutocompleteVirtual({ items: ITEMS, defaultOpen: true });
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input aria-label="City" onKeyDown={onKeyDown} />
      <Combobulate.List>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {String(item)}
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  );
}

test("Input composes a consumer onKeyDown with the combobox's own arrow-key navigation instead of overwriting it", () => {
  const consumerOnKeyDown = mock(() => {});
  render(<DemoWithConsumerKeyDown onKeyDown={consumerOnKeyDown} />);
  const input = screen.getByRole("combobox");
  const before = input.getAttribute("aria-activedescendant");

  fireEvent.keyDown(input, { key: "ArrowDown" });

  // The combo's own navigation still ran: the active descendant moved.
  const after = input.getAttribute("aria-activedescendant");
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);
  // ...and the consumer's handler was also invoked, not clobbered.
  expect(consumerOnKeyDown).toHaveBeenCalledTimes(1);
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
