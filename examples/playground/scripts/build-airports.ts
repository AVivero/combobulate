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
