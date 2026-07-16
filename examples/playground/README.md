# Combobulate playground — travel showcase

A Google-Flights-style demo of Combobulate on real airport data, styled with
Tailwind and Emotion over a shared light/dark token layer.

```sh
bun install
bun run dev      # http://localhost:5173
```

`combobulate` resolves to the library source (`../../src`) via a Vite alias, so
edits to the library show up live — no rebuild needed.

## Data

The airport dataset is **committed** (`src/data/airports.json`,
`src/data/geography.json`) so `dev`/`build` never hit the network. To refresh it
from the upstream source ([OurAirports](https://ourairports.com/data/)):

```sh
bun scripts/build-airports.ts
```

That fetches `airports.csv` + `countries.csv`, keeps scheduled-service airports
with an IATA code (`large_airport`/`medium_airport`), and regenerates both the
flat list and the Country → City → Airport tree. The pure transforms live in
`scripts/transform.ts` and are unit-tested in `scripts/transform.test.ts`.

## Scripts

- `bun run dev` — Vite dev server
- `bun run build` — production build
- `bun run typecheck` — `tsc --noEmit`
