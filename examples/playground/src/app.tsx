import { Autocomplete, Combobulate, NestedAutocomplete, useAutocompleteVirtual } from "combobulate";
import Fuse from "fuse.js";
import { useRef, useState } from "react";

const TEN_K = Array.from({ length: 10_000 }, (_, i) => `Item ${i.toString().padStart(5, "0")}`);

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

const NESTED: TreeNode[] = Array.from({ length: 50 }, (_, g) => ({
  id: `group-${g}`,
  label: `Group ${g}`,
  children: Array.from({ length: 40 }, (_, i) => ({
    id: `group-${g}-item-${i}`,
    label: `Group ${g} · Item ${i}`,
  })),
}));

const VARIABLE = Array.from({ length: 2000 }, (_, i) => ({
  id: `v-${i}`,
  label:
    i % 3 === 0
      ? `Item ${i} — a longer, multi-line label that wraps across two or three lines to force a taller measured row height under virtualization`
      : `Item ${i}`,
}));

const CITIES = [
  "Amsterdam",
  "Barcelona",
  "Copenhagen",
  "Dublin",
  "Edinburgh",
  "Florence",
  "Geneva",
  "Helsinki",
  "Istanbul",
  "Lisbon",
];
const cityFuse = new Fuse(CITIES, { threshold: 0.4 });
const fuzzyFilter = (items: string[], query: string) =>
  query ? cityFuse.search(query).map((r) => r.item) : items;

const REMOTE = Array.from({ length: 200 }, (_, i) => `Result ${i}`);

/**
 * Simulated remote-search combobox that toggles `loading` while "fetching".
 * The 600ms delay is intentionally longer than the Fuse.js and in-memory
 * filters above so the "Loading…" live-region state is reliably observable
 * by the e2e suite rather than racing past it.
 */
function AsyncCombobox() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const api = useAutocompleteVirtual({
    items,
    loading,
    filterItems: (list) => list,
    onInputChange: (query) => {
      if (timer.current) clearTimeout(timer.current);
      setLoading(true);
      timer.current = setTimeout(() => {
        setItems(query ? REMOTE.filter((r) => r.toLowerCase().includes(query.toLowerCase())) : []);
        setLoading(false);
      }, 600);
    },
  });
  return (
    <Combobulate.Root api={api}>
      <Combobulate.Input className="cbl-input" placeholder="Remote search…" />
      <Combobulate.List>
        {(item: string, index: number) => (
          <Combobulate.Item item={item} index={index}>
            <div className="cbl-option">{item}</div>
          </Combobulate.Item>
        )}
      </Combobulate.List>
      <Combobulate.LiveRegion />
    </Combobulate.Root>
  );
}

/** Showcase app: a virtualized autocomplete over 10,000 items. */
export function App() {
  return (
    <main style={{ maxWidth: 420, margin: "64px auto", display: "grid", gap: 24 }}>
      <h1>Combobulate</h1>
      <section data-testid="ten-k">
        <h2>10,000 items, virtualized</h2>
        <Autocomplete items={TEN_K} placeholder="Search 10k items…" />
      </section>
      <section data-testid="nested">
        <h2>Virtualized nested tree (2,050 nodes)</h2>
        <NestedAutocomplete
          nodes={NESTED}
          getChildren={(n) => n.children}
          getItemId={(n) => n.id}
          getSearchText={(n) => n.label}
          placeholder="Search groups & items…"
          multiple
          selectAllUnder
        />
      </section>
      <section data-testid="dynamic">
        <h2>Dynamic (measured) row heights</h2>
        <Autocomplete
          items={VARIABLE}
          getSearchText={(n) => n.label}
          getItemId={(n) => n.id}
          renderItem={(n) => n.label}
          estimateSize={() => 40}
          placeholder="Search variable-height rows…"
        />
      </section>
      <section data-testid="fuzzy">
        <h2>Fuzzy filtering (Fuse.js, injected)</h2>
        <Autocomplete items={CITIES} filterItems={fuzzyFilter} placeholder="Fuzzy city search…" />
      </section>
      <section data-testid="async">
        <h2>Async / remote search with loading announcements</h2>
        <AsyncCombobox />
      </section>
    </main>
  );
}
