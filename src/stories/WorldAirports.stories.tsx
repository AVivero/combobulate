import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";
import { airportLabel, airportSearchText } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";
import "./demo.css";

const AIRPORTS = airports as Airport[];

function WorldAirports() {
  const api = useCombobulate({
    items: AIRPORTS,
    getItemId: (a) => a.iata,
    getSearchText: airportSearchText,
    estimateSize: () => 44,
  });
  return (
    <div style={{ width: 380 }}>
      <Combobulate.Root api={api} label="Airports">
        <Combobulate.Input aria-label="Airport" placeholder="Search ~3,300 airports…" />
        <Combobulate.List<Airport>>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              <span>{airportLabel(item)}</span>
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>No airports match</Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof WorldAirports> = {
  title: "Combobulate/World Airports",
  component: WorldAirports,
};
export default meta;
export const Default: StoryObj<typeof WorldAirports> = {};
