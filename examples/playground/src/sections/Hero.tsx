import { type AutocompleteVirtualApi, Combobulate, useAutocompleteVirtual } from "combobulate";
import { AirportRow } from "../components/AirportRow";
import airportsData from "../data/airports.json";
import { POPULAR } from "../data/popular";
import type { Airport } from "../data/types";
import "./Hero.css";

const AIRPORTS = airportsData as Airport[];

/**
 * A single row in either origin/destination list: a real airport, or a
 * synthetic "all airports in this metro" rollup for cities with 2+ airports
 * (e.g. New York -> JFK + LGA). Both branches share every field AirportRow
 * needs so it can render either without narrowing.
 */
export type HeroItem =
  | (Airport & { kind: "airport" })
  | { kind: "metro"; iata: string; city: string; country: string; name: string };

/**
 * Strip diacritics and case so "Malaga" matches "Málaga". A small local
 * helper (not imported from the library, which doesn't export one publicly).
 */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Real IATA metropolitan-area codes, keyed by `city|countryCode`, for the
 * multi-airport metros present in this dataset. Only cities listed here get an
 * "All airports" rollup — so every rollup shown carries an authentic code, and
 * cities that merely happen to share two airports (or carry no city name) are
 * left as plain airport rows.
 */
const METRO_CODES: Record<string, string> = {
  "New York|US": "NYC",
  "London|GB": "LON",
  "Chicago|US": "CHI",
  "Moscow|RU": "MOW",
  "Toronto|CA": "YTO",
  "Montréal|CA": "YMQ",
  "São Paulo|BR": "SAO",
  "Rome|IT": "ROM",
  "Stockholm|SE": "STO",
  "Osaka|JP": "OSA",
  "Seoul|KR": "SEL",
  "Beijing|CN": "BJS",
  "Bangkok|TH": "BKK",
  "Jakarta|ID": "JKT",
};

/**
 * Pure: groups airports by `city|countryCode` and prepends a `metro` rollup
 * item (with the real IATA metro code) directly above the first airport of any
 * city in {@link METRO_CODES}. Cities not in that table — including unnamed
 * remote-airport rows — are never grouped.
 */
export function withMetros(airports: Airport[]): HeroItem[] {
  const groups = new Map<string, Airport[]>();
  for (const airport of airports) {
    const city = airport.city.trim();
    if (!city) continue;
    const key = `${city}|${airport.countryCode}`;
    const group = groups.get(key);
    if (group) group.push(airport);
    else groups.set(key, [airport]);
  }

  const metroByKey = new Map<string, HeroItem>();
  for (const [key, group] of groups) {
    const first = group[0];
    const code = METRO_CODES[key];
    if (!code || group.length < 2 || !first) continue;
    metroByKey.set(key, {
      kind: "metro",
      iata: code,
      city: first.city,
      country: first.country,
      name: "All airports",
    });
  }

  const result: HeroItem[] = [];
  const seen = new Set<string>();
  for (const airport of airports) {
    const city = airport.city.trim();
    const key = city ? `${city}|${airport.countryCode}` : "";
    const metro = key ? metroByKey.get(key) : undefined;
    if (metro && !seen.has(key)) {
      seen.add(key);
      result.push(metro);
    }
    result.push({ ...airport, kind: "airport" });
  }
  return result;
}

const HERO_ITEMS: HeroItem[] = withMetros(AIRPORTS);
const HERO_POPULAR: HeroItem[] = POPULAR.map((airport) => ({
  ...airport,
  kind: "airport" as const,
}));

function searchText(item: HeroItem): string {
  return item.kind === "metro"
    ? `${item.city} ${item.country} ${item.iata} all airports`
    : `${item.city} ${item.country} ${item.iata} ${item.name}`;
}

/** Matches city / airport name / IATA / country; falls back to POPULAR when
 * the query is empty or matches nothing, per the hero's empty state. */
function filterHeroItems(items: HeroItem[], query: string): HeroItem[] {
  const q = normalize(query).trim();
  if (!q) return HERO_POPULAR;
  const matches = items.filter((item) => normalize(searchText(item)).includes(q));
  return matches.length > 0 ? matches : HERO_POPULAR;
}

/** What a selection writes into its field's input text. */
function displayLabel(item: HeroItem): string {
  return item.kind === "metro" ? `${item.city} — All airports` : `${item.city} (${item.iata})`;
}

function ComboboxField({
  legend,
  ariaLabel,
  placeholder,
  api,
}: {
  legend: string;
  ariaLabel: string;
  placeholder: string;
  api: AutocompleteVirtualApi<HeroItem>;
}) {
  return (
    <div className="hero-field relative min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted">{legend}</span>
      <Combobulate.Root api={api}>
        <Combobulate.Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          className="w-full rounded-token border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <Combobulate.List>
          {(item: HeroItem, index: number) => (
            <Combobulate.Item item={item} index={index}>
              <AirportRow
                kind={item.kind}
                city={item.city}
                country={item.country}
                name={item.name}
                iata={item.iata}
              />
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

/**
 * Google-Flights-style origin/destination search, built directly on the
 * headless primitives (not the `Autocomplete` preset) for full control over
 * the two-field layout and the swap control between them.
 */
export function Hero() {
  const origin = useAutocompleteVirtual<HeroItem>({
    items: HERO_ITEMS,
    filterItems: filterHeroItems,
    onChange: (value) => {
      const item = Array.isArray(value) ? value[0] : value;
      if (item) origin.setInputValue(displayLabel(item));
      origin.close();
    },
  });
  const destination = useAutocompleteVirtual<HeroItem>({
    items: HERO_ITEMS,
    filterItems: filterHeroItems,
    onChange: (value) => {
      const item = Array.isArray(value) ? value[0] : value;
      if (item) destination.setInputValue(displayLabel(item));
      destination.close();
    },
  });

  function handleSwap() {
    const originItems = origin.selectedItems;
    const destinationItems = destination.selectedItems;
    const originInput = origin.inputValue;
    const destinationInput = destination.inputValue;
    origin.setSelectedItems(destinationItems);
    destination.setSelectedItems(originItems);
    origin.setInputValue(destinationInput);
    destination.setInputValue(originInput);
  }

  return (
    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
      <ComboboxField
        legend="From"
        ariaLabel="Origin airport"
        placeholder="Where from?"
        api={origin}
      />
      <button
        type="button"
        aria-label="Swap origin and destination"
        onClick={handleSwap}
        className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted hover:border-accent hover:text-accent"
      >
        <span aria-hidden="true">⇄</span>
      </button>
      <ComboboxField
        legend="To"
        ariaLabel="Destination airport"
        placeholder="Where to?"
        api={destination}
      />
    </div>
  );
}
