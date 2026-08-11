import { useSyncExternalStore } from "react";
import { Booking } from "./Booking";
import { MultiControlled } from "./MultiControlled";
import { MultiUncontrolled } from "./MultiUncontrolled";
import { SingleControlled } from "./SingleControlled";
import { SingleUncontrolled } from "./SingleUncontrolled";
import { Themeable } from "./Themeable";

const EXAMPLES = [
  { id: "single-uncontrolled", label: "Single · Uncontrolled", Component: SingleUncontrolled },
  { id: "single-controlled", label: "Single · Controlled", Component: SingleControlled },
  { id: "multi-uncontrolled", label: "Multi · Uncontrolled", Component: MultiUncontrolled },
  { id: "multi-controlled", label: "Multi · Controlled", Component: MultiControlled },
  { id: "themeable", label: "Themeable (CSS-in-JS)", Component: Themeable },
  { id: "booking", label: "Linked (booking)", Component: Booking },
] as const;

const subscribeHash = (cb: () => void): (() => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const currentHash = (): string => window.location.hash.replace(/^#\/?/, "") || EXAMPLES[0].id;

export function App() {
  const active = useSyncExternalStore(subscribeHash, currentHash, () => EXAMPLES[0].id);
  const current = EXAMPLES.find((example) => example.id === active) ?? EXAMPLES[0];
  const Active = current.Component;
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <nav className="w-56 shrink-0 border-r border-zinc-200 bg-white p-3">
        <div className="px-2 py-2 text-sm font-semibold text-zinc-500">combobulate</div>
        <ul className="space-y-0.5">
          {EXAMPLES.map((example) => (
            <li key={example.id}>
              <a
                href={`#/${example.id}`}
                className={`block rounded-md px-2 py-1.5 text-sm ${
                  example.id === current.id
                    ? "bg-indigo-50 font-medium text-indigo-800"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {example.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex flex-1 items-center justify-center p-10">
        <Active />
      </main>
    </div>
  );
}
