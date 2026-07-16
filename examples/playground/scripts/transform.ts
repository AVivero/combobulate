import type { Airport, GeoNode } from "../src/data/types";

const KEEP_TYPES = new Set(["large_airport", "medium_airport"]);

export function toAirport(
  row: Record<string, string>,
  countryName: (code: string) => string,
): Airport | null {
  const iata = row.iata_code?.trim();
  if (!iata) return null;
  if (row.scheduled_service !== "yes") return null;
  if (!KEEP_TYPES.has(row.type ?? "")) return null;
  return {
    iata,
    icao: row.icao_code?.trim() ?? "",
    name: row.name?.trim() ?? "",
    city: row.municipality?.trim() ?? "",
    country: countryName(row.iso_country ?? ""),
    countryCode: row.iso_country ?? "",
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
          .map((a) => ({
            id: a.iata,
            label: `${a.name} (${a.iata})`,
            kind: "airport" as const,
            airport: a,
          })),
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
