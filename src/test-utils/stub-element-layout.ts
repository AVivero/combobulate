/**
 * happy-dom has no real layout engine: every element reports 0 for
 * `offsetWidth`/`offsetHeight` (and `getBoundingClientRect`), regardless of
 * CSS. TanStack Virtual's `calculateRange` treats a zero-size scroll
 * container as "nothing is visible" and short-circuits to an empty range, so
 * any test that renders a virtualized list would otherwise see zero rows no
 * matter how many items are provided.
 *
 * This module stubs non-zero dimensions on `HTMLElement.prototype` for the
 * lifetime of a test file, so that virtualized lists actually render rows
 * under happy-dom. Callers are expected to install/restore the stub around
 * their own tests (e.g. via `beforeAll`/`afterAll`) rather than have it
 * applied globally, so unrelated test files are unaffected.
 */
export const STUBBED_ELEMENT_SIZE_PX = 300;

/**
 * Overrides `HTMLElement.prototype.offsetHeight`/`offsetWidth` to report
 * {@link STUBBED_ELEMENT_SIZE_PX} instead of happy-dom's default of `0`.
 *
 * @returns A restore function that puts back the original property
 * descriptors (or deletes the override if there was none), undoing the stub.
 */
export function stubElementLayout(): () => void {
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return STUBBED_ELEMENT_SIZE_PX;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return STUBBED_ELEMENT_SIZE_PX;
    },
  });

  return () => {
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
    }
    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "offsetWidth");
    }
  };
}
