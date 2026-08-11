import { type CSSProperties, useMemo, useState } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;

/**
 * The payoff of controlled: a booking-style pair. Both fields are controlled,
 * so a single Swap button exchanges origin↔destination from the parent, and the
 * origin list is *derived* from the chosen destination (you can't fly a route to
 * itself). Neither is possible with uncontrolled selection.
 */
function Field({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: Airport | null;
  onChange: (next: Airport | null) => void;
  items: Airport[];
}) {
  const store = useCombobulate<Airport>({
    items,
    value,
    onChange: (next) => onChange(next as Airport | null),
    getItemId: (a) => a.iata,
    getSearchText: airportLabel,
    getInputValue: airportLabel,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: true });
  return (
    <Combobulate store={store} label={label}>
      <Combobulate.Input
        ref={floating.reference}
        {...floating.referenceProps}
        aria-label={label}
        placeholder={`${label}…`}
        className="w-full rounded-md border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 text-ellipsis"
      />
      <Combobulate.Popover
        floating={floating}
        className="rounded-lg border border-zinc-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        style={{ zIndex: 50 } as CSSProperties}
      >
        <Combobulate.List<Airport> maxHeight={220}>
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
  );
}

export function Booking() {
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);

  const originItems = useMemo(
    () => (destination ? AIRPORTS.filter((a) => a.iata !== destination.iata) : AIRPORTS),
    [destination],
  );
  const destinationItems = useMemo(
    () => (origin ? AIRPORTS.filter((a) => a.iata !== origin.iata) : AIRPORTS),
    [origin],
  );

  /**
   * Swap the origin and destination airports.
   * @returns void
   */
  function swap(): void {
    setOrigin(destination);
    setDestination(origin);
  }

  return (
    <div className="w-full max-w-3xl space-y-3">
      {/* Google-Flights layout: origin · swap · destination on one row for
          wider viewports; stacked on small screens. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-2">
        <div className="flex-1">
          <div className="mb-1 text-xs font-medium text-zinc-500">Origin</div>
          <Field label="Origin" value={origin} onChange={setOrigin} items={originItems} />
        </div>
        <div className="flex justify-center md:pb-1">
          <button
            type="button"
            onClick={swap}
            aria-label="Swap origin and destination"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
          >
            {/* Arrows point up/down when stacked, left/right when side by side. */}
            <span className="rotate-90 md:rotate-0" aria-hidden>
              ⇄
            </span>
          </button>
        </div>
        <div className="flex-1">
          <div className="mb-1 text-xs font-medium text-zinc-500">Destination</div>
          <Field
            label="Destination"
            value={destination}
            onChange={setDestination}
            items={destinationItems}
          />
        </div>
      </div>
      <div className="text-xs text-zinc-500">
        Route:{" "}
        <span data-testid="route" className="font-mono text-indigo-700">
          {origin ? origin.iata : "—"} → {destination ? destination.iata : "—"}
        </span>
      </div>
    </div>
  );
}
