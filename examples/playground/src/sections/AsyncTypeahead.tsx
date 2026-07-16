/** @jsxImportSource @emotion/react */
import { ThemeProvider, css, keyframes } from "@emotion/react";
import { Autocomplete } from "combobulate";
import Fuse from "fuse.js";
import { useEffect, useRef, useState } from "react";
import { AirportRow } from "../components/AirportRow";
import airportsData from "../data/airports.json";
import type { Airport } from "../data/types";
import { emotionTheme } from "../theme/emotion-theme";

const AIRPORTS = airportsData as Airport[];

/** How long the simulated remote fetch takes to "respond". */
const SIMULATED_LATENCY_MS = 500;
/** Fixed, never-reordered set of placeholder rows — stable string keys
 * (not the loop index) so `noArrayIndexKey` doesn't flag a genuinely
 * static list. */
const SKELETON_ROW_KEYS = ["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4"] as const;

/**
 * Typo-tolerant search over city / airport name / IATA code. Built once at
 * module scope (not per render) since it indexes the whole ~9k-airport
 * dataset; `ignoreLocation` lets a match land anywhere in the field (an IATA
 * code is only 3 characters, so "location" scoring would otherwise punish
 * matches that aren't near the start of the string).
 */
const fuse = new Fuse(AIRPORTS, {
  keys: ["city", "name", "iata"],
  threshold: 0.4,
  ignoreLocation: true,
});

/** Runs as `Autocomplete`'s `filterItems`: fuzzy, so "amstrdam" still finds Amsterdam. */
function fuzzyFilterAirports(items: Airport[], query: string): Airport[] {
  const trimmed = query.trim();
  if (!trimmed) return items;
  return fuse.search(trimmed).map((result) => result.item);
}

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

/**
 * Placeholder rows shown in place of the (already-computed but hidden) real
 * list while `loading` is true, so the simulated latency reads as an actual
 * fetch rather than a frozen UI.
 */
function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {SKELETON_ROW_KEYS.map((key) => (
        <div
          key={key}
          css={(theme) => css`
            height: 20px;
            margin: 8px 12px;
            border-radius: ${theme.radius};
            background: linear-gradient(
              90deg,
              ${theme.color.border} 25%,
              ${theme.color.surface} 37%,
              ${theme.color.border} 63%
            );
            background-size: 400px 100%;
            animation: ${shimmer} 1.4s ease-in-out infinite;
          `}
        />
      ))}
    </div>
  );
}

/**
 * Async airport search: styled with Emotion, built on the `Autocomplete`
 * preset. The real matching (fuzzy, via Fuse) is synchronous and instant,
 * but that's not a very convincing "remote search" — so a `setTimeout`
 * simulates network latency around it. On every keystroke (detected via a
 * native `input` listener on the wrapper, since the preset doesn't expose an
 * `onInputChange` hook) `loading` flips true, any previous debounce timer is
 * cancelled, and a fresh one is scheduled; only once it fires does `loading`
 * flip back to false. While `loading` is true the real listbox/empty-state
 * are hidden (`visibility: hidden`, scoped via the wrapper's `css`) and
 * Emotion skeleton rows render in their place.
 */
export function AsyncTypeahead() {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    /** Set by `handleInput`, cleared by the effect's own cleanup. */
    let deferId: ReturnType<typeof setTimeout> | null = null;

    function handleInput() {
      /**
       * Deferred one macrotask: this listener is attached directly via
       * `addEventListener` (the preset exposes no `onInputChange`), so it
       * fires *before* React's own delegated listener processes the same
       * native "input" event (bubbling reaches this ancestor node first).
       * Calling `setState` synchronously here would trigger a React
       * re-render mid-dispatch using the *stale* (pre-keystroke) input
       * value, which resets the controlled `<input>`'s DOM value back to
       * that stale value — and by the time React's own `onChange` reads
       * `event.target.value` moments later, the keystroke is already gone.
       * Deferring past the current synchronous dispatch (React's onChange
       * included) avoids the race entirely.
       */
      deferId = setTimeout(() => {
        setLoading(true);
        if (debounceRef.current !== null) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          setLoading(false);
        }, SIMULATED_LATENCY_MS);
      }, 0);
    }

    container.addEventListener("input", handleInput);
    return () => {
      container.removeEventListener("input", handleInput);
      if (deferId !== null) clearTimeout(deferId);
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <ThemeProvider theme={emotionTheme}>
      <div
        ref={containerRef}
        css={css`
          position: relative;
          /*
           * "visibility" (not "display") while loading: TanStack Virtual
           * measures the scroll container via ResizeObserver, and a
           * display:none ancestor reports a zero-size box that the
           * virtualizer then never recovers from once un-hidden. Hidden
           * elements are still excluded from the accessibility tree (and
           * from Playwright's visibility checks), which is all we need.
           * "position: absolute" while hidden keeps it out of layout flow so
           * the skeleton rows take its place instead of leaving a blank gap;
           * "!important" is needed because Combobulate.List sets position:
           * relative as an inline style, which otherwise wins over this
           * class rule.
           */
          [role="listbox"],
          output {
            visibility: ${loading ? "hidden" : "visible"};
            position: ${loading ? "absolute !important" : "static"};
          }
        `}
      >
        <Autocomplete<Airport>
          items={AIRPORTS}
          filterItems={fuzzyFilterAirports}
          getItemId={(airport) => airport.iata}
          renderItem={(airport) => (
            <AirportRow
              kind="airport"
              city={airport.city}
              country={airport.country}
              name={airport.name}
              iata={airport.iata}
            />
          )}
          placeholder="Search airports (try a typo)…"
          emptyMessage="No airports match your search."
          loading={loading}
        />
        {loading && <SkeletonRows />}
      </div>
    </ThemeProvider>
  );
}
