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

## ⚠️ Upgrading `@ariakit/react` (and the pinned Ariakit store packages)

All three Ariakit packages are pinned **EXACT** in `package.json`:
`@ariakit/react` (`0.4.37`), `@ariakit/components` (`0.1.10`), and `@ariakit/store`
(`0.1.8`). This is deliberate:

- There's no public `@ariakit/core` at this version; the framework-agnostic
  combobox store lives in `@ariakit/components` / `@ariakit/store`, which
  `src/core/store.ts` imports directly. They disclaim semver (breaking changes
  land in patch/minor), so they're pinned exact.
- `@ariakit/react` is pinned exact too so its transitive versions of those two
  packages always match ours — the install must dedupe to a **single** store
  instance, or the store we hand `<ComboboxProvider>` won't share identity with
  the one Ariakit's `<Combobox>` drives, silently breaking `aria-activedescendant`,
  option roles, and selection. A `~`/`^` range would let a consumer's install
  drift to a version whose internal pins differ. Bump the three together as one
  lockstep change, and re-verify the dedupe with `bun pm ls`.

## ⚠️ Load-bearing couplings to Ariakit / react-virtual internals

Two things couple to **internal** behavior of the underlying libraries. Both are
guarded only by the real-browser e2e suite (the unit tests use fakes and stay
green even if these regress), so **when you bump `@ariakit/react` or
`@tanstack/react-virtual` you MUST run `bun run e2e`** (cross-browser) and confirm
it's green — do not weaken the assertions.

1. **Capture-phase navigation** (`src/core/primitives.tsx`). combobulate's key
   handler runs on `onKeyDownCapture`, not bubble `onKeyDown`. In the
   aria-activedescendant pattern Ariakit installs a capture-phase key proxy that
   moves its own `activeId` before a bubble handler would run — so navigating in
   bubble would double-step every ArrowDown. We intercept owned keys in capture
   (`preventDefault` + `stopPropagation`) to be the sole mover; unowned keys fall
   through. Enter-to-select is delegated to Ariakit re-dispatching a click to the
   active option (the `Item`'s `onClick` runs `store.select`).

2. **The scroll-then-set jump bridge** (`src/core/use-combobulate.ts`,
   `requestActive` / `pendingActiveRef`). Ariakit only highlights *mounted* rows,
   so a jump target outside the virtualized window is scrolled into view first,
   then committed active once its row mounts. This is the whole differentiator:
   full-list `aria-setsize` / `aria-posinset` and jump keys
   (`Ctrl`/`Cmd`+`Home`/`End`, `PageUp`/`PageDown`) that target the true ends of
   ~3,300 rows, not the mounted window.

`e2e/jump-keys.e2e.ts` and `e2e/virtualized-combobox.e2e.ts` assert this end to
end (posinset monotonic across the window, End lands on the true last item, the
active row stays mounted and in view). CI runs `bun run e2e` as a required check
for the same reason.
