/**
 * Characterization tests for cmdk 1.1.1, pinning the behavior our core relies on:
 *
 *  1. `onValueChange` emits the item's `value` string **verbatim, with no
 *     case-folding**. Given `<Command.Item value="Beta-ID">`, pressing
 *     ArrowDown emits `"Beta-ID"` exactly — pinned by a committed assertion
 *     (`expect(emitted).toBe("Beta-ID")`), not just a comment. `itemValue()`
 *     in Task 3 does not need to normalize case to round-trip cmdk's own
 *     emissions, and per the project owner's decision, Task 3 uses ids
 *     verbatim (no lowercasing).
 *  2. cmdk owns `aria-activedescendant` on the input — we never set it.
 *     Observed value was a Radix-style generated id (e.g. `radix-_r_4_`),
 *     confirming cmdk manages id generation and wiring internally.
 *  3. cmdk binds both Home and End on the `<Command>` root (confirmed: End
 *     moves highlight to the last item and fires `onValueChange` with that
 *     item's value; Home then moves it back to the first item and fires
 *     `onValueChange` again). Because the root handler runs on bubble and
 *     our handler sits on the Input (confirmed: an Input `onKeyDown` fires
 *     before the `Command` root's `onKeyDown` for the same keydown),
 *     `stopPropagation()` in the jump-key interceptor (Task 5) reliably
 *     preempts both.
 *
 * If a cmdk upgrade breaks one of these, this file fails first and tells you why.
 */
import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Command } from "cmdk";
import { useState } from "react";

// `@testing-library/react`'s built-in auto-cleanup only registers itself
// against a global `afterEach`, which Bun's test runner does not expose
// implicitly — without this, DOM from these tests leaks into other test
// files run in the same process. See src/primitives/combobulate.test.tsx.
afterEach(() => cleanup());

/** Renders a plain cmdk command with filtering off — our exact usage mode. */
function Harness({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState("Alpha-ID");
  return (
    <Command
      shouldFilter={false}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    >
      <Command.Input />
      <Command.List>
        <Command.Item value="Alpha-ID">Alpha</Command.Item>
        <Command.Item value="Beta-ID">Beta</Command.Item>
        <Command.Item value="Gamma-ID">Gamma</Command.Item>
      </Command.List>
    </Command>
  );
}

test("onValueChange emits the item value verbatim (no case-folding)", async () => {
  const seen: string[] = [];
  render(<Harness onValue={(v) => seen.push(v)} />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "{ArrowDown}");

  expect(seen.length).toBeGreaterThan(0);
  const emitted = seen[seen.length - 1];
  expect(typeof emitted).toBe("string");
  expect(emitted).toBe("Beta-ID");
});

test("cmdk sets aria-activedescendant on the input", async () => {
  render(<Harness onValue={() => {}} />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
});

test("cmdk itself binds Home/End (so our Input handler must stopPropagation)", async () => {
  const seen: string[] = [];
  render(<Harness onValue={(v) => seen.push(v)} />);
  const input = screen.getByRole("combobox");
  // Harness starts on "Alpha-ID" (the first item), so pressing Home first
  // would emit nothing observable. Move to the last item with End, then
  // press Home to come back — both emissions are asserted below.
  await userEvent.type(input, "{End}");
  await userEvent.type(input, "{Home}");
  expect(seen).toContain("Gamma-ID");
  expect(seen).toContain("Alpha-ID");
});

test("an Input-level keydown handler runs before cmdk's root handler", async () => {
  const order: string[] = [];
  function Ordered() {
    return (
      <Command shouldFilter={false} onKeyDown={() => order.push("root")}>
        <Command.Input onKeyDown={() => order.push("input")} />
        <Command.List>
          <Command.Item value="a">A</Command.Item>
        </Command.List>
      </Command>
    );
  }
  render(<Ordered />);
  await userEvent.type(screen.getByRole("combobox"), "{ArrowDown}");
  expect(order[0]).toBe("input");
});
