/**
 * Characterization tests for `@ariakit/react` `~0.4.37` (graduated from the
 * throwaway `spike/ariakit-virtual` spike), pinning the exact upstream
 * behaviors combobulate depends on:
 *
 *  1. `aria-expanded` on the combobox input tracks `store.open` — the reason
 *     Ariakit replaced cmdk (cmdk hardcoded it `true`).
 *  2. `store.setActiveId` declaratively drives `aria-activedescendant` — the
 *     reason the synthetic-pointer hack (cmdk's only way to move the
 *     highlight) could be deleted.
 *  3. Our own `aria-setsize`/`aria-posinset` on `<ComboboxItem>` are not
 *     overridden by Ariakit — the whole point of combobulate (full-list
 *     positions under virtualization, not just the mounted window's).
 *  4. `selectedValue` (the CHOSEN item) is a store concept entirely separate
 *     from the active highlight (`activeId`), and Ariakit does not set
 *     `aria-selected` on it automatically — combobulate owns that attribute
 *     itself (see `primitives.tsx`'s `Item`).
 *  5. The scroll-then-set ORDERING our virtualizer bridge cares about
 *     (`use-combobulate.ts`'s `requestActive` override): setting `activeId`
 *     to a target BEFORE its row mounts resolves `aria-activedescendant` to
 *     `null` in the SAME synchronous render pass (a screen reader reading the
 *     DOM at that instant would see nothing active); setting it AFTER the
 *     row is already mounted resolves it synchronously, in the same render.
 *     Item (un)registration is otherwise microtask-deferred: given one more
 *     flush (`await act(async () => {})`), the "before mount" case also
 *     catches up on its own. This is why the bridge scrolls first and defers
 *     `setActiveId` until the target's row is confirmed mounted — it isn't
 *     the only way to end up consistent, but it's the only way to be
 *     synchronously correct.
 *  6. What happens when the ACTIVE item's row unmounts (e.g. it scrolls out
 *     of the virtualized window): Ariakit does NOT clear `activeId` from the
 *     store — `getState().activeId` still names the vanished item — but the
 *     DOM's `aria-activedescendant` goes stale (`null`) and STAYS `null` for
 *     as long as no item with that id is mounted, even across flushes. If an
 *     item with the same id later remounts with no new `setActiveId` call,
 *     `aria-activedescendant` DOES resolve back on its own — but only after
 *     an async flush, never synchronously in the remounting render. This is
 *     the clobber risk our virtualizer bridge has to account for: the store
 *     alone can't tell you whether the highlighted item is actually visible
 *     to assistive tech right now.
 *
 * If an `@ariakit/react` bump changes one of these, this file fails first and
 * says why. It is a record of OBSERVED behavior, not an ideal one — assertions
 * here describe reality, even where reality is a footgun (case 6).
 */
import { afterEach, expect, test } from "bun:test";
import * as Ariakit from "@ariakit/react";
import { act, cleanup, render } from "@testing-library/react";

afterEach(() => cleanup());

const ITEMS = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon"];
const optionId = (i: number) => `opt-${i}`;

type StoreHolder = { current: Ariakit.ComboboxStore | undefined };

/** Narrows a value assigned synchronously during render (avoids `!`). */
function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) {
    throw new Error("expected value to be assigned by now");
  }
  return value;
}

function Basic({ holder }: { holder: StoreHolder }) {
  const store = Ariakit.useComboboxStore({ defaultOpen: true });
  holder.current = store;
  return (
    <>
      <Ariakit.Combobox store={store} aria-label="City" />
      <Ariakit.ComboboxList store={store}>
        {ITEMS.map((city, i) => (
          <Ariakit.ComboboxItem
            key={city}
            id={optionId(i)}
            value={city}
            aria-setsize={9999}
            aria-posinset={i + 1}
          />
        ))}
      </Ariakit.ComboboxList>
    </>
  );
}

function renderBasic() {
  const holder: StoreHolder = { current: undefined };
  const { container } = render(<Basic holder={holder} />);
  const input = must(container.querySelector<HTMLInputElement>("[role=combobox]"));
  act(() => input.focus());
  return { store: must(holder.current), input, container };
}

test("aria-expanded tracks store.open", () => {
  const { store, input } = renderBasic();
  expect(input.getAttribute("aria-expanded")).toBe("true");
  act(() => store.setOpen(false));
  expect(input.getAttribute("aria-expanded")).toBe("false");
});

test("setActiveId declaratively drives aria-activedescendant", () => {
  const { store, input } = renderBasic();
  act(() => store.setActiveId(optionId(3)));
  expect(input.getAttribute("aria-activedescendant")).toBe(optionId(3));
});

test("our full-list aria-setsize/aria-posinset on items are not overridden", () => {
  const { container } = renderBasic();
  const opt2 = container.querySelector(`#${optionId(2)}`);
  expect(opt2?.getAttribute("aria-setsize")).toBe("9999");
  expect(opt2?.getAttribute("aria-posinset")).toBe("3");
});

test("selectedValue (chosen) is separate from activeId (highlight); Ariakit does not set aria-selected itself", () => {
  const { store, container } = renderBasic();
  act(() => store.setSelectedValue("Berlin")); // choose Berlin (index 2) ...
  act(() => store.setActiveId(optionId(0))); // ... while the highlight sits on Paris
  expect(store.getState().selectedValue).toBe("Berlin");
  const berlin = container.querySelector(`#${optionId(2)}`);
  const paris = container.querySelector(`#${optionId(0)}`);
  // Ariakit leaves aria-selected alone — combobulate's own `Item` sets it on
  // the chosen row (pinned in primitives.test.tsx), not Ariakit.
  expect(berlin?.getAttribute("aria-selected")).toBeNull();
  expect(paris?.getAttribute("aria-selected")).toBeNull();
});

function Windowed({ window: win, holder }: { window: number[]; holder: StoreHolder }) {
  const store = Ariakit.useComboboxStore({ defaultOpen: true });
  holder.current = store;
  return (
    <>
      <Ariakit.Combobox store={store} aria-label="City" />
      <Ariakit.ComboboxList store={store}>
        {win.map((i) => (
          <Ariakit.ComboboxItem
            key={i}
            id={optionId(i)}
            value={`item-${i}`}
            aria-posinset={i + 1}
          />
        ))}
      </Ariakit.ComboboxList>
    </>
  );
}

test("jump ordering: setActiveId BEFORE the target mounts is null in the same render, but resolves after one more flush", async () => {
  const holder: StoreHolder = { current: undefined };
  const { rerender, container } = render(<Windowed window={[0, 1, 2, 3, 4]} holder={holder} />);
  const input = must(container.querySelector<HTMLInputElement>("[role=combobox]"));
  act(() => input.focus());
  const store = must(holder.current);

  // The order a naive jump-key implementation would use: set active on a
  // target outside the mounted window, THEN scroll (mount) it into view, in
  // the same render pass.
  act(() => store.setActiveId(optionId(3299)));
  rerender(<Windowed window={[3295, 3296, 3297, 3298, 3299]} holder={holder} />);
  expect(input.getAttribute("aria-activedescendant")).toBeNull();

  // Item registration is microtask-deferred: one more flush and it catches up
  // on its own, with no further setActiveId call.
  await act(async () => {});
  expect(input.getAttribute("aria-activedescendant")).toBe(optionId(3299));
});

test("jump ordering: setActiveId AFTER the target is already mounted resolves synchronously", () => {
  const holder: StoreHolder = { current: undefined };
  const { container } = render(
    <Windowed window={[3295, 3296, 3297, 3298, 3299]} holder={holder} />,
  );
  const input = must(container.querySelector<HTMLInputElement>("[role=combobox]"));
  act(() => input.focus());
  const store = must(holder.current);

  // The order our real bridge uses (`use-combobulate.ts`'s `requestActive`):
  // scroll (mount) first, defer `setActiveId` to an effect keyed on the
  // mounted virtual rows — this is the ONLY order that's correct without
  // waiting for an extra flush.
  act(() => store.setActiveId(optionId(3297)));

  expect(input.getAttribute("aria-activedescendant")).toBe(optionId(3297));
});

test("unmounting the active item: store keeps activeId, aria-activedescendant goes stale while unmounted, and self-heals (async, not sync) if the same id remounts", async () => {
  const holder: StoreHolder = { current: undefined };
  const { rerender, container } = render(<Windowed window={[0, 1, 2, 3, 4]} holder={holder} />);
  const input = must(container.querySelector<HTMLInputElement>("[role=combobox]"));
  act(() => input.focus());
  const store = must(holder.current);

  act(() => store.setActiveId(optionId(2)));
  expect(input.getAttribute("aria-activedescendant")).toBe(optionId(2));

  // The active item's row scrolls out of the virtualized window and unmounts.
  rerender(<Windowed window={[10, 11, 12, 13, 14]} holder={holder} />);
  expect(input.getAttribute("aria-activedescendant")).toBeNull();
  // Not a mid-flight artifact: it stays null even after a flush, because no
  // item with that id exists to register.
  await act(async () => {});
  // Ariakit does NOT clear activeId out of the store on unmount — the store
  // alone would have you believe item 2 is still the highlighted one ...
  expect(store.getState().activeId).toBe(optionId(2));
  // ... but the DOM attribute is genuinely gone, since no element carries it.
  expect(input.getAttribute("aria-activedescendant")).toBeNull();

  // An item with the SAME id remounts (e.g. scrolling back), with no new
  // setActiveId call at all.
  rerender(<Windowed window={[0, 1, 2, 3, 4]} holder={holder} />);
  // It does NOT self-heal synchronously in the remounting render ...
  expect(input.getAttribute("aria-activedescendant")).toBeNull();
  // ... but DOES self-heal once Ariakit's registration effect flushes. Our
  // virtualizer bridge doesn't rely on this — it re-issues `setActiveValue`
  // once the target's row is confirmed mounted — but a future Ariakit bump
  // that removed this self-heal would still leave the bridge correct; one
  // that broke it silently for OTHER call sites would fail here first.
  await act(async () => {});
  expect(input.getAttribute("aria-activedescendant")).toBe(optionId(2));
});
