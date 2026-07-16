/**
 * Presentational row shared by every airport-picking combobox in the
 * showcase (flight-search hero today; world-airports and multi-select chips
 * reuse it later). It renders markup only — active/selected visuals are
 * driven by the parent `Combobulate.Item` wrapper's `data-active`/
 * `data-selected` attributes, styled from the section that owns the list
 * (see `src/sections/Hero.css`), not from this component.
 */
export type AirportRowProps = {
  /** `"airport"` renders a plane, `"metro"` (an "all airports" rollup) renders a pin. */
  kind: "airport" | "metro";
  city: string;
  country: string;
  /** Airport name, or a rollup's label (e.g. "All airports"). */
  name: string;
  iata: string;
};

export function AirportRow({ kind, city, country, name, iata }: AirportRowProps) {
  return (
    <div className="flex cursor-pointer items-center gap-3 px-3 py-2">
      <span aria-hidden="true" className="w-5 shrink-0 text-center text-base leading-none">
        {kind === "metro" ? "📍" : "✈"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">
          {city}
          {country ? `, ${country}` : ""}
        </p>
        <p className="truncate text-xs text-muted">{name}</p>
      </div>
      <span className="shrink-0 rounded bg-accent/10 px-1.5 font-mono text-xs text-accent">
        {iata}
      </span>
    </div>
  );
}
