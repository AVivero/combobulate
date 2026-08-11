import * as Ariakit from "@ariakit/react";
import { type ReactNode, createContext, forwardRef, useContext, useEffect, useState } from "react";
import { CombobulateProvider, useCombobulateContext } from "./context";
import { isSameItem } from "./item-utils";
import type { CombobulateStoreInternal } from "./store";
import type { CombobulateStore } from "./types";

/**
 * Compose two optional event handlers into one that calls `own` first, then the
 * consumer's — so the floating layer's Escape-to-dismiss `onKeyDown` and the
 * demo's select-all `onFocus` augment `Input`'s own handlers instead of
 * clobbering them. Returns the single defined handler unchanged when there's
 * nothing to compose (no wrapper allocated).
 */
function compose<A extends unknown[]>(
  own: ((...args: A) => void) | undefined,
  consumer: ((...args: A) => void) | undefined,
): ((...args: A) => void) | undefined {
  if (!own) return consumer;
  if (!consumer) return own;
  return (...args: A) => {
    own(...args);
    consumer(...args);
  };
}

/**
 * Carries the root's `label` down to `Input` as a fallback accessible name for
 * the combobox (a consumer's own `aria-label` on `Input` wins). Kept separate
 * from the store context — it's a presentational concern, not store state.
 */
const LabelContext = createContext<string | undefined>(undefined);

/** Props for the {@link Combobulate} root component. */
export type CombobulateRootProps<T> = {
  /** The store handle returned by `useCombobulate`. */
  store: CombobulateStore<T>;
  /** Accessible label for the combobox (fallback when `Input` has no `aria-label`). */
  label?: string;
  children: ReactNode;
};

/**
 * Root provider. Renders Ariakit's `<ComboboxProvider>` bound to the store's
 * internal combobox store — so Ariakit owns option roles, `aria-expanded`, and
 * `aria-activedescendant` — plus combobulate's own context carrying the store
 * handle to the primitives below.
 */
function CombobulateRoot<T>({ store, label, children }: CombobulateRootProps<T>) {
  // The runtime handle is always the internal variant (the public type just
  // hides `_internal`); narrow once here to reach the Ariakit store + injections.
  const internal = store as CombobulateStoreInternal<T>;
  return (
    <Ariakit.ComboboxProvider store={internal._internal.combobox}>
      <LabelContext.Provider value={label}>
        <CombobulateProvider value={internal}>{children}</CombobulateProvider>
      </LabelContext.Provider>
    </Ariakit.ComboboxProvider>
  );
}

/**
 * The combobox text input. Ariakit supplies `role="combobox"`, owns
 * `aria-expanded` (now correct — cmdk hardcoded it true) and
 * `aria-activedescendant`, and reads the input value from the store.
 *
 * Navigation (`store.onInputKeyDown`) runs in the CAPTURE phase
 * (`onKeyDownCapture`), not the bubble `onKeyDown`. In the aria-activedescendant
 * pattern Ariakit's composite installs a capture-phase key proxy that
 * re-dispatches arrow/page/home/end to the active item — moving Ariakit's own
 * `activeId` by one BEFORE a bubble handler ever runs. If combobulate navigated
 * in bubble, it would read that already-moved state and step again: every
 * ArrowDown would jump two rows. Ariakit's proxy calls our capture handler first
 * and bails on `defaultPrevented`, so intercepting an owned key here (we
 * `preventDefault` + `stopPropagation` on exactly the keys `nextIndex` claims)
 * makes combobulate the SOLE mover; unowned keys (Escape, printables) fall
 * through untouched.
 *
 * Handlers from combobulate and any same-named handler in `props` are composed
 * (ours first, then the consumer's) rather than one clobbering the other — this
 * is what lets the floating layer's Escape-to-dismiss `onKeyDown` sit alongside
 * combobulate's navigation when consumers spread `{...floating.referenceProps}`.
 */
const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    const store = useCombobulateContext();
    const label = useContext(LabelContext);
    return (
      <Ariakit.Combobox
        {...props}
        ref={ref}
        // Consumer's explicit `aria-label` wins; otherwise fall back to the
        // root `label`. Placed after the spread so the fallback can't shadow it.
        aria-label={props["aria-label"] ?? label}
        onFocus={compose<[React.FocusEvent<HTMLInputElement>]>(
          () => store.setOpen(true),
          props.onFocus,
        )}
        onBlur={compose<[React.FocusEvent<HTMLInputElement>]>(
          /**
           * Focus leaving the combobox (Tab-away, or clicking another control)
           * closes the popup. In the aria-activedescendant pattern the list
           * options aren't focusable, so blur only fires on a genuine focus-out.
           * `relatedTarget` is null when focus lands on a non-focusable/pointer
           * target (e.g. the popover chrome) — those are left to the floating
           * layer's outside-press dismiss so an in-list click doesn't close.
           */
          (event) => {
            const next = event.relatedTarget as HTMLElement | null;
            // Close only when focus genuinely LEAVES the combobox. `relatedTarget`
            // null (non-focusable/pointer target) → leave to outside-press dismiss.
            // Focus landing inside the popup listbox must NOT close: dragging the
            // list's scrollbar shifts focus onto the `tabindex=-1` listbox (which
            // contains the scroll container), and an option can take focus too —
            // neither is a real focus-out.
            if (next && !next.closest('[role="listbox"]')) store.setOpen(false);
          },
          props.onBlur,
        )}
        onKeyDownCapture={compose<[React.KeyboardEvent<HTMLInputElement>]>(
          store.onInputKeyDown,
          props.onKeyDownCapture,
        )}
        onChange={compose<[React.ChangeEvent<HTMLInputElement>]>((event) => {
          store.setInputValue(event.target.value);
          if (!store.getState().isOpen) store.setOpen(true);
        }, props.onChange)}
      />
    );
  },
);

/** Props for {@link Combobulate}'s `List` component. */
export type CombobulateListProps<T> = {
  /** Render-prop invoked once per visible (virtualized) item. */
  children: (item: T, index: number) => ReactNode;
  /** Max height (px) of the scroll viewport. Default 300. */
  maxHeight?: number;
};

/**
 * Virtualized scroll container. Ariakit's `<ComboboxList>` supplies the listbox
 * role; the inner scroll element is ours so TanStack Virtual can measure it.
 * The virtualizer and scroll ref ride on the store internals (injected by the
 * hook), so this reads everything from the store handle alone.
 */
function List<T>({ children, maxHeight = 300 }: CombobulateListProps<T>) {
  const store = useCombobulateContext<T>();
  const isOpen = store.useState("isOpen");
  const filteredItems = store.useState("filteredItems");
  const { virtualizer, scrollRef } = store._internal;
  if (!isOpen || virtualizer === null) return null;
  const rows = virtualizer.getVirtualItems();
  return (
    <Ariakit.ComboboxList>
      <div
        ref={scrollRef as React.Ref<HTMLDivElement>}
        style={{ overflow: "auto", position: "relative", maxHeight }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {rows.map((row) => {
            const item = filteredItems[row.index];
            if (item === undefined) return null;
            return (
              <div
                key={row.key}
                data-index={row.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${row.start}px)`,
                }}
              >
                {children(item, row.index)}
              </div>
            );
          })}
        </div>
      </div>
    </Ariakit.ComboboxList>
  );
}

/** Props for {@link Combobulate}'s `Item` component. */
export type CombobulateItemProps<T> = {
  item: T;
  index: number;
  children: ReactNode;
};

/**
 * A single option row.
 *
 * Ariakit supplies `role="option"` and drives the active highlight through
 * `aria-activedescendant` (not per-item `aria-selected`), so we own the
 * accessibility state Ariakit leaves to us: `aria-setsize`/`aria-posinset`
 * across the **whole filtered list** (not just the mounted window — the reason
 * this library exists), and `aria-selected` marking the **chosen** value
 * (single *and* multi), distinct from the highlight. For multi-select we also
 * express chosen state as `aria-checked`. Ariakit's own click side effects
 * (set input value / set selection / hide) are disabled — combobulate owns
 * selection and open state via `store.select`.
 */
function Item<T>({ item, index, children }: CombobulateItemProps<T>) {
  const store = useCombobulateContext<T>();
  const multiple = store.useState("multiple");
  // Read selection reactively so chosen state stays live, and compute `chosen`
  // through the store's own identity accessor.
  const selectedItems = store.useState("selectedItems");
  const chosen = selectedItems.some((selected) =>
    isSameItem(selected, item, store._internal.config.getItemId),
  );
  const value = store.itemValue(item);
  return (
    <Ariakit.ComboboxItem
      id={value}
      value={value}
      // Highlight the row on mouse hover (stamps `data-active-item`). Ariakit
      // defaults `focusOnHover` to false for an editable combobox, which left
      // rows un-highlighted on hover even though keyboard nav highlighted them.
      // The active-row bridge scrolls with `align: "auto"`, so highlighting an
      // already-visible hovered row doesn't jog the list.
      focusOnHover
      setValueOnClick={false}
      selectValueOnClick={false}
      hideOnClick={false}
      onClick={() => store.select(item)}
      aria-setsize={store.useState("filteredItems").length}
      aria-posinset={index + 1}
      aria-selected={chosen ? true : undefined}
      aria-checked={multiple ? chosen : undefined}
      data-chosen={chosen ? "" : undefined}
    >
      {children}
    </Ariakit.ComboboxItem>
  );
}

/**
 * Rendered when there are no filtered items. Presentational only — NOT a live
 * region. `LiveRegion` is the sole `role="status"` announcer; making `Empty` a
 * second one (e.g. via `<output>`, which carries an implicit `role="status"`)
 * would announce "No results" twice. A plain `<div>` with no role also lints
 * clean, since Biome's `useSemanticElements` only fires when a `role` is set.
 */
function Empty({ children }: { children: ReactNode }) {
  const store = useCombobulateContext();
  const isOpen = store.useState("isOpen");
  const filteredItems = store.useState("filteredItems");
  if (!isOpen || filteredItems.length > 0) return null;
  return <div>{children}</div>;
}

/**
 * How long the live region waits for the count to settle before announcing.
 * Fast typing changes the result count on every keystroke; without this, each
 * change queues another polite announcement and the screen reader trails the
 * user with "12 results… 8 results… 5 results".
 */
const ANNOUNCE_DEBOUNCE_MS = 200;

/**
 * Visually-hidden polite live region announcing result counts and loading
 * state. The wrapper is off-screen but readable by assistive tech. Content
 * changes are debounced so rapid typing doesn't flood the polite queue;
 * clearing (on close) is immediate, and the current value shows on mount.
 */
function LiveRegion() {
  const store = useCombobulateContext();
  const isOpen = store.useState("isOpen");
  const loading = store.useState("loading");
  const filteredItems = store.useState("filteredItems");
  // Closed is checked first: a closed combobox announces nothing, even while
  // `loading` — its live region is not on screen to narrate.
  const announcement = !isOpen
    ? ""
    : loading
      ? "Loading…"
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;
  const [message, setMessage] = useState(announcement);
  useEffect(() => {
    if (announcement === "") {
      setMessage("");
      return;
    }
    const id = setTimeout(() => setMessage(announcement), ANNOUNCE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [announcement]);
  return (
    // `<output>` carries an implicit `role="status"` (see `Empty` above),
    // satisfying Biome's `useSemanticElements` rule.
    <output
      aria-live="polite"
      aria-atomic={true}
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {message}
    </output>
  );
}

/**
 * Headless Combobulate primitives. The default export is the callable root
 * (`<Combobulate store={store}>`); the sub-components are attached as
 * properties. The positioning `Popover` lives in the floating layer and is
 * merged onto this object by the package barrel (the lego rule keeps core free
 * of positioning concerns).
 */
export const Combobulate = Object.assign(CombobulateRoot, {
  Input,
  List,
  Item,
  Empty,
  LiveRegion,
});
