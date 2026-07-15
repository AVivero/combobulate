import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAutocomplete } from "./use-autocomplete";

const ITEMS = ["Paris", "Madrid", "Berlin"];

test("input exposes combobox role and controls the list", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  const input = result.current.getInputProps();
  expect(input.role).toBe("combobox");
  expect(input["aria-controls"]).toBe(result.current.listId);
});

test("aria-activedescendant points at the active item id", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => result.current.open());
  act(() => result.current.setActiveIndex(1));
  const activeId = result.current.getItemProps(ITEMS[1] as string, 1).id;
  expect(result.current.getInputProps()["aria-activedescendant"]).toBe(activeId);
});

test("item props stamp setsize/posinset from the filtered model", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  const props = result.current.getItemProps(ITEMS[2] as string, 2);
  expect(props["aria-setsize"]).toBe(3);
  expect(props["aria-posinset"]).toBe(3);
  expect(props.role).toBe("option");
});

test("active item gets data-active attribute", () => {
  const { result } = renderHook(() => useAutocomplete({ items: ITEMS }));
  act(() => result.current.setActiveIndex(1));
  expect(result.current.getItemProps(ITEMS[1] as string, 1)["data-active"]).toBe("");
  expect(result.current.getItemProps(ITEMS[0] as string, 0)["data-active"]).toBeUndefined();
});

test("ArrowDown opens and moves active; Enter selects", () => {
  let selected: unknown;
  const { result } = renderHook(() =>
    useAutocomplete({
      items: ITEMS,
      onChange: (v) => {
        selected = v;
      },
    }),
  );
  const key = (k: string) =>
    act(() =>
      result.current
        .getInputProps()
        .onKeyDown({ key: k, preventDefault() {} } as React.KeyboardEvent),
    );
  key("ArrowDown");
  expect(result.current.isOpen).toBe(true);
  key("ArrowDown");
  expect(result.current.activeIndex).toBe(1);
  key("Enter");
  expect(selected).toBe("Madrid");
});
