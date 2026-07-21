import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { Combobulate, normalizeText } from "../index";
import { FloatingCombobox } from "./FloatingCombobox";
import { airportLabel, airportSearchText } from "./data/airport-label";
import airports from "./data/airports.json";
import type { Airport } from "./data/types";
import { useDemoCombobox } from "./useDemoCombobox";
import "./demo.css";

const ALL = airports as Airport[];

/**
 * Simulates a remote search: debounce-free, 400ms latency, plain "includes"
 * matching on the server side (this story is about the async/loading pattern,
 * not fuzzy matching — see the Fuzzy Search story for that).
 */
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
    const q = normalizeText(query);
    const timer = setTimeout(() => {
      setItems(ALL.filter((a) => normalizeText(airportSearchText(a)).includes(q)).slice(0, 50));
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);
  return { items, loading };
}

function AsyncTypeahead() {
  const [query, setQuery] = useState("");
  const { items, loading } = useRemoteSearch(query);
  const { api, inputProps } = useDemoCombobox({
    items,
    loading,
    getItemId: (a) => a.iata,
    itemToInputValue: airportLabel,
    onInputChange: setQuery,
    // Results are already matched by the "server" — don't filter again.
    filterItems: (list) => list,
  });
  return (
    <div style={{ width: 380 }}>
      <FloatingCombobox
        api={api}
        inputProps={inputProps}
        label="Airport"
        placeholder="Type 2+ characters…"
        emptyMessage={loading ? "Searching…" : "No airports match"}
      >
        {(item, index) => (
          <Combobulate.Item item={item} index={index}>
            {airportLabel(item)}
          </Combobulate.Item>
        )}
      </FloatingCombobox>
    </div>
  );
}

const meta: Meta<typeof AsyncTypeahead> = {
  title: "Combobulate/Async Typeahead",
  component: AsyncTypeahead,
};
export default meta;
export const Default: StoryObj<typeof AsyncTypeahead> = {};
