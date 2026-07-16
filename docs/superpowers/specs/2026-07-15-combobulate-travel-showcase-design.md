# Combobulate Travel Showcase — Design Spec

**Date:** 2026-07-15
**Status:** Approved (brainstorm)
**Scope:** `examples/playground` only. The published library (`src/**`) is not
changed except where explicitly noted as an optional follow-up.

## Goal

Replace the generic 5-card playground with a polished, travel-industry
showcase — a Google-Flights-style flight-search hero plus focused pattern
cards — grounded in real airport data, demonstrating the best real-world
autocomplete patterns and proving Combobulate is styling-agnostic by rendering
each section with a different modern styling system.

## Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Structure | Flight-search **hero** + **4 pattern cards** below |
| Build approach | **Hybrid** — hero on raw primitives; cards on presets (one exception, below) |
| Styling systems | **Tailwind CSS** and **Emotion**, one labeled per section |
| Data | **Real bundled dataset** (OurAirports, ~9k scheduled-service airports) |
| Nested leaf | Country → City → **Airport** |
| Aesthetic | **Google Flights clean, light + dark** (theme toggle), blue accent |
| Library styling | Shipped `src/presets/styles.css` stays neutral & zero-runtime |

## Boundaries (non-negotiable)

1. **Nothing in `src/**` gains a Tailwind/Emotion/runtime-CSS dependency.** All
   showcase styling lives under `examples/playground`. The shipped preset stays
   plain, portable, zero-runtime CSS.
2. The playground restyles the presets via their existing `cbl-*` class hooks
   and `renderItem` — which is itself the proof that the presets are themeable.
3. If a preset limitation blocks clean theming (e.g. no `className` override),
   we work around it in the playground and **log a follow-up**, not expand lib
   scope mid-showcase.

## Data pipeline

**Source:** OurAirports open data (`airports.csv`, `countries.csv`).

**Build script:** `examples/playground/scripts/build-airports.mjs`
- Fetches the two CSVs (Node, no runtime fetch in the app).
- Filters airports to `scheduled_service = "yes"` AND non-empty `iata_code`
  AND `type ∈ {large_airport, medium_airport}` (~4–9k rows).
- Joins `iso_country` → country name from `countries.csv`.
- Emits a committed `examples/playground/src/data/airports.json` with trimmed
  fields: `{ iata, icao, name, city, country, countryCode, lat, lon }`.
- Emits `examples/playground/src/data/geography.json`: a Country → City →
  Airport tree derived from the same rows (city = `municipality`; cities with
  ≥2 airports become natural metro rollups).
- **Fallback** if web access is unavailable at build time: read from a
  maintained npm airport-data package (same output shape). The committed JSON
  means the script is run once, not on every `dev`.

**Static seeds:** a small hand-authored `popular.ts` (popular routes/airports)
for empty-state suggestions.

## Sections

Each section renders a small header: title, a "Styled with {Tailwind|Emotion}"
badge, and a one-line description of the pattern.

### 1. Flight-search hero — primitives — Tailwind — `data-testid="hero"`
- Two comboboxes (Origin / Destination) built directly on
  `Combobulate.Root/Input/List/Item` (not the preset) for full control.
- Rich rows: leading icon, `city, country` (primary), airport `name`
  (secondary), right-aligned **IATA badge**.
- **Metro rollups:** cities with multiple airports show an "All airports"
  row (e.g. London → LON) above the individual airports; item model carries
  `kind: "metro" | "airport"`.
- **Swap** button between the two fields swaps the current selections.
- **Empty state:** popular destinations from `popular.ts`.
- Filtering matches city, airport name, IATA, and country.

### 2. Nested geography — `NestedAutocomplete` — Tailwind — `data-testid="nested"`
- Country → City → Airport from `geography.json`.
- `multiple` + `selectAllUnder`: the aggregate on a **city** node =
  "all airports in this city" (e.g. all NYC airports → JFK/LGA/EWR).
- Keyboard-drivable (existing tree keyboard nav).

### 3. Async typeahead — `Autocomplete` — Emotion — `data-testid="async"`
- Mock API: `filterItems` passthrough + a debounce/`setTimeout` in the
  component querying the bundled dataset with simulated latency.
- **Loading skeleton rows** (Emotion keyframes), empty state, and the core
  live-region announcement.
- Timer cleared on unmount.
- **Fuzzy/typo tolerance** folded in here (typo-tolerant airport search, e.g.
  "amstrdam" → Amsterdam) so the fuzzy capability + its e2e coverage survive.

### 4. Multi-select chips — hook + primitives — Emotion — `data-testid="multi"`
- Built on `useAutocompleteVirtual` + primitives (NOT the preset): removing a
  chip must drive the combo's selection, which the preset owns internally.
- Selected airports render as **removable chips** above the input; removing a
  chip toggles selection via the combo.
- Emotion, prop-driven chip styles.

### 5. World airports (~9k) — `Autocomplete` — Tailwind — `data-testid="world"`
- The full dataset in one virtualized `Autocomplete`. Replaces the synthetic
  10k demo — proves virtualization at real scale.
- **Rich, taller rows** (city/country + airport name + IATA badge) that can
  wrap → **variable measured heights**, folding the old dynamic-heights
  capability + its e2e coverage into this card.

## Theming (light + dark)

- A **shared design-token layer as CSS custom properties** on `:root` and
  `.dark` (surfaces, text, border, accent, shadow, radius, spacing scale).
- **Tailwind**: `darkMode: "class"`; theme colors reference the CSS vars so
  utilities and tokens stay in sync.
- **Emotion**: an `<EmotionThemeProvider>` whose theme object reads the same
  CSS vars (or mirrors the same tokens), so both systems flip together.
- One **theme toggle** in the page header sets `.dark` on `<html>` and persists
  to `localStorage`.
- Palette: white/slate surfaces, soft shadows, rounded corners, blue accent
  (~`#1a73e8`), airy spacing, Inter/system font stack.

## Toolchain (playground only)

- **Tailwind**: `tailwindcss` + `postcss` + `autoprefixer`, `tailwind.config`
  with `darkMode: "class"` and content globbing `src/**`. A single
  `index.css` with `@tailwind` layers + the CSS-var token definitions.
- **Emotion**: `@emotion/react` + `@emotion/styled`; the `css` prop via
  `jsxImportSource: "@emotion/react"` (Vite React plugin config or per-file
  pragma on Emotion sections only).
- All added as `examples/playground` devDependencies. `src/**` package.json
  untouched.

## Page layout

- Header: product title + tagline, GitHub link, theme toggle.
- Hero section (prominent), then the 4 cards in a responsive stack/grid.
- Each card: title, "Styled with X" badge, one-line pattern description.
- Footer: link to the repo / docs.
- Responsive down to mobile widths; the body never scrolls horizontally.

## Testing — e2e remap

The current e2e suite is coupled to the old playground. Coverage is **remapped
onto the new sections so no capability loses its test**:

| Capability (old) | New home |
|---|---|
| Linear virtualization + far-item activedescendant (`ten-k`) | World airports (`world`) |
| Nested tree + aggregate mixed-state (`nested`) | Nested geography (`nested`) |
| Dynamic/measured row heights (`dynamic`) | World airports rich rows (`world`) |
| Fuzzy typo tolerance (`fuzzy`) | Async typeahead (`async`) |
| Async loading announcement (`async`) | Async typeahead (`async`) |
| — (new) | Multi-select chips add/remove (`multi`) |
| — (new) | Hero From→To select + swap (`hero`) |

Existing spec files are renamed/rewritten to target the new `data-testid`s and
content. All must pass before merge, alongside the unchanged unit suite.

## Non-goals / logged follow-ups

- **Preset `classNames` prop** — if theming via class hooks proves awkward,
  log it as a separate lib enhancement; do not add it in this effort.
- Real network/API integration — the async card simulates latency only.
- The deferred aggregate keyboard-toggle feature is unrelated and stays queued.

## Success criteria

- `bun run dev` shows the hero + 4 cards, both themes, styled as specified.
- Real airport data drives the hero, nested tree, and world card.
- Tailwind and Emotion each own their labeled sections; `src/**` has no new
  styling dependency.
- Full pipeline green: biome, tsc, unit, build, and the remapped e2e.
