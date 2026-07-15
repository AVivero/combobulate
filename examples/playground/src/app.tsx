import { Autocomplete } from "combobulate";

const TEN_K = Array.from({ length: 10_000 }, (_, i) => `Item ${i.toString().padStart(5, "0")}`);

/** Showcase app: a virtualized autocomplete over 10,000 items. */
export function App() {
  return (
    <main style={{ maxWidth: 420, margin: "64px auto", display: "grid", gap: 24 }}>
      <h1>Combobulate</h1>
      <section data-testid="ten-k">
        <h2>10,000 items, virtualized</h2>
        <Autocomplete items={TEN_K} placeholder="Search 10k items…" />
      </section>
    </main>
  );
}
