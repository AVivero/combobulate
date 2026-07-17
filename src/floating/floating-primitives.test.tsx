import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Combobulate } from "../core/primitives";
import { useCombobulate } from "../core/use-combobulate";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Popover } from "./floating-primitives";
import { useAutocompleteFloating } from "./use-floating";

afterEach(() => cleanup());

function Demo({ open }: { open: boolean }) {
  const api = useCombobulate({ items: ["Paris"], defaultOpen: open });
  const floating = useAutocompleteFloating(api);
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input ref={floating.reference} {...floating.referenceProps} />
      <Popover floating={floating}>
        <div data-testid="panel">panel</div>
      </Popover>
    </Combobulate.Root>
  );
}

test("Popover renders its children when open", () => {
  const restore = stubElementLayout();
  render(<Demo open={true} />);
  expect(screen.queryByTestId("panel")).not.toBeNull();
  restore();
});

test("Popover renders nothing when closed", () => {
  const restore = stubElementLayout();
  render(<Demo open={false} />);
  expect(screen.queryByTestId("panel")).toBeNull();
  restore();
});
