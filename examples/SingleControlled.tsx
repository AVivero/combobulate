import { useState } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;

/**
 * Controlled single-select: the parent's `airport` state is the source of
 * truth. combobulate reflects `value`; a pick fires `onChange`, and external
 * buttons (Clear, Set random) drive the selection purely from parent state —
 * the pattern a booking form's swap/reset buttons use.
 */
export function SingleControlled() {
  const [airport, setAirport] = useState<Airport | null>(AIRPORTS[0] ?? null);
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    value: airport,
    onChange: (value) => setAirport(value as Airport | null),
    getItemId: (a) => a.iata,
    getSearchText: airportLabel,
    getInputValue: airportLabel,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: true });

  return (
    <div className="w-[380px]">
      <div className="mb-2 text-xs text-zinc-500">
        Parent state:{" "}
        <span className="font-mono text-indigo-700">{airport ? airport.iata : "—"}</span>
      </div>
      <Combobulate store={store} label="Airport">
        <Combobulate.Input
          ref={floating.reference}
          {...floating.referenceProps}
          aria-label="Airport"
          placeholder="Search ~3,300 airports…"
          className="w-full rounded-md border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
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
          onClick={() => setAirport(null)}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => setAirport(AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)] ?? null)}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Set random
        </button>
      </div>
    </div>
  );
}
