import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createCombobulateStore } from "../store";

afterEach(() => cleanup());

const ITEMS = ["Paris", "Madrid", "Berlin"];

/** Minimal stand-in for the parts of React's KeyboardEvent `onInputKeyDown` reads. */
function keyEvent(key: string, mod: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    ...mod,
    preventDefault: () => {
      defaultPrevented = true;
    },
    stopPropagation: () => {
      propagationStopped = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
    get propagationStopped() {
      return propagationStopped;
    },
  };
}

test("store: open state round-trips", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.getState().isOpen).toBe(false);
  act(() => store.setOpen(true));
  expect(store.getState().isOpen).toBe(true);
});

test("store: select updates selectedItems and isSelected (single)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.select("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
  expect(store.isSelected("Berlin")).toBe(true);
  act(() => store.select("Paris")); // single-select replaces
  expect(store.getState().selectedItems).toEqual(["Paris"]);
});

test("store: multiple toggles membership", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, multiple: true });
  act(() => store.select("Paris"));
  act(() => store.select("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Paris", "Berlin"]);
  act(() => store.select("Paris"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
});

test("store: itemValue is the id verbatim; activeIndex maps back", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.itemValue("Madrid")).toBe("Madrid");
  act(() => store.setActiveValue("Madrid"));
  expect(store.getState().activeIndex).toBe(1);
});

test("store: onInputKeyDown ArrowDown advances activeIndex via the default requestActive", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.setActiveValue(store.itemValue("Paris")));
  expect(store.getState().activeIndex).toBe(0);

  const event = keyEvent("ArrowDown");
  act(() => store.onInputKeyDown(event as never));

  // The default `_internal.requestActive` commits immediately (no
  // virtualizer involved for a headless store), so this settles synchronously.
  expect(store.getState().activeIndex).toBe(1);
  expect(event.defaultPrevented).toBe(true);
  expect(event.propagationStopped).toBe(true);
});

test("store: onInputKeyDown bare Home/End are NOT owned (caret passthrough)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.setActiveValue(store.itemValue("Madrid")));

  const home = keyEvent("Home");
  act(() => store.onInputKeyDown(home as never));
  expect(home.defaultPrevented).toBe(false);
  expect(home.propagationStopped).toBe(false);
  expect(store.getState().activeIndex).toBe(1); // untouched

  const end = keyEvent("End");
  act(() => store.onInputKeyDown(end as never));
  expect(end.defaultPrevented).toBe(false);
  expect(store.getState().activeIndex).toBe(1); // untouched
});

test("store: select writes inputValue BEFORE firing onChange (committed-value fill)", () => {
  let inputValueDuringOnChange: string | undefined;
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    getInputValue: (c) => `Selected: ${c}`,
    onChange: () => {
      inputValueDuringOnChange = store.getState().inputValue;
    },
  });
  act(() => store.select("Berlin"));
  expect(inputValueDuringOnChange).toBe("Selected: Berlin");
  expect(store.getState().inputValue).toBe("Selected: Berlin");
});

test("store: setOpen(false) when already closed does not fire onOpenChange", () => {
  let calls = 0;
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    onOpenChange: () => {
      calls += 1;
    },
  });
  expect(store.getState().isOpen).toBe(false);
  act(() => store.setOpen(false));
  expect(calls).toBe(0);
  expect(store.getState().isOpen).toBe(false);
});

test("store: setOpen fires onOpenChange on a real transition", () => {
  const seen: boolean[] = [];
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    onOpenChange: (open) => {
      seen.push(open);
    },
  });
  act(() => store.setOpen(true));
  expect(seen).toEqual([true]);
  act(() => store.setOpen(true)); // no-op, already open
  expect(seen).toEqual([true]);
  act(() => store.setOpen(false));
  expect(seen).toEqual([true, false]);
});

test("store: onInputKeyDown Ctrl+End jumps to the last item", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.setActiveValue(store.itemValue("Paris")));

  const event = keyEvent("End", { ctrlKey: true });
  act(() => store.onInputKeyDown(event as never));

  expect(store.getState().activeIndex).toBe(ITEMS.length - 1);
  expect(event.defaultPrevented).toBe(true);
  expect(event.propagationStopped).toBe(true);
});

test("without getItemId, fallback ids are stable, unique, and position-independent", () => {
  const paris = { n: "Paris" };
  const madrid = { n: "Madrid" };
  const berlin = { n: "Berlin" };
  const store = createCombobulateStore({
    items: [paris, madrid, berlin],
    getSearchText: (o) => o.n,
  });
  const berlinId = store.itemValue(berlin);
  // Distinct items get distinct ids (a positional fallback collapsed unrelated
  // items together once the index was gone).
  expect(store.itemValue(paris)).not.toBe(berlinId);
  expect(store.itemValue(madrid)).not.toBe(berlinId);
  // Filtering moves Berlin from position 2 to position 0 in the visible list...
  act(() => store.setInputValue("berlin"));
  expect(store.getState().filteredItems).toEqual([berlin]);
  // ...but its id is unchanged, so a selection made while filtered is still
  // recognised as Berlin after the filter clears.
  expect(store.itemValue(berlin)).toBe(berlinId);
  act(() => store.select(berlin));
  act(() => store.setInputValue(""));
  expect(store.getState().selectedItems).toEqual([berlin]);
  expect(store.isSelected(berlin)).toBe(true);
});
