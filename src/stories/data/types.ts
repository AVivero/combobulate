// Only the fields the demos actually read (label + search). The source dataset
// has more (icao, lat/lon, country code); they're stripped from airports.json
// since no demo uses them. Re-add here if a future demo needs them.
export type Airport = {
  iata: string;
  name: string;
  city: string;
  country: string;
};
