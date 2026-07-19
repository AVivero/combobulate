import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate } from "../index";
import { FloatingCombobox } from "./FloatingCombobox";
import { useDemoCombobox } from "./useDemoCombobox";
import "./demo.css";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function Basic() {
  // Default filtering: the library's normalized "includes" match.
  const { api, inputProps } = useDemoCombobox({ items: CITIES, getItemId: (c) => c });
  return (
    <div style={{ width: 320 }}>
      <FloatingCombobox
        api={api}
        inputProps={inputProps}
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
