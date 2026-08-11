import type { Airport } from "./types";

/**
 * Human-readable row label. About 50 of the 3,274 real-world airports (e.g.
 * AXR, BQL, BRK) have a blank `city`; fall back to `country` so no row ever
 * renders a dangling "— Name (CODE)".
 */
export function airportLabel(airport: Airport): string {
  const place = airport.city || airport.country;
  return `${place} — ${airport.name} (${airport.iata})`;
}

/**
 * Search text covering every field, so city-less airports stay findable by
 * country, name, or code alone.
 */
export function airportSearchText(airport: Airport): string {
  return [airport.city, airport.name, airport.iata, airport.country].filter(Boolean).join(" ");
}
