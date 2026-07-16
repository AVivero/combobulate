import { Autocomplete, NestedAutocomplete } from "combobulate";

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
    </main>
  );
}
