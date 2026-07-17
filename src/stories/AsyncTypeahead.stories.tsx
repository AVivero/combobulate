import type { Meta, StoryObj } from "@storybook/react";
import Fuse from "fuse.js";
import { useEffect, useState } from "react";
import { Combobulate, useCombobulate } from "../index";
import { airportLabel } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";
import "./demo.css";

const ALL = airports as Airport[];
// "country" is included so the ~50 real-world airports with a blank `city`
// (e.g. AXR, BQL, BRK) are still reachable by search.
const fuse = new Fuse(ALL, {
  keys: ["city", "name", "iata", "country"],
  threshold: 0.3,
  ignoreLocation: true,
});

/** Simulates a remote search: debounce-free, 400ms latency, Fuse-ranked. */
function useRemoteSearch(query: string) {
  const [items, setItems] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (query.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      setItems(
        fuse
          .search(query)
          .slice(0, 50)
          .map((r) => r.item),
      );
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);
  return { items, loading };
}

function AsyncTypeahead() {
  const [query, setQuery] = useState("");
  const { items, loading } = useRemoteSearch(query);
  const api = useCombobulate({
    items,
    loading,
    getItemId: (a) => a.iata,
    onInputChange: setQuery,
    // Results are already ranked by the "server" — don't filter again.
    filterItems: (list) => list,
  });
  return (
    <div style={{ width: 380 }}>
      <Combobulate.Root api={api} label="Remote airport search">
        <Combobulate.Input aria-label="Airport" placeholder="Type 2+ characters…" />
        <Combobulate.List<Airport>>
          {(item, index) => (
            <Combobulate.Item item={item} index={index}>
              {airportLabel(item)}
            </Combobulate.Item>
          )}
        </Combobulate.List>
        <Combobulate.Empty>{loading ? "Searching…" : "No airports match"}</Combobulate.Empty>
        <Combobulate.LiveRegion />
      </Combobulate.Root>
    </div>
  );
}

const meta: Meta<typeof AsyncTypeahead> = {
  title: "Combobulate/Async Typeahead",
  component: AsyncTypeahead,
};
export default meta;
export const Default: StoryObj<typeof AsyncTypeahead> = {};
