import { type FocusEvent, useCallback } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;

/**
 * Single-select over ~3,300 real airports, styled entirely with Tailwind
 * (active + chosen states via `data-*`/`aria-*` variants). Uncontrolled:
 * combobulate owns the selection, surfaced via `onChange`; a Clear button
 * resets it through `store.setValue(null)`.
 */
export function SingleUncontrolled() {
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    getItemId: (a) => a.iata,
    getSearchText: airportLabel,
    getInputValue: airportLabel,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: true });

  const inputValue = store.useState("inputValue");
  const onFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (inputValue !== "") e.currentTarget.select();
    },
    [inputValue],
  );

  return (
    <div className="w-[380px]">
      <Combobulate store={store} label="Airport">
        <Combobulate.Input
          ref={floating.reference}
          {...floating.referenceProps}
          onFocus={onFocus}
          aria-label="Airport"
          placeholder="Search ~3,300 airports…"
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
        onClick={() => store.setValue(null)}
        className="mt-2 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
      >
        Clear
      </button>
    </div>
  );
}
