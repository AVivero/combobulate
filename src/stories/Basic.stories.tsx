import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";
import { FloatingCombobox } from "./FloatingCombobox";
import "./demo.css";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function Basic() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  return (
    <div style={{ width: 320 }}>
      <FloatingCombobox
        api={api}
        label="City"
        placeholder="Search cities…"
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

const meta: Meta<typeof Basic> = { title: "Combobulate/Basic", component: Basic };
export default meta;
export const Default: StoryObj<typeof Basic> = {};
