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
 * Single-select over ~3,300 real airports — the point of the library in one
 * screen: a virtualized list that stays fully accessible. Picking fills the
 * input with the chosen label (the committed-value model), and reopening shows
 * the whole list again with the chosen row marked.
 */
function SingleSelect() {
  // Default "includes" filter over the airport search text (city/name/iata/country).
  const { store, inputProps } = useDemoCombobox({
    items: AIRPORTS,
    getItemId: (a) => a.iata,
    getSearchText: airportSearchText,
    itemToInputValue: airportLabel,
    estimateSize: () => 44,
  });
  return (
    <div style={{ width: 380 }}>
      <FloatingCombobox
        store={store}
        inputProps={inputProps}
        label="Airport"
        placeholder="Search ~3,300 airports…"
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

const meta: Meta<typeof SingleSelect> = {
  title: "Combobulate/Single Select",
  component: SingleSelect,
};
export default meta;
export const Default: StoryObj<typeof SingleSelect> = {};
