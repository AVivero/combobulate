import { Section } from "./components/Section";
import { Hero } from "./sections/Hero";
import { NestedGeography } from "./sections/NestedGeography";
import { ThemeToggle } from "./theme/ThemeToggle";

const REPO_URL = "https://github.com/alexvivero/combobulate";

/** Placeholder shown for a section until its task fills in the real component. */
function ComingSoon({ note }: { note: string }) {
  return (
    <p className="rounded-token border border-dashed border-border p-4 text-sm text-muted">
      {note}
    </p>
  );
}

/** Travel-showcase page shell: header, hero, four pattern cards, footer. */
export function App() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-text">Combobulate</h1>
            <p className="text-sm text-muted">
              A travel-search showcase for the headless, virtualized autocomplete toolkit.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-token border border-border px-3 py-1.5 text-sm text-text"
            >
              GitHub
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <Section
          testid="hero"
          title="Flight search"
          badge="Tailwind"
          description="Origin/destination comboboxes built directly on the Combobulate primitives, with metro rollups and a swap control."
        >
          <Hero />
        </Section>

        <Section
          testid="nested"
          title="Nested geography"
          badge="Tailwind"
          description="Country → City → Airport, browsed and multi-selected with NestedAutocomplete."
        >
          <NestedGeography />
        </Section>

        <Section
          testid="async"
          title="Async typeahead"
          badge="Emotion"
          description="A simulated remote search with loading skeletons and typo-tolerant fuzzy matching."
        >
          <ComingSoon note="Coming up: an async airport search with loading states." />
        </Section>

        <Section
          testid="multi"
          title="Multi-select chips"
          badge="Emotion"
          description="Selected airports render as removable chips, driven by the headless hook."
        >
          <ComingSoon note="Coming up: multi-select airport chips." />
        </Section>

        <Section
          testid="world"
          title="World airports"
          badge="Tailwind"
          description="The full ~9k-airport dataset in a single virtualized, variable-height list."
        >
          <ComingSoon note="Coming up: the full virtualized world-airports list." />
        </Section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-muted">
          <a href={REPO_URL} className="underline">
            combobulate
          </a>{" "}
          — the headless toolkit for accessible, virtualized autocompletes.
        </div>
      </footer>
    </div>
  );
}
