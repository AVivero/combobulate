import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";
import "./demo.css";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function MultiSelect() {
  const api = useCombobulate({ items: CITIES, multiple: true, getItemId: (c) => c });
  return (
    <div style={{ width: 380 }}>
      <div
        data-testid="chips"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}
      >
        {api.selectedItems.map((city) => (
          <button key={city} type="button" onClick={() => api.select(city)}>
            {city} ✕
          </button>
        ))}
      </div>
      <Combobulate.Root api={api} label="Cities">
        <Combobulate.Input aria-label="Cities" placeholder="Pick several…" />
        <Combobulate.List<string>>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              {api.isSelected(item) ? "✓ " : ""}
              {item}
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>No results</Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof MultiSelect> = {
  title: "Combobulate/Multi Select",
  component: MultiSelect,
};
export default meta;
export const Default: StoryObj<typeof MultiSelect> = {};
