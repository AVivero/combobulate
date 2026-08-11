import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];

// Row label. ~50 airports have a blank `city`; fall back to `country` so no row
// renders a dangling "— Name (CODE)".
const airportLabel = (a: Airport) => `${a.city || a.country} — ${a.name} (${a.iata})`;
// Search text covering every field, so city-less airports stay findable.
const airportSearch = (a: Airport) => [a.city, a.name, a.iata, a.country].filter(Boolean).join(" ");

/**
 * The themeable surface, in JS (CSS-in-JS): tweak these tokens to reskin the
 * control. These are the SAME values the Single Select example gets from its
 * Tailwind classes (`indigo-500/800/50`, `rounded-md/lg`, the shadow) — the two
 * examples look identical; only the styling strategy differs.
 */
const theme = {
  accent: "#6366f1", // indigo-500 — focus border + chosen ✓
  accentText: "#3730a3", // indigo-800 — active row text
  accentSoft: "#eef2ff", // indigo-50 — active row + chip background
  chipText: "#4338ca", // indigo-700 — chip text
  inputRadius: 6, // rounded-md
  cardRadius: 8, // rounded-lg
  shadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
};

/**
 * Multi-select over the same ~3,300 airports. **Tailwind handles layout** (and
 * the neutral structure); the **themeable surface is CSS-in-JS** — the `theme`
 * object above, applied via inline styles and CSS variables the option state
 * variants read. Self-contained: the whole integration is right here.
 */
function MultiSelect() {
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
              color: theme.chipText,
              borderRadius: theme.inputRadius,
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
          style={{ borderRadius: theme.inputRadius, "--cbl-accent": theme.accent } as CSSProperties}
        />
        <Combobulate.Popover
          floating={floating}
          data-testid="cbl-popover"
          className="border border-zinc-300 bg-white p-1.5"
          style={
            {
              borderRadius: theme.cardRadius,
              boxShadow: theme.shadow,
              "--cbl-accent": theme.accent,
              "--cbl-accent-text": theme.accentText,
              "--cbl-accent-soft": theme.accentSoft,
            } as CSSProperties
          }
        >
          <Combobulate.List<Airport> maxHeight={240}>
            {(item, index) => (
              <Combobulate.Item
                item={item}
                index={index}
                className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-sm text-zinc-900 data-[active-item]:bg-[var(--cbl-accent-soft)] data-[active-item]:text-[var(--cbl-accent-text)] aria-selected:font-semibold"
                style={{ borderRadius: theme.inputRadius }}
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
