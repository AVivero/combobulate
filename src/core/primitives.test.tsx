import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
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
  const api = useCombobulate({ items, defaultOpen: true, multiple, getItemId: (i) => i });
  return (
    <Combobulate.Root api={api}>
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
    </Combobulate.Root>
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
  const { rerender } = render(<Harness multiple />);
  expect(screen.getAllByRole("option")[0]?.getAttribute("aria-checked")).toBe("false");
  rerender(<Harness />);
  expect(screen.getAllByRole("option")[0]?.getAttribute("aria-checked")).toBeNull();
});

test("Empty renders only when nothing matches", () => {
  render(<Harness items={[]} />);
  // `LiveRegion`'s announcement is also the literal string "No results" when
  // `filteredItems` is empty (see `use-combobulate.ts`), so an unscoped
  // `getByText` still matches both elements by *text*. That's expected and
  // fine now — `Empty` scopes to its own tag (a plain `<div>`, no role)
  // rather than the old `output:not([aria-live])` hack that was really
  // disambiguating two competing `role="status"` announcers.
  screen.getByText("No results", { selector: "div" });
  // The real point of this fix: `Empty` must not introduce a second
  // `role="status"` element. `LiveRegion` remains the sole one.
  expect(screen.getAllByRole("status")).toHaveLength(1);
});

test("LiveRegion announces the result count", () => {
  render(<Harness items={["Paris"]} />);
  expect(screen.getByRole("status").textContent).toBe("1 result");
});
