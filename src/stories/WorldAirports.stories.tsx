import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate } from "../index";
import { FloatingCombobox } from "./FloatingCombobox";
import { airportLabel, airportSearchText } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";
import { useDemoCombobox } from "./useDemoCombobox";
import "./demo.css";

const AIRPORTS = airports as Airport[];

function WorldAirports() {
  // Default "includes" filter over the airport search text (city/name/iata/country).
  const { api, inputProps } = useDemoCombobox({
    items: AIRPORTS,
    getItemId: (a) => a.iata,
    getSearchText: airportSearchText,
    itemToInputValue: airportLabel,
    estimateSize: () => 44,
  });
  return (
    <div style={{ width: 380 }}>
      <FloatingCombobox
        api={api}
        inputProps={inputProps}
        label="Airport"
        placeholder="Search ~3,300 airports…"
        emptyMessage="No airports match"
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

const meta: Meta<typeof WorldAirports> = {
  title: "Combobulate/World Airports",
  component: WorldAirports,
};
export default meta;
export const Default: StoryObj<typeof WorldAirports> = {};
