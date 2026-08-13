import { type CSSProperties, useState } from "react";
import { Combobulate, useCombobulate, useCombobulateFloating } from "../src/index";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";

const AIRPORTS = airports as Airport[];
const airportLabel = (a: Airport): string => `${a.city || a.country} — ${a.name} (${a.iata})`;
const airportSearch = (a: Airport): string =>
  [a.city, a.name, a.iata, a.country].filter(Boolean).join(" ");

/**
 * Every element themed at once — input, popover, list (with a custom scrollbar),
 * item states, empty, and chips — driven by a JS theme through CSS variables,
 * with a light/dark toggle.
 *
 * Two rules keep the strategies from fighting:
 * - Properties that CHANGE with state (the input's focus border, an item's
 *   active/selected bg + text) are set via `className` variants, so the state
 *   variant can win. Inline styles always beat classes, so those would freeze.
 * - Static colors (surface, shadow, chip bg) are inline CSS vars.
 * The scrollbar is a pseudo-element (not inline-styleable), so it's a scoped
 * <style> block reading the same vars.
 */
const THEMES = {
  light: {
    bg: "#f4f8f6",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    accent: "#10b981",
    accentSoft: "#ecfdf5",
    accentText: "#065f46",
    radius: "10px",
    shadow: "0 12px 32px rgba(2, 44, 34, 0.14)",
  },
  dark: {
    bg: "#0b1220",
    surface: "#111a2e",
    text: "#e6edf5",
    muted: "#94a3b8",
    border: "#22304d",
    accent: "#34d399",
    accentSoft: "#0e2a22",
    accentText: "#a7f3d0",
    radius: "10px",
    shadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
  },
};

export function FullyThemed() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const t = THEMES[mode];
  const store = useCombobulate<Airport>({
    items: AIRPORTS,
    multiple: true,
    getItemId: (a) => a.iata,
    getSearchText: airportSearch,
    estimateSize: () => 44,
  });
  const floating = useCombobulateFloating(store, { closeOnSelect: false });
  const selectedItems = store.useState("selectedItems");

  const rootStyle = {
    "--cbl-surface": t.surface,
    "--cbl-text": t.text,
    "--cbl-muted": t.muted,
    "--cbl-border": t.border,
    "--cbl-accent": t.accent,
    "--cbl-accent-soft": t.accentSoft,
    "--cbl-accent-text": t.accentText,
    "--cbl-radius": t.radius,
    "--cbl-shadow": t.shadow,
    background: t.bg,
  } as CSSProperties;

  return (
    <div
      data-theme={mode}
      data-testid="themed-root"
      style={rootStyle}
      className="w-[420px] rounded-2xl p-5"
    >
      {/* Scoped stylesheet for the list scrollbar — a pseudo-element can't be an
          inline style, so it reads the same CSS vars from a class on the List. */}
      <style>{`
        .cbl-themed-list::-webkit-scrollbar { width: 10px; }
        .cbl-themed-list::-webkit-scrollbar-track { background: transparent; }
        .cbl-themed-list::-webkit-scrollbar-thumb {
          background: var(--cbl-accent);
          border: 2px solid var(--cbl-surface);
          border-radius: 8px;
        }
      `}</style>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[color:var(--cbl-text)]">Airports</span>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}
          className="rounded-md px-2.5 py-1 text-xs font-medium"
          style={{ background: "var(--cbl-accent-soft)", color: "var(--cbl-accent-text)" }}
        >
          {mode === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
      </div>

      <div data-testid="chips" className="mb-2 flex flex-wrap gap-1.5">
        {selectedItems.map((airport) => (
          <button
            key={airport.iata}
            type="button"
            aria-label={`Remove ${airport.iata}`}
            onClick={() => store.select(airport)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ background: "var(--cbl-accent-soft)", color: "var(--cbl-accent-text)" }}
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
          placeholder="Search airports…"
          className="w-full rounded-[var(--cbl-radius)] border border-[color:var(--cbl-border)] px-3 py-2 text-sm text-[color:var(--cbl-text)] outline-none focus:border-[color:var(--cbl-accent)]"
          style={{ background: "var(--cbl-surface)" }}
        />
        <Combobulate.Popover
          floating={floating}
          data-testid="cbl-popover"
          className="border p-1.5"
          style={{
            background: "var(--cbl-surface)",
            borderColor: "var(--cbl-border)",
            borderRadius: "var(--cbl-radius)",
            boxShadow: "var(--cbl-shadow)",
          }}
        >
          <Combobulate.List<Airport>
            maxHeight={240}
            className="cbl-themed-list"
            style={{ padding: 2 }}
          >
            {(item, index) => (
              <Combobulate.Item
                item={item}
                index={index}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-[color:var(--cbl-text)] data-[active-item]:bg-[var(--cbl-accent-soft)] data-[active-item]:text-[color:var(--cbl-accent-text)] aria-selected:font-semibold"
              >
                <span>{airportLabel(item)}</span>
                {store.isSelected(item) ? (
                  <span aria-hidden className="font-bold" style={{ color: "var(--cbl-accent)" }}>
                    ✓
                  </span>
                ) : null}
              </Combobulate.Item>
            )}
          </Combobulate.List>
          <Combobulate.Empty className="px-2.5 py-3 text-sm" style={{ color: "var(--cbl-muted)" }}>
            No airports match
          </Combobulate.Empty>
        </Combobulate.Popover>
        <Combobulate.LiveRegion />
      </Combobulate>
    </div>
  );
}
