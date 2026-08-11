import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;
const airportSearch = (a: Airport): string =>
  [a.city, a.name, a.iata, a.country].filter(Boolean).join(" ");

/**
 * Multi-select over the same airports, pure Tailwind. The input stays a search
 * box; chips carry the selection. Uncontrolled — Clear all resets via
 * `store.setValue([])`.
 */
export function MultiUncontrolled() {
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    multiple: true,
    getItemId: (a) => a.iata,
    getSearchText: airportSearch,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: false });
  const selectedItems = store.useState("selectedItems");

  return (
    <div className="w-[380px]">
      <div data-testid="chips" className="mb-2 flex flex-wrap gap-1.5">
        {selectedItems.map((airport) => (
          <button
            key={airport.iata}
            type="button"
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
      <button
        type="button"
        onClick={() => store.setValue([])}
        className="mt-2 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
      >
        Clear all
      </button>
    </div>
  );
}
