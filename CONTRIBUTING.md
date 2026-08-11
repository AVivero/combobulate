# Contributing to combobulate

## Development

```sh
bun install
bun test        # unit + component tests (happy-dom)
bun run e2e      # Playwright end-to-end tests against the examples app
bun run typecheck
bun run lint     # Biome, zero warnings required
bun run build    # tsup → dist/
bun run dev
```

## ⚠️ Upgrading `@ariakit/react`

`@ariakit/react` is pinned `~` (patch-only). It has no public `@ariakit/core` at
`~0.4.37`; the framework-agnostic combobox store lives in `@ariakit/components`
and `@ariakit/store`, which `src/core/store.ts` imports directly. Those two are
pinned **EXACT** (`0.1.10` / `0.1.8`) in `package.json` because they disclaim
semver (breaking changes in patch/minor) and because the exact pins must match
`@ariakit/react`'s transitive versions so the install dedupes to a single store
instance (a duplicate breaks store-identity interop with `<Combobox>`). When you
bump `@ariakit/react`, re-verify these three pins together — they are
load-bearing (see the comment above the imports in `src/core/store.ts`).

## ⚠️ Upgrading `cmdk` or `@tanstack/react-virtual`

These two are pinned with `~` (patch-only) in `package.json` **on purpose**, not
by accident.

Combobulate's jump-key navigation (Home / End / PageUp / PageDown over a
virtualized list) works around a cmdk limitation: cmdk only recomputes the
input's `aria-activedescendant` from its **own** pointer/keyboard handlers, never
from a controlled `<Command value>` change. `src/core/use-combobulate.ts`
(`onInputKeyDown`) therefore synthesizes DOM events — a `scroll` event to force
react-virtual's synchronous range commit, then a `pointermove` (with a
neighbour-row "wiggle" to defeat cmdk's `Object.is` value guard) — so cmdk's own
recompute path runs. Every one of those lines is commented with *why* it exists;
read them before touching that function.

This couples to **internal** behavior of both libraries:

- cmdk's `selectedItemId` recompute path and its value-guard (`cmdk 1.1.x`).
- react-virtual's synchronous `flushSync`-on-scroll-notify (`@tanstack/react-virtual 3.14.x`).

The **unit tests do not cover this coupling** — they assert `activeIndex`, which
the fallback path satisfies, so `bun test` can stay green even if the real
`aria-activedescendant` behavior regresses. Only **`e2e/jump-keys.e2e.ts`**
exercises the real browser behavior.

**So: when you bump either dependency, you MUST run `bun run e2e` (at minimum
`e2e/jump-keys.e2e.ts`) and confirm all three jump-key tests still pass.** They
assert that End lands on the true last item (`aria-posinset === aria-setsize`
over ~3,300 rows), Home on the first, and PageDown a page down — the library's
differentiator. If they fail after an upgrade, the coupling in `onInputKeyDown`
needs re-verification against the new internals; do not weaken the assertions.

CI must run `bun run e2e` as a required check for the same reason.
