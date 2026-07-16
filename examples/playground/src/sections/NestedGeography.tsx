import { NestedAutocomplete, type TreeRow } from "combobulate";
import geographyData from "../data/geography.json";
import type { GeoNode } from "../data/types";
import "./NestedGeography.css";

const GEOGRAPHY = geographyData as GeoNode[];

/** Small decorative glyph per node kind — purely presentational (aria-hidden). */
const KIND_GLYPH: Record<GeoNode["kind"], string> = {
  country: "\u{1F310}", // globe
  city: "\u{1F3D9}\u{FE0F}", // cityscape
  airport: "✈️", // airplane
};

function renderGeoNode(node: GeoNode, _meta: TreeRow<GeoNode>) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span aria-hidden="true" className="w-5 shrink-0 text-center text-sm leading-none">
        {KIND_GLYPH[node.kind]}
      </span>
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      {node.airport ? (
        <span className="shrink-0 rounded bg-accent/10 px-1.5 font-mono text-xs text-accent">
          {node.airport.iata}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Country -> City -> Airport tree browser built on the `NestedAutocomplete`
 * preset. `multiple` + `selectAllUnder` turn on the tri-state "select every
 * airport under this node" checkbox at the country and city levels.
 */
export function NestedGeography() {
  return (
    <div className="nested-geography relative">
      <NestedAutocomplete<GeoNode>
        nodes={GEOGRAPHY}
        getChildren={(node) => node.children}
        getItemId={(node) => node.id}
        getSearchText={(node) => node.label}
        renderItem={renderGeoNode}
        multiple
        selectAllUnder
        placeholder="Search countries, cities, or airports…"
        emptyMessage="No destinations match your search."
      />
    </div>
  );
}
