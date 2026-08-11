import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Combobulate } from "../core/primitives";
import { useCombobulate } from "../core/use-combobulate";
import { stubElementLayout } from "../test-utils/stub-element-layout";
import { Popover } from "./floating-primitives";
import { useCombobulateFloating } from "./use-floating";

afterEach(() => cleanup());

function Demo({ open }: { open: boolean }) {
  const store = useCombobulate({ items: ["Paris"], defaultOpen: open });
  const floating = useCombobulateFloating(store);
  return (
    <Combobulate store={store}>
      <Combobulate.Input ref={floating.reference} {...floating.referenceProps} />
      <Popover floating={floating}>
        <div data-testid="panel">panel</div>
      </Popover>
    </Combobulate>
  );
}

test("Popover renders its children when open", async () => {
  const restore = stubElementLayout();
  // `useFloating`'s `whileElementsMounted: autoUpdate` schedules its first
  // position update via `requestAnimationFrame` right after mount, outside
  // `render`'s own synchronous `act`. Flushing a tick inside `act` here lets
  // that update settle before assertions instead of warning post-test.
  await act(async () => {
    render(<Demo open={true} />);
  });
  expect(screen.queryByTestId("panel")).not.toBeNull();
  restore();
});

test("Popover renders nothing when closed", async () => {
  const restore = stubElementLayout();
  await act(async () => {
    render(<Demo open={false} />);
  });
  expect(screen.queryByTestId("panel")).toBeNull();
  restore();
});
