import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { createCombobulateStore } from "./store";
import type { CombobulateStore, UseCombobulateOptions } from "./types";

/**
 * Orchestration hook for a virtualized, Ariakit-backed combobox.
 *
 * It creates the store once (`createCombobulateStore`), wires
 * `@tanstack/react-virtual`, and injects the virtualizer + scroll ref plus the
 * real scroll-then-set bridge into the store internals. Ariakit owns option
 * roles, `aria-expanded`, and `aria-activedescendant`; combobulate — via the
 * store — owns filtering, selection, input/open state, and keyboard navigation
 * over the FULL filtered list (not just the mounted window).
 *
 * The returned value is the store handle itself, passed to `<Combobulate>`.
 */
export function useCombobulate<T>(options: UseCombobulateOptions<T>): CombobulateStore<T> {
  const {
    items,
    loading = false,
    estimateSize = () => 32,
    overscan = 8,
    onChange,
    onInputChange,
    onOpenChange,
  } = options;

  /**
   * Consumer callbacks read through a ref so the store — created once — always
   * calls the LATEST ones, even when a consumer passes fresh inline handlers
   * each render. Recreating the store to pick them up would drop open/input/
   * selection state.
   */
  const callbacksRef = useRef({ onChange, onInputChange, onOpenChange });
  callbacksRef.current = { onChange, onInputChange, onOpenChange };

  // Create the store exactly once (lazy `useState` initializer). Later prop
  // changes flow in through the effects below, not a rebuild.
  const [store] = useState(() =>
    createCombobulateStore<T>({
      ...options,
      onChange: (value) => callbacksRef.current.onChange?.(value),
      onInputChange: (value) => callbacksRef.current.onInputChange?.(value),
      onOpenChange: (open) => callbacksRef.current.onOpenChange?.(open),
    }),
  );

  const scrollRef = useRef<HTMLElement | null>(null);
  const filteredItems = store.useState("filteredItems");
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });

  // Inject the virtualizer + scroll ref so the `List` primitive can drive the
  // window from the store handle alone. Stable across renders (idempotent).
  store._internal.scrollRef = scrollRef;
  store._internal.virtualizer = virtualizer;

  /**
   * The scroll-then-set bridge, overriding the store's immediate default.
   * Ariakit only highlights *mounted* rows, so a jump target outside the
   * current virtualized window is scrolled into view first, then committed as
   * active once its row mounts (resolved by the effect below). Holds the
   * pending target between "asked to scroll" and "row mounted"; `null` when
   * nothing is pending.
   */
  const pendingActiveRef = useRef<number | null>(null);
  store._internal.requestActive = (target: number) => {
    const item = store.getState().filteredItems[target];
    if (item === undefined) return;
    const mounted = virtualizer.getVirtualItems().some((row) => row.index === target);
    if (mounted) {
      store.setActiveValue(store.itemValue(item, target));
      return;
    }
    virtualizer.scrollToIndex(target);
    pendingActiveRef.current = target;
  };

  // Resolve a pending jump once its target row mounts. Re-checked whenever the
  // mounted window changes; a no-op whenever nothing is pending.
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const target = pendingActiveRef.current;
    if (target === null) return;
    if (!virtualItems.some((row) => row.index === target)) return;
    const item = store.getState().filteredItems[target];
    if (item === undefined) return;
    store.setActiveValue(store.itemValue(item, target));
    pendingActiveRef.current = null;
  }, [virtualItems, store]);

  // Keep the active row visible: scrolling it into view mounts it (and its
  // neighbours) so the next keystroke always has a real row to move to.
  const isOpen = store.useState("isOpen");
  const activeIndex = store.useState("activeIndex");
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    virtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [isOpen, activeIndex, virtualizer]);

  // Highlight-on-open: when the list opens on a committed single-select
  // selection (the `itemToInputValue` model), highlight and scroll to it via
  // the bridge. Keyed on `isOpen` going true; a no-op for a plain search.
  const selectedItems = store.useState("selectedItems");
  const multiple = store.useState("multiple");
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened || multiple || !store._internal.config.itemToInputValue) return;
    const chosen = selectedItems[0];
    if (chosen === undefined) return;
    const index = store.getState().filteredItems.indexOf(chosen);
    if (index >= 0) store._internal.requestActive(index);
  }, [isOpen, multiple, selectedItems, store]);

  // Sync changed `items`/`loading` props into the store (created with the
  // initial values). Both setters no-op when the value is unchanged, so these
  // are inert on mount and on unrelated re-renders.
  useEffect(() => {
    store._internal.setItems(items);
  }, [items, store]);
  useEffect(() => {
    store._internal.setLoading(loading);
  }, [loading, store]);

  return store;
}
