import { type CSSProperties, useState } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;

/**
 * The themeable surface, in JS (CSS-in-JS): these tokens reskin the control.
 * They are the SAME values the pure-Tailwind examples get from their classes
 * (indigo-500/800/50/700, rounded-md/lg, the shadow) — the look is identical;
 * only the styling strategy differs. Tailwind still handles layout/neutral
 * structure; the `theme` drives the accent surface via inline styles + CSS vars
 * the `data-*`/`aria-*` variants read.
 */
const theme = {
  accent: "#6366f1",
  accentText: "#3730a3",
  accentSoft: "#eef2ff",
  inputRadius: 6,
  cardRadius: 8,
  shadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
};

export function Themeable() {
  const [airport, setAirport] = useState<Airport | null>(null);
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    onChange: (value) => setAirport(value as Airport | null),
    getItemId: (a) => a.iata,
    getSearchText: airportLabel,
    getInputValue: airportLabel,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: true });

  return (
    <div className="w-[380px]">
      <Combobulate store={store} label="Airport">
        <Combobulate.Input
          ref={floating.reference}
          {...floating.referenceProps}
          aria-label="Airport"
          placeholder="Search ~3,300 airports…"
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
      <div className="mt-2 text-xs text-zinc-500">
        Selected: <span className="font-mono text-indigo-700">{airport ? airport.iata : "—"}</span>
      </div>
    </div>
  );
}
