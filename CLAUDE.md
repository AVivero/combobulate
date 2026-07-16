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
