/** @jsxImportSource @emotion/react */
import { ThemeProvider, css } from "@emotion/react";
import { Combobulate, useAutocompleteVirtual } from "combobulate";
import { AirportRow } from "../components/AirportRow";
import airportsData from "../data/airports.json";
import type { Airport } from "../data/types";
import { emotionTheme } from "../theme/emotion-theme";

const AIRPORTS = airportsData as Airport[];

/** Searchable text: city, country, IATA, and full name. */
function searchText(airport: Airport): string {
  return `${airport.city} ${airport.country} ${airport.iata} ${airport.name}`;
}

/**
 * Multi-select airport picker built directly on the headless
 * `useAutocompleteVirtual` hook + `Combobulate` primitives (not the
 * `Autocomplete` preset): removing a chip has to drive the combo's own
 * selection state, which the preset owns internally and doesn't expose a way
 * to reach into from the outside.
 */
export function MultiSelectChips() {
  const api = useAutocompleteVirtual<Airport>({
    items: AIRPORTS,
    getItemId: (airport) => airport.iata,
    getSearchText: searchText,
    multiple: true,
  });

  return (
    <ThemeProvider theme={emotionTheme}>
      <div>
        {api.selectedItems.length > 0 && (
          <ul
            aria-label="Selected airports"
            css={css`
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin: 0 0 10px;
              padding: 0;
              list-style: none;
            `}
          >
            {api.selectedItems.map((airport) => (
              <li
                key={airport.iata}
                css={(theme) => css`
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  border-radius: 999px;
                  border: 1px solid ${theme.color.border};
                  background: ${theme.color.surface};
                  padding: 4px 6px 4px 12px;
                  font-size: 0.8125rem;
                  color: ${theme.color.text};
                  box-shadow: ${theme.shadow};
                `}
              >
                <span>
                  {airport.city} <span css={css({ opacity: 0.6 })}>({airport.iata})</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${airport.iata}`}
                  onClick={() => api.select(airport)}
                  css={(theme) => css`
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 18px;
                    height: 18px;
                    border-radius: 999px;
                    border: none;
                    background: transparent;
                    color: ${theme.color.muted};
                    cursor: pointer;
                    line-height: 1;
                    font-size: 0.9rem;

                    &:hover {
                      background: ${theme.color.border};
                      color: ${theme.color.text};
                    }
                  `}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <Combobulate.Root api={api}>
          <div css={{ position: "relative" }}>
            <Combobulate.Input
              aria-label="Search airports to add"
              placeholder="Add an airport…"
              css={(theme) => css`
                width: 100%;
                border-radius: ${theme.radius};
                border: 1px solid ${theme.color.border};
                background: ${theme.color.surface};
                color: ${theme.color.text};
                padding: 8px 12px;
                font-size: 0.875rem;
                outline: none;

                &:focus {
                  border-color: ${theme.color.accent};
                }
              `}
            />
            <Combobulate.List>
              {(airport: Airport, index: number) => (
                <Combobulate.Item item={airport} index={index}>
                  <AirportRow
                    kind="airport"
                    city={airport.city}
                    country={airport.country}
                    name={airport.name}
                    iata={airport.iata}
                  />
                </Combobulate.Item>
              )}
            </Combobulate.List>
            <Combobulate.Empty>No airports match your search.</Combobulate.Empty>
          </div>
          <Combobulate.LiveRegion />
        </Combobulate.Root>

        <p
          css={(theme) => css`
            margin: 8px 0 0;
            font-size: 0.75rem;
            color: ${theme.color.muted};
          `}
        >
          {api.selectedItems.length} selected
        </p>
      </div>
    </ThemeProvider>
  );
}
