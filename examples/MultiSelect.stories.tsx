import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate } from "../src/index";
import { FloatingCombobox } from "./FloatingCombobox";
import { useDemoCombobox } from "./useDemoCombobox";
import "./demo.css";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function MultiSelect() {
  const { store, inputProps } = useDemoCombobox({
    items: CITIES,
    multiple: true,
    getItemId: (c) => c,
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
        {selectedItems.map((city) => (
          <button key={city} type="button" onClick={() => store.select(city)}>
            {city} ✕
          </button>
        ))}
      </div>
      <FloatingCombobox
        store={store}
        inputProps={inputProps}
        label="Cities"
        placeholder="Pick several…"
        emptyMessage="No results"
      >
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {item}
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
