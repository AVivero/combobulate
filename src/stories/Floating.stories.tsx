import type { Meta, StoryObj } from "@storybook/react";
import type { Ref } from "react";
import { Combobulate, useAutocompleteFloating, useCombobulate } from "../index";
import "./demo.css";

const CITIES = Array.from({ length: 400 }, (_, i) => `City ${i}`);

function Floating() {
  const api = useCombobulate({ items: CITIES, getItemId: (c) => c });
  const floating = useAutocompleteFloating(api, { closeOnSelect: true });
  return (
    <div style={{ width: 320 }}>
      <Combobulate.Root api={api} label="Cities">
        <Combobulate.Input
          ref={floating.reference as unknown as Ref<HTMLInputElement>}
          {...floating.referenceProps}
          aria-label="City"
          placeholder="Floating dropdown…"
        />
        <Combobulate.Popover floating={floating}>
          {/* Popover positions the dropdown but ships no visual chrome of its
              own — this card is the story's, not the library's. */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #d4d4d8",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
              padding: 8,
            }}
          >
            <Combobulate.List<string>>
              {(item, index) => (
                <Combobulate.Item item={item} index={index}>
                  {item}
                </Combobulate.Item>
              )}
            </Combobulate.List>
          </div>
        </Combobulate.Popover>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof Floating> = { title: "Combobulate/Floating", component: Floating };
export default meta;
export const Default: StoryObj<typeof Floating> = {};
