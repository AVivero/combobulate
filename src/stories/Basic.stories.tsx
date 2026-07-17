import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";
import "./demo.css";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

function Basic() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  return (
    <div style={{ width: 320 }}>
      <Combobulate.Root api={api} label="Cities">
        <Combobulate.Input aria-label="City" placeholder="Search cities…" />
        <Combobulate.List<string>>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
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

const meta: Meta<typeof Basic> = { title: "Combobulate/Basic", component: Basic };
export default meta;
export const Default: StoryObj<typeof Basic> = {};
