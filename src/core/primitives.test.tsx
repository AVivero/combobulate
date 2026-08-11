import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Combobulate } from "./primitives";
import { useCombobulate } from "./use-combobulate";

let restore: () => void;
beforeAll(() => {
  restore = stubElementLayout();
});
afterAll(() => restore());
afterEach(() => cleanup());

const BIG = Array.from({ length: 500 }, (_, i) => `Item ${i}`);

function Harness({ items = BIG, multiple = false }: { items?: string[]; multiple?: boolean }) {
  const store = useCombobulate({ items, defaultOpen: true, multiple, getItemId: (i) => i });
  return (
    <Combobulate store={store}>
      <Combobulate.Input aria-label="Search" />
      {/* Explicit type argument: `List`'s only prop is the render-prop callback,
          so there's nothing else in the JSX call for TS to infer `T` from
          (it would otherwise default to `unknown`, which then fails to
          satisfy `ReactNode` where `item` is rendered below). */}
      <Combobulate.List<string>>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {item}
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.Empty>No results</Combobulate.Empty>
      <Combobulate.LiveRegion />
    </Combobulate>
  );
}

test("virtualizes: mounts a window, not all 500 items", () => {
  render(<Harness />);
  const options = screen.getAllByRole("option");
  expect(options.length).toBeGreaterThan(0);
  expect(options.length).toBeLessThan(100);
});

test("options carry full-list aria-setsize and absolute aria-posinset", () => {
  render(<Harness />);
  const first = screen.getAllByRole("option")[0];
  expect(first?.getAttribute("aria-setsize")).toBe("500");
  expect(first?.getAttribute("aria-posinset")).toBe("1");
});

test("multi-select marks chosen state with aria-checked, single-select does not", () => {
  // Fresh renders (not `rerender`): `multiple` is a creation-time option of the
  // store, so it can't be flipped on an existing hook instance.
  const multi = render(<Harness multiple />);
  expect(screen.getAllByRole("option")[0]?.getAttribute("aria-checked")).toBe("false");
  multi.unmount();
  render(<Harness />);
  expect(screen.getAllByRole("option")[0]?.getAttribute("aria-checked")).toBeNull();
});

test("Empty renders only when nothing matches", () => {
  render(<Harness items={[]} />);
  // `LiveRegion`'s announcement is also the literal string "No results" when
  // `filteredItems` is empty, so an unscoped `getByText` still matches both
  // elements by *text*. That's expected and fine — `Empty` scopes to its own
  // tag (a plain `<div>`, no role) rather than a competing `role="status"`.
  screen.getByText("No results", { selector: "div" });
  // The real point: `Empty` must not introduce a second `role="status"`
  // element. `LiveRegion` remains the sole one.
  expect(screen.getAllByRole("status")).toHaveLength(1);
});

test("LiveRegion announces the result count", () => {
  render(<Harness items={["Paris"]} />);
  expect(screen.getByRole("status").textContent).toBe("1 result");
});

test("focus-out (blur to another control) closes the popup", () => {
  render(
    <>
      <Harness items={["Paris", "Berlin"]} />
      <button type="button">outside</button>
    </>,
  );
  expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  const input = screen.getByRole("combobox");
  const outside = screen.getByRole("button", { name: "outside" });
  fireEvent.blur(input, { relatedTarget: outside });
  expect(screen.queryAllByRole("option")).toHaveLength(0);
});

test("LiveRegion debounces count changes rather than flooding on each keystroke", async () => {
  render(<Harness items={["Paris", "Madrid", "Berlin"]} />);
  const status = screen.getByRole("status");
  // Mount shows the current count immediately.
  expect(status.textContent).toBe("3 results");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "par" } });
  // Synchronously the region still holds the old count — the new one is debounced.
  expect(status.textContent).toBe("3 results");
  // It coalesces to the settled count.
  await waitFor(() => expect(status.textContent).toBe("1 result"));
});

test("aria-expanded tracks open state", () => {
  render(<Harness items={["Paris", "Berlin"]} />);
  const input = screen.getByRole("combobox");
  expect(input.getAttribute("aria-expanded")).toBe("true"); // defaultOpen
  fireEvent.blur(input, { relatedTarget: document.body });
  expect(input.getAttribute("aria-expanded")).toBe("false");
});

function LiveHarness({
  items,
  loading = false,
  open = true,
}: {
  items: string[];
  loading?: boolean;
  open?: boolean;
}) {
  const store = useCombobulate({ items, defaultOpen: open, loading, getItemId: (i) => i });
  return (
    <Combobulate store={store}>
      <Combobulate.Input aria-label="Search" />
      <Combobulate.LiveRegion />
    </Combobulate>
  );
}

test("LiveRegion announces the loading state", () => {
  render(<LiveHarness items={["Paris"]} loading />);
  expect(screen.getByRole("status").textContent).toBe("Loading…");
});

test("LiveRegion is silent while closed, even when loading", () => {
  render(<LiveHarness items={["Paris"]} loading open={false} />);
  expect(screen.getByRole("status").textContent).toBe("");
});

function HighlightHarness() {
  const store = useCombobulate({
    items: ["Paris", "Berlin", "Madrid"],
    getItemId: (i) => i,
    itemToInputValue: (i) => i,
    defaultValue: "Berlin",
    defaultOpen: false,
  });
  return (
    <Combobulate store={store}>
      <Combobulate.Input aria-label="Search" />
      <Combobulate.List<string>>
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {item}
          </Combobulate.Item>
        )}
      </Combobulate.List>
    </Combobulate>
  );
}

test("opening on a committed selection highlights it via the bridge", async () => {
  render(<HighlightHarness />);
  const input = screen.getByRole("combobox");
  // Closed: nothing rendered, nothing highlighted.
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  // Focus opens the list; highlight-on-open runs the scroll-then-set bridge to
  // land the active descendant on the chosen row once it mounts.
  fireEvent.focus(input);
  await waitFor(() => expect(input.getAttribute("aria-activedescendant")).toBe("Berlin"));
});

test("single-select marks the chosen option with aria-selected", () => {
  render(<Harness items={["Paris", "Berlin", "Madrid"]} />);
  // Choose Berlin. Clicking selects without closing (Ariakit's own click-close
  // is disabled — combobulate owns selection and open state).
  fireEvent.click(screen.getByRole("option", { name: "Berlin" }));
  // `aria-selected` marks the CHOSEN value, distinct from the active highlight:
  // Berlin is chosen, Paris (not chosen) is not selected — even if it becomes
  // the active/highlighted row.
  expect(screen.getByRole("option", { name: "Berlin" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("option", { name: "Paris" }).getAttribute("aria-selected")).not.toBe(
    "true",
  );
});
