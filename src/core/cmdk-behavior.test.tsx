/**
 * Characterization tests for cmdk 1.1.1, pinning the behavior our core relies on:
 *
 *  1. `onValueChange` emits the item's `value` string **verbatim, with no
 *     case-folding**. Given `<Command.Item value="Beta-ID">`, pressing
 *     ArrowDown emits `"Beta-ID"` exactly (observed directly; the test's
 *     `.toLowerCase()` comparison is a tolerant assertion, not evidence of
 *     folding). `itemValue()` in Task 3 does not need to normalize case to
 *     round-trip cmdk's own emissions — but should still lowercase
 *     defensively if it needs to match ids from another case-insensitive
 *     source.
 *  2. cmdk owns `aria-activedescendant` on the input — we never set it.
 *     Observed value was a Radix-style generated id (e.g. `radix-_r_4_`),
 *     confirming cmdk manages id generation and wiring internally.
 *  3. cmdk binds Home/End on the `<Command>` root (confirmed: End moves
 *     highlight to the last item and fires `onValueChange` with that item's
 *     value). Because the root handler runs on bubble and our handler sits
 *     on the Input (confirmed: an Input `onKeyDown` fires before the
 *     `Command` root's `onKeyDown` for the same keydown), `stopPropagation()`
 *     in the jump-key interceptor (Task 5) reliably preempts it.
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

test("onValueChange round-trips the item value (documents any case-folding)", async () => {
  const seen: string[] = [];
  render(<Harness onValue={(v) => seen.push(v)} />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "{ArrowDown}");

  // Pin whatever cmdk actually emits. If this is "beta-id" rather than
  // "Beta-ID", cmdk case-folds values and `itemValue()` in Task 3 MUST
  // lowercase ids so the value round-trips through our value->index map.
  expect(seen.length).toBeGreaterThan(0);
  const emitted = seen[seen.length - 1];
  expect(typeof emitted).toBe("string");
  expect(emitted?.toLowerCase()).toBe("beta-id");
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
  await userEvent.type(input, "{End}");
  // If cmdk binds End, it moves highlight to the last item and emits a value.
  // If this expectation fails, cmdk does NOT bind End and Task 5's
  // stopPropagation is unnecessary (harmless, but note it in the PR).
  expect(seen.some((v) => v.toLowerCase() === "gamma-id")).toBe(true);
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
