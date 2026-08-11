import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate } from "../src/index";
import { FloatingCombobox } from "./FloatingCombobox";
import { airportLabel, airportSearchText } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";
import { useDemoCombobox } from "./useDemoCombobox";
import "./demo.css";

const AIRPORTS = airports as Airport[];

/**
 * Multi-select over the same ~3,300 airports. Chips (in the page flow, part of
 * the control) carry the selection so the input stays a search box; the list
 * stays open after each pick, and chosen rows are marked in the list.
 */
function MultiSelect() {
  const { store, inputProps } = useDemoCombobox({
    items: AIRPORTS,
    multiple: true,
    getItemId: (a) => a.iata,
    getSearchText: airportSearchText,
    estimateSize: () => 44,
  });
  const selectedItems = store.useState("selectedItems");
  return (
    <div style={{ width: 380 }}>
      {/* Chips stay in the page flow, as part of the control; only the option
          list floats. Multi-select keeps the list open after each pick. */}
      <div
        data-testid="chips"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}
      >
        {selectedItems.map((airport) => (
          <button key={airport.iata} type="button" onClick={() => store.select(airport)}>
            {airport.iata} ✕
          </button>
        ))}
      </div>
      <FloatingCombobox
        store={store}
        inputProps={inputProps}
        label="Airports"
        placeholder="Pick several airports…"
        emptyMessage="No airports match"
        maxHeight={240}
      >
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            <span>{airportLabel(item)}</span>
          </Combobulate.Item>
        )}
      </FloatingCombobox>
    </div>
  );
}

const meta: Meta<typeof MultiSelect> = {
  title: "Combobulate/Multi Select",
  component: MultiSelect,
};
export default meta;
export const Default: StoryObj<typeof MultiSelect> = {};
