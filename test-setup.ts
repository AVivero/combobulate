import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// happy-dom has no real layout engine: every element reports 0 for
// offsetWidth/offsetHeight (and getBoundingClientRect), regardless of CSS.
// TanStack Virtual's `calculateRange` treats a zero-size scroll container as
// "nothing is visible" and short-circuits to an empty range, so any test
// that renders a virtualized list would otherwise see zero rows no matter
// how many items are provided. Stub non-zero dimensions globally so
// virtualized lists can actually measure a viewport under test.
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return 300;
  },
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return 300;
  },
});
