import { useState } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;
const airportSearch = (a: Airport): string =>
  [a.city, a.name, a.iata, a.country].filter(Boolean).join(" ");
const HUB = AIRPORTS.find((a) => a.iata === "JFK") ?? AIRPORTS[0];

/**
 * Controlled multi-select: parent owns the `Airport[]`. combobulate reflects
 * `value`; picks and chip removals fire `onChange`; external buttons drive the
 * array directly.
 */
export function MultiControlled() {
  const [selected, setSelected] = useState<Airport[]>([]);
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    multiple: true,
    value: selected,
    onChange: (value) => setSelected(value as Airport[]),
    getItemId: (a) => a.iata,
    getSearchText: airportSearch,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: false });

  return (
    <div className="w-[380px]">
      <div className="mb-2 text-xs text-zinc-500">
        Parent state:{" "}
        <span className="font-mono text-indigo-700">
          {selected.length ? selected.map((a) => a.iata).join(", ") : "—"}
        </span>
      </div>
      <div data-testid="chips" className="mb-2 flex flex-wrap gap-1.5">
        {selected.map((airport) => (
          <button
            key={airport.iata}
            type="button"
            aria-label={`Remove ${airport.iata}`}
            onClick={() => store.select(airport)}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
          >
            {airport.iata} <span aria-hidden>✕</span>
          </button>
        ))}
      </div>
      <Combobulate store={store} label="Airports">
        <Combobulate.Input
          ref={floating.reference}
          {...floating.referenceProps}
          aria-label="Airports"
          placeholder="Pick several airports…"
          className="w-full rounded-md border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 text-ellipsis"
        />
        <Combobulate.Popover
          floating={floating}
          data-testid="cbl-popover"
          className="rounded-lg border border-zinc-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <Combobulate.List<Airport> maxHeight={240}>
            {(item, index) => (
              <Combobulate.Item
                item={item}
                index={index}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-900 data-[active-item]:bg-indigo-50 data-[active-item]:text-indigo-800 aria-selected:font-semibold"
              >
                <span>{airportLabel(item)}</span>
                {store.isSelected(item) ? (
                  <span aria-hidden className="font-bold text-indigo-500">
                    ✓
                  </span>
                ) : null}
              </Combobulate.Item>
            )}
          </Combobulate.List>
          <Combobulate.Empty>
            <div className="px-2.5 py-3 text-sm text-zinc-500">No airports match</div>
          </Combobulate.Empty>
        </Combobulate.Popover>
        <Combobulate.LiveRegion />
      </Combobulate>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setSelected([])}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() =>
            setSelected((prev) =>
              HUB && prev.some((a) => a.iata === HUB.iata)
                ? prev
                : ([...prev, HUB].filter(Boolean) as Airport[]),
            )
          }
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Add a hub
        </button>
      </div>
    </div>
  );
}
