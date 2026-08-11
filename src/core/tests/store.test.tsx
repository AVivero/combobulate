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
  // Navigation requires an open popup (closed, arrows only OPEN it).
  act(() => store.setOpen(true));
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
  // Navigation requires an open popup (closed, arrows only OPEN it).
  act(() => store.setOpen(true));
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

test("store: setValue replaces selection and fires onChange (uncontrolled single)", () => {
  const seen: unknown[] = [];
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    onChange: (v) => seen.push(v),
  });
  act(() => store.setValue("Berlin"));
  expect(store.getState().selectedItems).toEqual(["Berlin"]);
  expect(seen).toEqual(["Berlin"]);
});

test("store: setValue(null) clears (uncontrolled single)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.select("Paris"));
  act(() => store.setValue(null));
  expect(store.getState().selectedItems).toEqual([]);
});

test("store: setValue([]) clears (uncontrolled multi)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, multiple: true });
  act(() => store.select("Paris"));
  act(() => store.select("Berlin"));
  act(() => store.setValue([]));
  expect(store.getState().selectedItems).toEqual([]);
});

test("store: controlled — select fires onChange but does NOT mutate selection", () => {
  const seen: unknown[] = [];
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    value: null,
    onChange: (v) => seen.push(v),
  });
  act(() => store.select("Berlin"));
  expect(seen).toEqual(["Berlin"]); // request emitted
  expect(store.getState().selectedItems).toEqual([]); // parent owns value; no internal mutation
});

test("store: controlled — setValue fires onChange only", () => {
  const seen: unknown[] = [];
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    value: null,
    onChange: (v) => seen.push(v),
  });
  act(() => store.setValue("Madrid"));
  expect(seen).toEqual(["Madrid"]);
  expect(store.getState().selectedItems).toEqual([]);
});

test("store: setSelectedValue reflects value strings into selectedItems", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c, value: null });
  act(() => store._internal.setSelectedValue(["Madrid"]));
  expect(store.getState().selectedItems).toEqual(["Madrid"]);
  const first = store.getState().selectedItems;
  act(() => store._internal.setSelectedValue(["Madrid"])); // unchanged
  expect(store.getState().selectedItems).toBe(first); // identity-stable no-op
});

test("store: controlled value seeds selection + committed input on create", () => {
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    value: "Paris",
    getInputValue: (c) => `City: ${c}`,
  });
  expect(store.getState().selectedItems).toEqual(["Paris"]);
  expect(store.getState().inputValue).toBe("City: Paris");
});

test("store: controlled multi — select/setValue fire onChange but don't mutate selection", () => {
  const seen: unknown[] = [];
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    multiple: true,
    value: [],
    onChange: (v) => seen.push(v),
  });
  act(() => store.select("Paris"));
  act(() => store.setValue(["Berlin", "Madrid"]));
  expect(store.getState().selectedItems).toEqual([]); // parent owns value
  expect(seen).toEqual([["Paris"], ["Berlin", "Madrid"]]);
});

test("store: setSelectedValue refreshes committed input when closed, not when open", () => {
  const store = createCombobulateStore({
    items: ITEMS,
    getItemId: (c) => c,
    value: null,
    getInputValue: (c) => `City: ${c}`,
  });
  // closed: reflect updates the committed input
  act(() => store._internal.setSelectedValue(["Paris"]));
  expect(store.getState().inputValue).toBe("City: Paris");
  // open + a typed search: reflect must NOT clobber it
  act(() => store.setOpen(true));
  act(() => store.setInputValue("mad"));
  act(() => store._internal.setSelectedValue(["Berlin"]));
  expect(store.getState().inputValue).toBe("mad");
});

test("store: ArrowDown on a closed popup opens it (WAI-ARIA reopen)", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  expect(store.getState().isOpen).toBe(false);
  act(() => store.onInputKeyDown(keyEvent("ArrowDown") as never));
  expect(store.getState().isOpen).toBe(true);
});

test("store: ArrowUp on a closed popup opens it", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.onInputKeyDown(keyEvent("ArrowUp") as never));
  expect(store.getState().isOpen).toBe(true);
});

test("store: a non-open nav key on a closed popup leaves it closed", () => {
  const store = createCombobulateStore({ items: ITEMS, getItemId: (c) => c });
  act(() => store.onInputKeyDown(keyEvent("End", { ctrlKey: true }) as never));
  expect(store.getState().isOpen).toBe(false);
});
