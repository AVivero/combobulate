import type { Meta, StoryObj } from "@storybook/react";
import Fuse from "fuse.js";
import { Combobulate } from "../index";
import { FloatingCombobox } from "./FloatingCombobox";
import { airportLabel } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";
import { useDemoCombobox } from "./useDemoCombobox";
import "./demo.css";

const ALL = airports as Airport[];

// A sensible Fuse config for typo-tolerant airport search, tuned against real
// typos on this ~3,300-airport dataset:
// - weight the fields (city and IATA code matter most; country least),
// - `threshold: 0.3` tolerates a typo or two without matching everything
//   (0.4 got noisy on a dataset this dense),
// - location-aware (the Fuse default) favours matches near the start of a
//   field, which is what you want for city names,
// - `minMatchCharLength: 2` avoids single-letter noise.
const fuse = new Fuse(ALL, {
  keys: [
    { name: "city", weight: 3 },
    { name: "iata", weight: 3 },
    { name: "name", weight: 2 },
    { name: "country", weight: 1 },
  ],
  threshold: 0.3,
  minMatchCharLength: 2,
});

/**
 * Custom filtering via `filterItems`: swap the default "includes" match for
 * fuzzy, typo-tolerant search with Fuse.js. Try "amstrdam" (→ Amsterdam) or
 * "heathrow" (matches the airport name → London).
 */
function FuzzySearch() {
  const { api, inputProps } = useDemoCombobox({
    items: ALL,
    getItemId: (a) => a.iata,
    itemToInputValue: airportLabel,
    estimateSize: () => 44,
    filterItems: (list, query) =>
      query.trim() === "" ? list : fuse.search(query).map((r) => r.item),
  });
  return (
    <div style={{ width: 380 }}>
      <FloatingCombobox
        api={api}
        inputProps={inputProps}
        label="Airport"
        placeholder="Fuzzy search (try 'amstrdam')…"
        emptyMessage="No airports match"
      >
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {airportLabel(item)}
          </Combobulate.Item>
        )}
      </FloatingCombobox>
    </div>
  );
}

const meta: Meta<typeof FuzzySearch> = {
  title: "Combobulate/Fuzzy Search",
  component: FuzzySearch,
};
export default meta;
export const Default: StoryObj<typeof FuzzySearch> = {};
