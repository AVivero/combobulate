import * as Ariakit from "@ariakit/react";
import {
  type ReactNode,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
    // Dev guardrail: a combobox MUST have an accessible name, or a screen reader
    // announces only "combobox" with no purpose. Warn (dev only) when none is
    // supplied by any route — root `label`, or `aria-label`/`aria-labelledby` on
    // the Input. The effect is always called (guard inside) to keep hook order
    // stable; deps are the name inputs so it re-checks if they change.
    const hasAccessibleName =
      label != null || props["aria-label"] != null || props["aria-labelledby"] != null;
    useEffect(() => {
      if (process.env.NODE_ENV === "production" || hasAccessibleName) return;
      console.warn(
        "combobulate: the combobox has no accessible name. Pass `label` on " +
          "<Combobulate>, or `aria-label`/`aria-labelledby` on <Combobulate.Input>.",
      );
    }, [hasAccessibleName]);
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
    <Ariakit.ComboboxList
      style={{ display: "flex", flexDirection: "column", flex: "0 1 auto", minHeight: 0 }}
    >
      <div
        ref={scrollRef as React.Ref<HTMLDivElement>}
        style={{
          overflow: "auto",
          position: "relative",
          // Cap at the requested max, but flex-shrink below it to fit when the
          // popover is capped tighter by the floating layer (a flip into less
          // space) — so the list SCROLLS instead of being clipped. The
          // `min-height:0` chain up to the popover is what allows shrinking below
          // the content height; with no floating layer (in-flow usage) the popover
          // isn't capped, so `maxHeight` is the only bound.
          flex: "0 1 auto",
          minHeight: 0,
          maxHeight,
        }}
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

/** Props for {@link Combobulate}'s `Item` component. `className`/`style` and other
 * attributes are forwarded to the option element, so state can be styled with
 * `[data-active-item]` (hover/keyboard highlight), `[aria-selected]` /
 * `[data-chosen]` (the chosen value), etc. */
export type CombobulateItemProps<T> = {
  item: T;
  index: number;
} & React.HTMLAttributes<HTMLDivElement>;

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
function Item<T>({ item, index, children, ...rest }: CombobulateItemProps<T>) {
  const store = useCombobulateContext<T>();
  const multiple = store.useState("multiple");
  // Read selection reactively so chosen state stays live, and compute `chosen`
  // through the store's own identity accessor.
  const selectedItems = store.useState("selectedItems");
  const filteredCount = store.useState("filteredItems").length;
  const chosen = selectedItems.some((selected) =>
    isSameItem(selected, item, store._internal.config.getItemId),
  );
  const value = store.itemValue(item);
  return (
    <Ariakit.ComboboxItem
      // Consumer props first (className/style/…); combobulate's identity and
      // ARIA below win on conflict.
      {...rest}
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
      aria-setsize={filteredCount}
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
  const multiple = store.useState("multiple");
  const selectedItems = store.useState("selectedItems");
  // Closed is checked first: a closed combobox announces nothing, even while
  // `loading` — its live region is not on screen to narrate.
  const countMessage = !isOpen
    ? ""
    : loading
      ? "Loading…"
      : filteredItems.length === 0
        ? "No results"
        : `${filteredItems.length} result${filteredItems.length === 1 ? "" : "s"}`;
  const [message, setMessage] = useState(countMessage);

  /**
   * One announcer for two kinds of update, so a selection confirmation and a
   * debounced count can't clobber each other:
   * - Multi-select selection changes announce IMMEDIATELY — a pick/removal
   *   changes neither the input nor the result count, so the count alone would
   *   stay silent. Single-select is excluded: its confirmation is the input
   *   filling with the chosen label.
   * - Result-count changes announce DEBOUNCED, so fast typing doesn't flood the
   *   polite queue; clearing (on close) is immediate.
   * When a selection change interrupts a pending count, this effect re-runs and
   * React's cleanup clears that timer first — so the selection message wins.
   */
  const prevSelected = useRef(selectedItems.length);
  const prevCount = useRef(countMessage);
  useEffect(() => {
    const selectionChanged = multiple && selectedItems.length !== prevSelected.current;
    prevSelected.current = selectedItems.length;
    const countChanged = countMessage !== prevCount.current;
    prevCount.current = countMessage;
    if (selectionChanged) {
      setMessage(
        selectedItems.length === 0 ? "Selection cleared" : `${selectedItems.length} selected`,
      );
      return;
    }
    if (countMessage === "") {
      setMessage("");
      return;
    }
    if (countChanged) {
      const id = setTimeout(() => setMessage(countMessage), ANNOUNCE_DEBOUNCE_MS);
      return () => clearTimeout(id);
    }
  }, [countMessage, selectedItems, multiple]);
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
