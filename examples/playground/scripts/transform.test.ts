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
