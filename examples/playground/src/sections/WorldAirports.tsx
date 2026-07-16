import { Autocomplete } from "combobulate";
import { AirportRow } from "../components/AirportRow";
import airportsData from "../data/airports.json";
import type { Airport } from "../data/types";
import "./WorldAirports.css";

const AIRPORTS = airportsData as Airport[];

/** Searchable text: city, airport name, IATA code, and country. */
function searchText(airport: Airport): string {
  return `${airport.city} ${airport.name} ${airport.iata} ${airport.country}`;
}

/**
 * The full ~3,274-airport dataset in a single virtualized `Autocomplete`,
 * proving virtualization at real scale with rich, variable-height rows.
 *
 * `AirportRow` (see `../components/AirportRow.tsx`) truncates both of its
 * text lines to a single line by default; the wrapper below overrides that
 * just for this card — `whitespace-normal`/`break-words` on its `<p>`
 * descendants — so long airport names wrap across multiple lines instead of
 * ellipsizing. `Combobulate.List` (see `src/primitives/combobulate.tsx`)
 * wires each row's ref to TanStack Virtual's `measureElement`, and the row
 * wrapper itself is `height: auto` (never `display:none`'d, which would
 * collapse a measurement to 0), so every row's *real*, post-wrap height gets
 * measured live — `estimateSize` below is only the initial guess used before
 * a row has ever been measured, not a fixed height.
 */
export function WorldAirports() {
  return (
    <div className="world-airports relative">
      <Autocomplete<Airport>
        items={AIRPORTS}
        getItemId={(airport) => airport.iata}
        getSearchText={searchText}
        placeholder="Search 3,274 airports worldwide…"
        estimateSize={() => 56}
        emptyMessage="No airports match your search."
        renderItem={(airport) => (
          <div className="[&_p]:whitespace-normal [&_p]:break-words">
            <AirportRow
              kind="airport"
              city={airport.city}
              country={airport.country}
              name={airport.name}
              iata={airport.iata}
            />
          </div>
        )}
      />
    </div>
  );
}
