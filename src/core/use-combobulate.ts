import { useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultFilterItems, defaultGetSearchText, isSameItem, toChangeValue } from "./item-utils";
import type { CombobulateApi, UseCombobulateOptions } from "./types";

/** Rows moved per PageUp/PageDown. A fixed page keeps the jump predictable
 *  across variable-height rows, where a measured "viewport of rows" would not. */
const PAGE_SIZE = 10;

/** Max frames a jump waits for its target row to mount before giving up on the
 *  synthetic-pointer path (see `onInputKeyDown`). A large scroll can take a few
 *  frames to commit the row; a row that never lays out (the unit environment)
 *  falls through to the state-only fallback after this many. */
const JUMP_MOUNT_FRAMES = 20;

/**
 * Orchestration hook for a cmdk-backed, virtualized combobox.
 *
 * cmdk owns arrow-key navigation, option roles, and the highlighted item
 * (surfaced here as `activeValue`/`setActiveValue`, wired to `<Command>`'s
 * controlled `value`). This hook owns everything cmdk does not: filtering,
 * selection, input/open state, the virtualizer, and the bridge that keeps the
 * highlighted row mounted so cmdk's `aria-activedescendant` always resolves.
 */
export function useCombobulate<T>(options: UseCombobulateOptions<T>): CombobulateApi<T> {
  const {
    items,
    getSearchText = defaultGetSearchText as (item: T) => string,
    getItemId,
    filterItems,
    multiple = false,
    onChange,
    onInputChange,
    onOpenChange,
    defaultOpen = false,
    defaultValue = null,
    loading = false,
    estimateSize = () => 32,
    overscan = 8,
    itemToInputValue,
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [inputValue, setInputValueState] = useState("");
  const [activeValue, setActiveValue] = useState("");
  const [selectedItems, setSelectedItemsState] = useState<T[]>(() =>
    defaultValue == null ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  );

  // Committed-value model (single-select, opt-in via `itemToInputValue`).
  // `committedValue` is what the input shows for the current selection;
  // `isShowingSelection` means the input is displaying that selection rather
  // than an active search query.
  const committedValue =
    itemToInputValue && !multiple && selectedItems[0] !== undefined
      ? itemToInputValue(selectedItems[0])
      : "";
  const isShowingSelection = committedValue !== "" && inputValue === committedValue;

  const filteredItems = useMemo(() => {
    // While the input still shows the committed selection it's a display value,
    // not a search — show the whole list instead of filtering to it.
    if (isShowingSelection) return items;
    if (filterItems) return filterItems(items, inputValue);
    return defaultFilterItems(items, inputValue, getSearchText);
  }, [items, inputValue, filterItems, getSearchText, isShowingSelection]);

  const getItemIdCb = useCallback(
    (item: T, index: number) => (getItemId ? getItemId(item) : String(index)),
    [getItemId],
  );

  // Used verbatim: cmdk round-trips `value` through `onValueChange` unchanged
  // (pinned by cmdk-behavior.test.tsx), so no normalization is needed — and
  // lowercasing would make ids differing only in case collide in the map below.
  const itemValue = useCallback(
    (item: T, index: number) => getItemIdCb(item, index),
    [getItemIdCb],
  );

  /** Reverse index for the bridge: cmdk's value string -> position in `filteredItems`. */
  const valueToIndex = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((item, index) => {
      map.set(itemValue(item, index), index);
    });
    return map;
  }, [filteredItems, itemValue]);

  const activeIndex = valueToIndex.get(activeValue) ?? -1;

  const scrollRef = useRef<HTMLElement | null>(null);
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  /**
   * The bridge. cmdk moves the highlight among *mounted* rows; scrolling the
   * new active index into view mounts it (and its neighbours), so the next
   * keystroke always has a real row to move to and `aria-activedescendant`
   * always points at a node that exists.
   */
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [isOpen, activeIndex, virtualizer]);

  // Highlight the committed selection when the list opens, so it's visible and
  // scrolled into view through the bridge above. Keyed on `isOpen` going true;
  // no-op for a plain search (isShowingSelection false).
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened || !isShowingSelection) return;
    const selected = selectedItems[0];
    if (selected === undefined) return;
    const index = filteredItems.indexOf(selected);
    if (index >= 0) setActiveValue(itemValue(selected, index));
  }, [isOpen, isShowingSelection, selectedItems, filteredItems, itemValue]);

  const setOpen = useCallback(
    (next: boolean) => {
      // Revert-on-close (committed-value model): if the user typed a search but
      // didn't pick, restore the input to the committed selection (or "" if
      // none) on close. Raw setter so `onInputChange` does not fire. A clean
      // input (already equal to the committed value, e.g. right after a
      // fill-on-select) is left untouched, so close-on-select never double-handles.
      if (!next && itemToInputValue && !multiple && inputValue !== committedValue) {
        setInputValueState(committedValue);
      }
      setIsOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, itemToInputValue, multiple, inputValue, committedValue],
  );

  const setInputValue = useCallback(
    (value: string) => {
      setInputValueState(value);
      onInputChange?.(value);
      // Committed-value model: the input represents the selection, so clearing
      // it to empty means "nothing selected" — drop the selection. Single-select
      // only (multi-select keeps its chips). This runs only on user edits: the
      // programmatic fill/revert use the raw `setInputValueState`, not this.
      if (value === "" && itemToInputValue && !multiple && selectedItems.length > 0) {
        setSelectedItemsState([]);
        onChange?.(toChangeValue([], multiple));
      }
    },
    [onInputChange, itemToInputValue, multiple, selectedItems, onChange],
  );

  // `onChange` fires OUTSIDE the state updater. React invokes updater
  // functions twice in StrictMode, so a side effect inside one would fire the
  // consumer's callback twice in dev (StrictMode is on by default in Next.js
  // and every Vite React template).
  //
  // Reads render-scoped `selectedItems` rather than the updater's `prev`, so
  // it is intended to be called ONCE PER USER EVENT — two `select()` calls
  // batched in the same tick would drop the first.
  const select = useCallback(
    (item: T) => {
      const next = multiple
        ? selectedItems.some((i) => isSameItem(i, item, getItemId))
          ? selectedItems.filter((i) => !isSameItem(i, item, getItemId))
          : [...selectedItems, item]
        : [item];
      setSelectedItemsState(next);
      // Fill-on-select (committed-value model): show the pick in the input, via
      // the RAW setter so `onInputChange` does NOT fire — this is a programmatic
      // change, not user typing, and a remote-search consumer must not re-fetch
      // for the label.
      if (itemToInputValue && !multiple) setInputValueState(itemToInputValue(item));
      onChange?.(toChangeValue(next, multiple));
    },
    [multiple, onChange, getItemId, selectedItems, itemToInputValue],
  );

  const isSelected = useCallback(
    (item: T) => selectedItems.some((i) => isSameItem(i, item, getItemId)),
    [selectedItems, getItemId],
  );

  const filteredRef = useRef(filteredItems);
  filteredRef.current = filteredItems;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // Holds the rAF handle of a pending deferred jump commit (see below), so a
  // second jump before the frame fires cancels the first instead of letting
  // two deferred commits race.
  const pendingJumpRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pendingJumpRef.current !== null) cancelAnimationFrame(pendingJumpRef.current);
    },
    [],
  );

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const rows = filteredRef.current;
      if (rows.length === 0) return;
      const current = activeIndexRef.current;
      const last = rows.length - 1;

      let target: number | null = null;
      if (event.key === "Home") target = 0;
      else if (event.key === "End") target = last;
      else if (event.key === "PageDown")
        target = Math.min((current < 0 ? 0 : current) + PAGE_SIZE, last);
      else if (event.key === "PageUp")
        target = Math.max((current < 0 ? 0 : current) - PAGE_SIZE, 0);
      if (target === null) return;

      const item = rows[target];
      if (item === undefined) return;

      // cmdk binds Home/End on the <Command> root and would otherwise move the
      // highlight to the first/last *mounted* row. Our handler sits on the
      // input, which fires first, so stopping propagation preempts it.
      event.preventDefault();
      event.stopPropagation();

      if (pendingJumpRef.current !== null) {
        cancelAnimationFrame(pendingJumpRef.current);
        pendingJumpRef.current = null;
      }

      const value = itemValue(item, target);

      // Why not just `setActiveValue(value)`? Because cmdk 1.1.1 binds the
      // input's `aria-activedescendant` solely to its internal `selectedItemId`,
      // and that is recomputed in exactly ONE place — cmdk's internal
      // `store.setState("value", …)`, reached only from cmdk's own keyboard
      // handlers or an item's `onPointerMove`/`onClick`. A change to the
      // controlled `<Command value>` prop updates which row is `aria-selected`
      // but never recomputes `selectedItemId`, so a prop-driven jump leaves
      // `aria-activedescendant` stale/null. (Root-cause detail in
      // .superpowers/sdd/task-5-report.md, confirmed against
      // node_modules/cmdk/dist/index.mjs in a real browser.)
      //
      // The fix: once the target row is in the DOM, dispatch a synthetic
      // `pointermove` at its cmdk item so cmdk's OWN `onPointerMove` runs the
      // internal `setState("value", …)` that recomputes `selectedItemId` and
      // re-points `aria-activedescendant`. cmdk's `onPointerMove` also fires
      // `onValueChange`, forwarded by `<Command onValueChange={setActiveValue}>`,
      // so this updates our `activeValue`/`activeIndex` too.
      const cell = (i: number) =>
        scrollRef.current?.querySelector(`[data-index="${i}"] [cmdk-item]`) ?? null;

      const tryDispatch = () => {
        const node = cell(target);
        if (!node) return false;
        // cmdk skips the `selectedItemId` recompute when the new value equals
        // the current one (`Object.is` guard). After a large scroll, cmdk's
        // own unmount handling can already have set the value to the target
        // (it re-selects the first mounted row when the selected row unmounts),
        // leaving a stale/null `selectedItemId` that a plain dispatch on the
        // target can't dislodge — confirmed in a real browser. So "wiggle":
        // dispatch on an adjacent mounted row FIRST (guaranteed a different
        // value), then on the target, forcing a clean recompute that lands on
        // the target. The intermediate value change is coalesced by React, so
        // no intermediate render/scroll is observable.
        const neighbor = cell(target + 1) ?? cell(target - 1);
        if (neighbor) neighbor.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
        node.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
        setActiveValue(value);
        return true;
      };

      // Scroll now — this mounts the target row. `scrollToIndex` over a large
      // distance can take more than one frame to commit the destination row,
      // and dispatching into a not-yet-mounted row silently no-ops, so poll
      // across frames until it mounts. Bounded so a row that never lays out
      // (the unit environment, which has no scroll container) falls through to
      // a state-only commit rather than looping forever.
      let attempt = 0;
      const commit = () => {
        virtualizer.scrollToIndex(target, { align: "center" });
        // Force a synchronous range recompute: the virtualizer only re-renders
        // its mounted window in response to a scroll EVENT, which the browser
        // fires asynchronously after `scrollToIndex` sets `scrollTop`. We
        // dispatch one synchronously so the virtualizer's own scroll handler
        // runs now (it commits the new range via `flushSync`), mounting the
        // target row within this call — so the pointer dispatch below can land
        // before the handler returns, beating the e2e's immediate aria read.
        scrollRef.current?.dispatchEvent(new Event("scroll"));
        if (tryDispatch()) {
          pendingJumpRef.current = null;
          return;
        }
        attempt += 1;
        if (attempt > JUMP_MOUNT_FRAMES) {
          // Never laid out (the unit environment) — commit our own state so
          // `activeValue`/`activeIndex` still reflect the jump;
          // `aria-activedescendant` is then the e2e's concern.
          setActiveValue(value);
          pendingJumpRef.current = null;
          return;
        }
        pendingJumpRef.current = requestAnimationFrame(commit);
      };
      commit();
    },
    [virtualizer, itemValue],
  );

  // Closed is checked first: a closed combobox announces nothing, even while
  // `loading` — its live region is not on screen to narrate.
  const announcement = !isOpen
    ? ""
    : loading
      ? "Loading…"
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;

  return {
    isOpen,
    setOpen,
    inputValue,
    setInputValue,
    filteredItems,
    activeValue,
    setActiveValue,
    onInputKeyDown,
    activeIndex,
    selectedItems,
    select,
    isSelected,
    itemValue,
    announcement,
    loading,
    multiple,
    virtualizer,
    scrollRef,
  };
}
