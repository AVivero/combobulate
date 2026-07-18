import type { Meta, StoryObj } from "@storybook/react";
import { Combobulate, useCombobulate } from "../index";
import { useSelectionInInput } from "./useSelectionInInput";
import "./demo.css";

const CITIES = ["Paris", "Madrid", "Berlin", "Málaga", "Lisbon", "Rome", "Vienna", "Prague"];

/**
 * The demos default to a floating dropdown (see every other story). This one
 * shows the alternative: an **in-flow (relative)** list that lives in the page
 * flow and pushes content below it down, instead of floating over. You get it
 * by simply NOT using the floating layer — render `Combobulate.List` directly,
 * no `useAutocompleteFloating` / `Combobulate.Popover`. Useful when the
 * combobox owns its own region (e.g. a full-page search, a sidebar filter).
 */
function Relative() {
  const api = useCombobulate({ items: CITIES, defaultOpen: true, getItemId: (c) => c });
  useSelectionInInput(api);
  return (
    <div style={{ width: 320 }}>
      <Combobulate.Root api={api} label="City">
        <Combobulate.Input aria-label="City" placeholder="Search cities…" />
        <div className="cbl-panel" style={{ marginTop: 6 }}>
          <Combobulate.List<string>>
            {(item, index) => (
              <Combobulate.Item item={item} index={index}>
                {item}
              </Combobulate.Item>
            )}
          </Combobulate.List>
          <Combobulate.Empty>No results</Combobulate.Empty>
        </div>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
      <p style={{ marginTop: 8, fontSize: 12, color: "#71717a" }}>
        The list is in the page flow — this paragraph sits below it and moves as the list grows.
      </p>
    </div>
  );
}

const meta: Meta<typeof Relative> = { title: "Combobulate/Relative", component: Relative };
export default meta;
export const Default: StoryObj<typeof Relative> = {};
