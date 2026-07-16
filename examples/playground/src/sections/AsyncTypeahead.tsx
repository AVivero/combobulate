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
 * simulates network latency around it. The preset's `onInputChange` fires on
 * every keystroke: it flips `loading` true, cancels any pending debounce
 * timer, and schedules a fresh one that flips `loading` back to false. While
 * `loading` is true the real listbox/empty-state are hidden
 * (`visibility: hidden`, scoped via the wrapper's `css`) and Emotion skeleton
 * rows render in their place, directly below the input, in normal flow.
 *
 * The `Autocomplete` preset now floats its dropdown (`Combobulate.Popover`):
 * the listbox is an absolutely-positioned overlay anchored to the input, not
 * an in-flow sibling, so it no longer displaces the skeleton rows and there's
 * no blank-gap problem to solve. `visibility: hidden` is still required
 * (otherwise the previous query's floating results would render on top of
 * the skeleton while the new query is in flight); it's kept scoped to
 * `[role="listbox"]`/`output` rather than swapped for hiding the whole
 * `Autocomplete` subtree so TanStack Virtual's scroll-container
 * `ResizeObserver` never sees a zero-size box (see below).
 */
export function AsyncTypeahead() {
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear a pending debounce timer on unmount so it can't setState after teardown.
  useEffect(
    () => () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleInputChange = () => {
    setLoading(true);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setLoading(false);
    }, SIMULATED_LATENCY_MS);
  };

  return (
    <ThemeProvider theme={emotionTheme}>
      <div
        css={css`
          position: relative;
          /*
           * "visibility" (not "display") while loading: TanStack Virtual
           * measures the scroll container via ResizeObserver, and a
           * display:none ancestor reports a zero-size box that the
           * virtualizer then never recovers from once un-hidden. Hidden
           * elements are still excluded from the accessibility tree (and
           * from Playwright's visibility checks), which is all we need.
           * The listbox now renders inside Combobulate.Popover's floating
           * overlay rather than in normal flow, so there's no in-flow gap
           * to fill behind it anymore; "position: absolute" while hidden is
           * kept anyway (rather than dropped as dead weight) because it
           * also takes the hidden listbox out of the popover's own flex
           * layout while loading, which keeps Floating UI's flip/size
           * recalculation working off the same (empty) box both before the
           * query resolves and after — flipping the sizing behavior only
           * while loading toggles risked the popover settling on a
           * different placement once the real results reappear. "!important"
           * is needed because Combobulate.List sets position: static as an
           * inline style, which otherwise wins over this class rule.
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
          onInputChange={handleInputChange}
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
