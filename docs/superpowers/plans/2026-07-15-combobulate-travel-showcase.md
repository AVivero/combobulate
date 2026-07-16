# Combobulate Travel Showcase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic playground with a Google-Flights-style travel
showcase — a flight-search hero plus four pattern cards — on real airport data,
styled with Tailwind and Emotion, proving Combobulate is styling-agnostic.

**Architecture:** All work under `examples/playground`. A one-shot build script
turns OurAirports open data into committed JSON. A hero built on the raw
primitives; four cards on the presets (one on the hook). A shared CSS-variable
token layer themes both Tailwind and Emotion from a single light/dark toggle.

**Tech Stack:** React 19, Vite, Combobulate (via workspace alias), Tailwind CSS,
Emotion, Bun (scripts + tests), Playwright (e2e).

Spec: `docs/superpowers/specs/2026-07-15-combobulate-travel-showcase-design.md`

## Global Constraints

- **Nothing in `src/**` changes.** No Tailwind/Emotion/runtime-CSS dependency
  reaches the library. The shipped `src/presets/styles.css` stays as-is.
- All new deps are `examples/playground` devDependencies.
- Real data only: OurAirports, filtered to `scheduled_service="yes"` + non-empty
  `iata_code` + `type ∈ {large_airport, medium_airport}`. Fallback: npm
  `airport-data` if the fetch fails. The JSON is committed (no runtime fetch).
- Both themes must work; the page body never scrolls horizontally.
- Each section renders a header with a "Styled with {Tailwind|Emotion}" badge.
- `data-testid`s are exactly: `hero`, `nested`, `async`, `multi`, `world`.
- Biome/tsc/unit/build/e2e all green before merge.

---

## File Structure

```
examples/playground/
  package.json                 # + tailwind/postcss/autoprefixer, @emotion/*, csv-parse
  tailwind.config.ts           # darkMode: "class", content: src/**, tokens via CSS vars
  postcss.config.js
  vite.config.ts               # + @emotion/react jsxImportSource (Emotion files only)
  scripts/
    build-airports.ts          # bun script: fetch + transform -> committed JSON
    transform.ts               # PURE: toAirport(row), buildGeography(airports)
    transform.test.ts          # unit tests for the pure transforms
  src/
    data/
      airports.json            # committed output (~9k)
      geography.json           # committed Country->City->Airport tree
      popular.ts               # hand-authored empty-state seeds
      types.ts                 # Airport, GeoNode types
    theme/
      tokens.css               # CSS-var token layer (:root + .dark) + @tailwind
      ThemeToggle.tsx          # light/dark toggle, localStorage, sets .dark on <html>
      emotion-theme.ts         # Emotion theme object mirroring the CSS vars
    sections/
      Hero.tsx                 # primitives + Tailwind
      NestedGeography.tsx      # NestedAutocomplete + Tailwind
      AsyncTypeahead.tsx       # Autocomplete + Emotion
      MultiSelectChips.tsx     # hook + primitives + Emotion
      WorldAirports.tsx        # Autocomplete + Tailwind
    components/
      Section.tsx              # card wrapper: title, badge, description
      AirportRow.tsx           # shared rich row (icon, city/country, name, IATA badge)
    app.tsx                    # page shell: header, hero, cards, footer
    main.tsx                   # imports tokens.css + combobulate/styles.css
e2e/
  hero.e2e.ts                  # NEW
  nested-tree.e2e.ts           # rewritten for geography data
  async-typeahead.e2e.ts       # renamed from fuzzy-async, retargeted
  multi-select.e2e.ts          # NEW
  world-airports.e2e.ts        # renamed from linear-combobox + dynamic-heights merge
```

---

### Task 1: Playground toolchain — Tailwind + Emotion + token layer

**Files:**
- Modify: `examples/playground/package.json`
- Create: `examples/playground/tailwind.config.ts`, `postcss.config.js`,
  `examples/playground/src/theme/tokens.css`,
  `examples/playground/src/theme/emotion-theme.ts`
- Modify: `examples/playground/vite.config.ts`, `examples/playground/src/main.tsx`

**Interfaces:**
- Produces: `tokens.css` defining CSS vars `--cbl-bg, --cbl-surface, --cbl-text,
  --cbl-text-muted, --cbl-border, --cbl-accent, --cbl-accent-contrast,
  --cbl-shadow, --cbl-radius` on `:root` and `.dark`.
- Produces: `emotionTheme` object exposing the same tokens as
  `theme.color.bg` etc. (reads `var(--cbl-*)` strings).

- [ ] **Step 1: Add devDependencies**

In `examples/playground/package.json` devDependencies add:
`tailwindcss ^3.4`, `postcss ^8`, `autoprefixer ^10`, `@emotion/react ^11`,
`@emotion/styled ^11`, `csv-parse ^5`. Run `bun install` in the playground.

Run: `cd examples/playground && bun install`
Expected: installs without error.

- [ ] **Step 2: postcss + tailwind config**

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```
`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--cbl-bg)",
        surface: "var(--cbl-surface)",
        text: "var(--cbl-text)",
        muted: "var(--cbl-text-muted)",
        border: "var(--cbl-border)",
        accent: "var(--cbl-accent)",
        "accent-contrast": "var(--cbl-accent-contrast)",
      },
      borderRadius: { token: "var(--cbl-radius)" },
      boxShadow: { token: "var(--cbl-shadow)" },
    },
  },
} satisfies Config;
```

- [ ] **Step 3: token layer**

`src/theme/tokens.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --cbl-bg: #f8fafc;
  --cbl-surface: #ffffff;
  --cbl-text: #0f172a;
  --cbl-text-muted: #64748b;
  --cbl-border: #e2e8f0;
  --cbl-accent: #1a73e8;
  --cbl-accent-contrast: #ffffff;
  --cbl-shadow: 0 1px 3px rgb(15 23 42 / 0.08), 0 1px 2px rgb(15 23 42 / 0.04);
  --cbl-radius: 12px;
  color-scheme: light;
}
.dark {
  --cbl-bg: #0b1220;
  --cbl-surface: #111a2b;
  --cbl-text: #e2e8f0;
  --cbl-text-muted: #94a3b8;
  --cbl-border: #1e293b;
  --cbl-accent: #4f96ff;
  --cbl-accent-contrast: #06122a;
  --cbl-shadow: 0 1px 3px rgb(0 0 0 / 0.5);
  --cbl-radius: 12px;
  color-scheme: dark;
}
body { background: var(--cbl-bg); color: var(--cbl-text); }
```

`src/theme/emotion-theme.ts`:
```ts
export const emotionTheme = {
  color: {
    bg: "var(--cbl-bg)",
    surface: "var(--cbl-surface)",
    text: "var(--cbl-text)",
    muted: "var(--cbl-text-muted)",
    border: "var(--cbl-border)",
    accent: "var(--cbl-accent)",
    accentContrast: "var(--cbl-accent-contrast)",
  },
  shadow: "var(--cbl-shadow)",
  radius: "var(--cbl-radius)",
} as const;
export type EmotionTheme = typeof emotionTheme;
```

- [ ] **Step 4: Emotion css-prop + main.tsx**

In `vite.config.ts`, configure the React plugin for Emotion's `css` prop:
`react({ jsxImportSource: "@emotion/react", babel: { plugins: ["@emotion/babel-plugin"] } })`
(add `@emotion/babel-plugin` to devDeps). Keep the existing `combobulate` alias.

`src/main.tsx` imports order:
```tsx
import "./theme/tokens.css";
import "combobulate/styles.css";
```

- [ ] **Step 5: Verify build**

Run: `cd examples/playground && bun run build`
Expected: Vite build succeeds, Tailwind utilities and tokens.css are emitted.

- [ ] **Step 6: Commit**
```bash
git add examples/playground
git commit -m "chore(playground): add Tailwind + Emotion + theme token layer"
```

---

### Task 2: Data pipeline — pure transforms (TDD), build script, committed JSON

**Files:**
- Create: `examples/playground/scripts/transform.ts`,
  `examples/playground/scripts/transform.test.ts`,
  `examples/playground/scripts/build-airports.ts`,
  `examples/playground/src/data/types.ts`, `examples/playground/src/data/popular.ts`
- Produced (committed): `src/data/airports.json`, `src/data/geography.json`

**Interfaces:**
- Produces: `Airport = { iata: string; icao: string; name: string; city: string;
  country: string; countryCode: string; lat: number; lon: number }`.
- Produces: `GeoNode = { id: string; label: string; kind: "country"|"city"|"airport";
  airport?: Airport; children?: GeoNode[] }`.
- Produces pure `toAirport(row: Record<string,string>, countryName: (code:string)=>string): Airport | null`
  (null if it fails the scheduled-service/IATA/type filter).
- Produces pure `buildGeography(airports: Airport[]): GeoNode[]` (Country → City → Airport,
  sorted; cities/countries sorted by label; airports by iata).

- [ ] **Step 1: Types**

`src/data/types.ts` — declare `Airport` and `GeoNode` as above (use `type`, per repo convention).

- [ ] **Step 2: Failing transform tests**

`scripts/transform.test.ts`:
```ts
import { expect, test } from "bun:test";
import { buildGeography, toAirport } from "./transform";

const name = (c: string) => (c === "US" ? "United States" : c);
const row = (o: Record<string, string>) => ({
  iata_code: "", icao_code: "", name: "", municipality: "", iso_country: "",
  type: "", scheduled_service: "", latitude_deg: "0", longitude_deg: "0", ...o,
});

test("toAirport keeps scheduled large/medium airports with an IATA code", () => {
  const a = toAirport(row({
    iata_code: "JFK", icao_code: "KJFK", name: "John F Kennedy Intl",
    municipality: "New York", iso_country: "US", type: "large_airport",
    scheduled_service: "yes", latitude_deg: "40.63", longitude_deg: "-73.77",
  }), name);
  expect(a).toEqual({
    iata: "JFK", icao: "KJFK", name: "John F Kennedy Intl", city: "New York",
    country: "United States", countryCode: "US", lat: 40.63, lon: -73.77,
  });
});

test("toAirport rejects no-IATA, unscheduled, or heliport rows", () => {
  expect(toAirport(row({ iata_code: "", scheduled_service: "yes", type: "large_airport" }), name)).toBeNull();
  expect(toAirport(row({ iata_code: "XXX", scheduled_service: "no", type: "large_airport" }), name)).toBeNull();
  expect(toAirport(row({ iata_code: "XXX", scheduled_service: "yes", type: "heliport" }), name)).toBeNull();
});

test("buildGeography nests Country -> City -> Airport, sorted", () => {
  const jfk = toAirport(row({ iata_code: "JFK", name: "JFK", municipality: "New York", iso_country: "US", type: "large_airport", scheduled_service: "yes" }), name);
  const lga = toAirport(row({ iata_code: "LGA", name: "LaGuardia", municipality: "New York", iso_country: "US", type: "large_airport", scheduled_service: "yes" }), name);
  if (!jfk || !lga) throw new Error("fixture");
  const tree = buildGeography([lga, jfk]);
  expect(tree[0]?.kind).toBe("country");
  expect(tree[0]?.children?.[0]?.kind).toBe("city");
  expect(tree[0]?.children?.[0]?.children?.map((n) => n.id)).toEqual(["JFK", "LGA"]);
});
```

Run: `cd examples/playground && bun test scripts/transform.test.ts`
Expected: FAIL (transform.ts not written).

- [ ] **Step 3: Implement transforms**

`scripts/transform.ts`:
```ts
import type { Airport, GeoNode } from "../src/data/types";

const KEEP_TYPES = new Set(["large_airport", "medium_airport"]);

export function toAirport(
  row: Record<string, string>,
  countryName: (code: string) => string,
): Airport | null {
  const iata = row.iata_code?.trim();
  if (!iata) return null;
  if (row.scheduled_service !== "yes") return null;
  if (!KEEP_TYPES.has(row.type)) return null;
  return {
    iata,
    icao: row.icao_code?.trim() ?? "",
    name: row.name?.trim() ?? "",
    city: row.municipality?.trim() ?? "",
    country: countryName(row.iso_country),
    countryCode: row.iso_country,
    lat: Number(row.latitude_deg) || 0,
    lon: Number(row.longitude_deg) || 0,
  };
}

export function buildGeography(airports: Airport[]): GeoNode[] {
  const countries = new Map<string, Map<string, Airport[]>>();
  for (const a of airports) {
    const city = a.city || "Other";
    const byCity = countries.get(a.countryCode) ?? new Map<string, Airport[]>();
    const list = byCity.get(city) ?? [];
    list.push(a);
    byCity.set(city, list);
    countries.set(a.countryCode, byCity);
  }
  const nodes: GeoNode[] = [];
  for (const [code, byCity] of countries) {
    const cityNodes: GeoNode[] = [];
    for (const [city, list] of byCity) {
      cityNodes.push({
        id: `${code}-${city}`,
        label: city,
        kind: "city",
        children: [...list]
          .sort((x, y) => x.iata.localeCompare(y.iata))
          .map((a) => ({ id: a.iata, label: `${a.name} (${a.iata})`, kind: "airport" as const, airport: a })),
      });
    }
    cityNodes.sort((x, y) => x.label.localeCompare(y.label));
    nodes.push({ id: code, label: list0(byCity), kind: "country", children: cityNodes });
  }
  nodes.sort((x, y) => x.label.localeCompare(y.label));
  return nodes;
}

// country label = the country name carried on any of its airports
function list0(byCity: Map<string, Airport[]>): string {
  for (const list of byCity.values()) {
    const first = list[0];
    if (first) return first.country;
  }
  return "";
}
```

Run: `cd examples/playground && bun test scripts/transform.test.ts`
Expected: PASS.

- [ ] **Step 4: Build script**

`scripts/build-airports.ts` — fetch both CSVs, parse with `csv-parse/sync`,
map rows through `toAirport`, write `airports.json`, then `buildGeography` →
`geography.json`. Guard the run with `if (import.meta.main)`. On fetch failure,
print a clear message pointing to the npm `airport-data` fallback and exit 1.
```ts
import { writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { buildGeography, toAirport } from "./transform";
import type { Airport } from "../src/data/types";

const BASE = "https://davidmegginson.github.io/ourairports-data";

async function csv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return parse(await res.text(), { columns: true, skip_empty_lines: true });
}

async function main() {
  const [airportRows, countryRows] = await Promise.all([
    csv(`${BASE}/airports.csv`),
    csv(`${BASE}/countries.csv`),
  ]);
  const countryName = new Map(countryRows.map((r) => [r.code, r.name]));
  const airports: Airport[] = [];
  for (const r of airportRows) {
    const a = toAirport(r, (c) => countryName.get(c) ?? c);
    if (a) airports.push(a);
  }
  airports.sort((x, y) => x.city.localeCompare(y.city) || x.iata.localeCompare(y.iata));
  writeFileSync("src/data/airports.json", JSON.stringify(airports));
  writeFileSync("src/data/geography.json", JSON.stringify(buildGeography(airports)));
  console.log(`wrote ${airports.length} airports`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    console.error("Fallback: install the npm 'airport-data' package and adapt build-airports.ts.");
    process.exit(1);
  });
}
```

Run: `cd examples/playground && bun scripts/build-airports.ts`
Expected: prints "wrote N airports" (N in the thousands); the two JSON files exist.

- [ ] **Step 5: Popular seeds**

`src/data/popular.ts` — export `POPULAR: Airport[]` of ~8 well-known airports
(JFK, LHR, CDG, DXB, SIN, LAX, HND, BCN) hand-authored from the committed data.

- [ ] **Step 6: Commit**
```bash
git add examples/playground/scripts examples/playground/src/data
git commit -m "feat(playground): real airport dataset + pure transforms"
```

---

### Task 3: Page shell + theme toggle

**Files:**
- Create: `src/theme/ThemeToggle.tsx`, `src/components/Section.tsx`
- Rewrite: `src/app.tsx`

**Interfaces:**
- Produces `<Section title badge description data-testid>` wrapper (Tailwind).
- Produces `<ThemeToggle/>` — toggles `.dark` on `document.documentElement`,
  persists to `localStorage["cbl-theme"]`, initializes from storage/system.

- [ ] **Step 1: ThemeToggle**
```tsx
import { useEffect, useState } from "react";

function initialDark(): boolean {
  const saved = localStorage.getItem("cbl-theme");
  if (saved) return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(initialDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("cbl-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="rounded-token border border-border px-3 py-1.5 text-sm text-text"
      aria-pressed={dark}
    >
      {dark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
```

- [ ] **Step 2: Section wrapper**
```tsx
import type { ReactNode } from "react";

export function Section({ title, badge, description, testid, children }: {
  title: string; badge: "Tailwind" | "Emotion"; description: string;
  testid: string; children: ReactNode;
}) {
  return (
    <section data-testid={testid} className="rounded-token border border-border bg-surface p-5 shadow-token">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          Styled with {badge}
        </span>
      </div>
      <p className="mb-4 text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: app.tsx shell** — header (title, tagline, GitHub link, `<ThemeToggle/>`),
  a `<main>` max-width column with the hero then the four `<Section>` cards, footer.
  Import the section components (stubbed to render a placeholder until their tasks).

- [ ] **Step 4: Verify** — `bun run dev`, confirm the shell renders in both themes
  (toggle works, no horizontal scroll). Run: `bun run build`. Expected: success.

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(playground): page shell + light/dark theme toggle"
```

---

### Task 4: Flight-search hero (primitives + Tailwind) — `data-testid="hero"`

**Files:**
- Create: `src/components/AirportRow.tsx`, `src/sections/Hero.tsx`
- Modify: `src/app.tsx` (mount Hero), Create `e2e/hero.e2e.ts`

**Interfaces:**
- Consumes: `useAutocompleteVirtual`, `Combobulate` primitives, `airports.json`,
  `POPULAR`. Item model: `HeroItem = Airport & { kind: "airport" } | { kind:
  "metro"; iata: string; city: string; country: string; name: string }`.
- Produces: an exported `Hero` with two comboboxes + swap.

- [ ] **Step 1: AirportRow** — a presentational row: leading ✈/📍 icon,
  `city, country` bold + airport `name` muted, right-aligned IATA badge
  (`rounded bg-accent/10 text-accent px-1.5 font-mono`). Pure Tailwind.

- [ ] **Step 2: Failing e2e** `e2e/hero.e2e.ts`:
```ts
import { expect, test } from "@playwright/test";
test("hero selects an origin airport and swaps", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByTestId("hero");
  const from = hero.getByRole("combobox").first();
  await from.click();
  await from.fill("new york");
  await hero.getByRole("option").first().click();
  await expect(from).toHaveValue(/New York|JFK|LGA|EWR/);
  // swap moves the origin value into the destination field
  const origin = await from.inputValue();
  await hero.getByRole("button", { name: /swap/i }).click();
  await expect(hero.getByRole("combobox").nth(1)).toHaveValue(origin);
});
```
Run: `bun run e2e hero` → FAIL.

- [ ] **Step 3: Build metro rollups** — a pure helper `withMetros(airports)`
  that, per city with ≥2 airports, prepends a `metro` item labelled
  "{City} — All airports". Filter matches city/name/iata/country
  (case/diacritic-insensitive — reuse a small local normalize).

- [ ] **Step 4: Hero component** — two `useAutocompleteVirtual` instances over
  the metro-augmented list with a custom `filterItems`; `Combobulate.Root/Input/
  List/Item` rendering `AirportRow`; empty state renders `POPULAR`; a swap button
  (`aria-label="Swap origin and destination"`) swaps selection + input values via
  `setInputValue`/`setSelectedItems`. Tailwind throughout; input row is a
  two-field grid with the swap control between.

- [ ] **Step 5: e2e passes** — Run: `bun run e2e hero`. Expected: PASS.

- [ ] **Step 6: Commit** `git commit -am "feat(playground): flight-search hero"`

---

### Task 5: Nested geography card (NestedAutocomplete + Tailwind) — `data-testid="nested"`

**Files:** Create `src/sections/NestedGeography.tsx`; modify `app.tsx`;
rewrite `e2e/nested-tree.e2e.ts` for geography data.

- [ ] **Step 1: Failing e2e** — rewrite `nested-tree.e2e.ts` to open the
  `nested` section, assert `role="tree"` with expandable `treeitem`s, → / ↓
  keyboard nav keeps `aria-activedescendant` mounted (deep list), and the
  city-level select-all aggregate reports `aria-checked="mixed"` after selecting
  one airport under it. Run: `bun run e2e nested-tree` → FAIL.

- [ ] **Step 2: Component** — `NestedAutocomplete` over `geography.json` with
  `getChildren`, `getItemId=(n)=>n.id`, `getSearchText=(n)=>n.label`, `multiple`,
  `selectAllUnder`. `renderItem` shows a small kind glyph (country/city/airport)
  + label; airports show an IATA badge. Style the `cbl-*` hooks + tree rows with
  Tailwind (via `@layer` utilities targeting the class hooks in `tokens.css`, or
  arbitrary selectors). Mount in `app.tsx` under a `Section badge="Tailwind"`.

- [ ] **Step 3: e2e passes** — `bun run e2e nested-tree`. Expected: PASS.

- [ ] **Step 4: Commit** `git commit -am "feat(playground): nested geography card"`

---

### Task 6: Async typeahead card (Autocomplete + Emotion, fuzzy) — `data-testid="async"`

**Files:** Create `src/sections/AsyncTypeahead.tsx`; modify `app.tsx`;
rename `e2e/fuzzy-async.e2e.ts` → `e2e/async-typeahead.e2e.ts`, retarget.

- [ ] **Step 1: Failing e2e** — in `async-typeahead.e2e.ts`: (a) typing a typo
  ("amstrdam") eventually surfaces Amsterdam (fuzzy); (b) during the simulated
  latency the live region announces loading, then results. Target `data-testid="async"`.
  Run: `bun run e2e async-typeahead` → FAIL.

- [ ] **Step 2: Component** — `Autocomplete` with `loading` state driven by a
  `setTimeout`-simulated fetch over `airports.json`; `filterItems` runs a small
  fuzzy match (subsequence/Levenshtein-lite or the existing Fuse pattern) so
  typos resolve; loading renders Emotion **skeleton rows** (keyframe shimmer);
  timer cleared on unmount. All styling via Emotion `css` prop reading
  `emotionTheme`; wrap the section in `<ThemeProvider theme={emotionTheme}>`.

- [ ] **Step 3: e2e passes** — `bun run e2e async-typeahead`. Expected: PASS.

- [ ] **Step 4: Commit** `git commit -am "feat(playground): async typeahead card"`

---

### Task 7: Multi-select chips card (hook + primitives + Emotion) — `data-testid="multi"`

**Files:** Create `src/sections/MultiSelectChips.tsx`; modify `app.tsx`;
create `e2e/multi-select.e2e.ts`.

- [ ] **Step 1: Failing e2e** `e2e/multi-select.e2e.ts`: select two airports →
  two chips appear; click a chip's remove (×) → that chip disappears and the
  selection count drops. Target `data-testid="multi"`. Run → FAIL.

- [ ] **Step 2: Component** — `useAutocompleteVirtual({ multiple: true })` +
  `Combobulate.Root/Input/List/Item`. Render `api.selectedItems` as Emotion
  chips above the input, each with a × button calling `api.select(airport)`
  (toggle removes it). Reuse `AirportRow` for options. Emotion styling +
  `ThemeProvider`.

- [ ] **Step 3: e2e passes** — `bun run e2e multi-select`. Expected: PASS.

- [ ] **Step 4: Commit** `git commit -am "feat(playground): multi-select chips card"`

---

### Task 8: World airports card (Autocomplete + Tailwind, variable heights) — `data-testid="world"`

**Files:** Create `src/sections/WorldAirports.tsx`; modify `app.tsx`;
rename `e2e/linear-combobox.e2e.ts` → `e2e/world-airports.e2e.ts`, merge the
dynamic-heights assertion; delete `e2e/dynamic-heights.e2e.ts`.

- [ ] **Step 1: Failing e2e** `e2e/world-airports.e2e.ts`: (a) only a subset of
  ~9k options is mounted (virtualization); (b) keyboard nav to a far item keeps
  `aria-activedescendant` mounted; (c) rows have variable measured heights
  (long airport names wrap) yet nav stays in-viewport. Target `data-testid="world"`.
  Run → FAIL.

- [ ] **Step 2: Component** — `Autocomplete` over all of `airports.json`,
  `renderItem` = `AirportRow` (rich, can wrap → variable height),
  `estimateSize` a reasonable base. Tailwind. Mount under `Section badge="Tailwind"`.

- [ ] **Step 3: e2e passes** — `bun run e2e world-airports`. Expected: PASS.

- [ ] **Step 4: Commit** `git commit -am "feat(playground): virtualized world airports card"`

---

### Task 9: e2e cleanup + full pipeline

**Files:** delete any stale e2e specs; verify Playwright config `webServer`
still points at the playground dev server.

- [ ] **Step 1** — Ensure removed specs are gone (`dynamic-heights.e2e.ts`,
  old `fuzzy-async.e2e.ts`, old `linear-combobox.e2e.ts`) and the five new/renamed
  specs cover: hero, nested, async, multi, world.
- [ ] **Step 2** — Run the whole pipeline:
  `bun run lint && bun run typecheck && bun test && bun run build && bun run e2e`
  Expected: biome clean, tsc clean, unit unchanged & green, build ok, all e2e pass.
- [ ] **Step 3: Commit** `git commit -am "test(playground): remap e2e onto travel sections"`

---

### Task 10: README + final polish

**Files:** `README.md` (screenshot/description of the showcase, run
instructions), a short `examples/playground/README.md` (how to rebuild data via
`bun scripts/build-airports.ts`).

- [ ] **Step 1** — Add a "Playground / examples" section to the root README:
  what the showcase demonstrates, `cd examples/playground && bun install && bun run dev`.
- [ ] **Step 2** — Note the data-rebuild command and that the JSON is committed.
- [ ] **Step 3** — Final visual pass in both themes; fix any horizontal-scroll or
  contrast issues.
- [ ] **Step 4: Commit** `git commit -am "docs: document the travel showcase playground"`

---

## Self-Review

- **Spec coverage:** hero, nested, async (+fuzzy), multi, world all have tasks;
  data pipeline, theme, toolchain, e2e remap, README all covered. ✓
- **Placeholders:** logic-bearing code (transforms, theme, toggle, build script)
  is complete; section styling gives concrete starter code with the expectation
  of visual refinement during execution (a visual showcase can't be pixel-frozen
  in a plan). No `TODO`/`TBD`. ✓
- **Type consistency:** `Airport`/`GeoNode` defined in Task 2 and reused; item
  models named per section. `data-testid`s consistent with the spec. ✓
- **Boundary:** every task stays in `examples/playground` (+ `e2e/`); no `src/**`
  change. ✓
