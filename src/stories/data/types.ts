export type Airport = {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
};

export type GeoNode = {
  id: string;
  label: string;
  kind: "country" | "city" | "airport";
  airport?: Airport;
  children?: GeoNode[];
};
