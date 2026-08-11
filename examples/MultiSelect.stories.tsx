import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import { airportLabel, airportSearchText } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];

/**
 * The themeable surface, in JS (CSS-in-JS): tweak these tokens to reskin the
 * control. Layout stays in Tailwind classes; these flow in via inline `style`
 * and a couple of CSS variables that the option state variants read.
 */
const theme = {
  accent: "#0ea5e9",
  accentSoft: "#e0f2fe",
  radius: 10,
  shadow: "0 10px 30px rgba(2, 132, 199, 0.18)",
};

/**
 * Multi-select over the same ~3,300 airports. **Tailwind handles layout**; the
 * **themeable surface is CSS-in-JS** — the `theme` object above, applied via
 * inline styles and CSS variables the option state variants read. Self-contained:
 * the whole integration is right here.
 */
function MultiSelect() {
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    multiple: true,
    getItemId: (a) => a.iata,
    getSearchText: airportSearchText,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: false });
  const selectedItems = store.useState("selectedItems");

  return (
    <div className="w-[380px]">
      {/* Chips stay in the page flow (part of the control); themed via CSS-in-JS. */}
      <div data-testid="chips" className="mb-2 flex flex-wrap gap-1.5">
        {selectedItems.map((airport) => (
          <button
            key={airport.iata}
            type="button"
            onClick={() => store.select(airport)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
            style={{
              background: theme.accentSoft,
              color: theme.accent,
              borderRadius: theme.radius,
            }}
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
          className="w-full border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-[var(--cbl-accent)]"
          style={{ borderRadius: theme.radius, "--cbl-accent": theme.accent } as CSSProperties}
        />
        <Combobulate.Popover
          floating={floating}
          data-testid="cbl-popover"
          className="border border-zinc-200 bg-white p-1.5"
          style={
            {
              borderRadius: theme.radius,
              boxShadow: theme.shadow,
              "--cbl-accent": theme.accent,
              "--cbl-accent-soft": theme.accentSoft,
            } as CSSProperties
          }
        >
          <Combobulate.List<Airport> maxHeight={240}>
            {(item, index) => (
              <Combobulate.Item
                item={item}
                index={index}
                className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-sm text-zinc-900 data-[active-item]:bg-[var(--cbl-accent-soft)] data-[active-item]:text-[var(--cbl-accent)] aria-selected:font-semibold"
                style={{ borderRadius: theme.radius }}
              >
                <span>{airportLabel(item)}</span>
                {store.isSelected(item) ? (
                  <span aria-hidden className="font-bold" style={{ color: theme.accent }}>
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
    </div>
  );
}

const meta: Meta<typeof MultiSelect> = {
  title: "Combobulate/Multi Select",
  component: MultiSelect,
};
export default meta;
export const Default: StoryObj<typeof MultiSelect> = {};
