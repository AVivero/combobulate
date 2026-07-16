# Combobulate — project conventions

Guidance for anyone (human or agent) working in this repo. These are binding
project rules, not suggestions.

## TypeScript

- **Favor `type` aliases over `interface`.** Use `type X = { ... }` for object
  shapes. When one type extends another, use an intersection
  (`type B = A & { ... }`) rather than `interface B extends A`.
  - Why: one uniform syntax across object/union/mapped types; no implicit
    declaration merging (a published library should not let consumers silently
    augment its public types, and local `type Node` cleanly shadows DOM globals
    instead of merging with them).
  - The only reason to reach for something other than a plain `type` is a
    genuine utility/computed type (`Pick`, `Omit`, mapped types) — those are
    already `type` by necessity.

## Abstraction & duplication

- **Prefer a little duplication over a premature or speculative abstraction.**
  A helper, option, or layer must earn its place with a real, present consumer.
  - Don't build features ahead of need (YAGNI) — no options nothing calls, no
    hooks nothing uses.
  - Don't extract a factory/indirection that serves a single caller just to
    "separate concerns"; inline it.
  - Don't abstract two similar blocks *only* to remove the duplication — two
    near-identical small files (e.g. the context providers) are cheaper to read
    and change than one generic factory. Wait for the third case and a real
    shared requirement before generalizing.
  - Extraction is justified when logic is reused across several call sites AND
    a change should propagate to all of them (e.g. `isSameItem`, `toChangeValue`).

## Tooling

- Package manager + test runner: **Bun**. `bun test`, `bun run lint`,
  `bun run typecheck`, `bun run build`, `bun run e2e`.
- Lint/format: **Biome**. Zero warnings required — an inert `biome-ignore`
  emits an unused-suppression warning, so only add one that actually suppresses.
  Biome here bans non-null `!` (`noNonNullAssertion`), unchecked index access,
  and assignment-in-expression (use block-body arrows to capture).
- Run `bunx biome check --write src/` to autofix formatting.

## Architecture (the "lego rule")

- `src/core/*` and the base primitives (Root/Input/List/Item/Empty/LiveRegion)
  contain **no tree concepts** (no expandedIds/depth/parentId/getChildren).
  The tree layer (`src/tree/*`) drives core only through its public API.
