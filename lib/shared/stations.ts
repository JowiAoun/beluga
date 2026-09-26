// The five O-Train stations the demo covers. Positions are approximate; check them
// against OC Transpo's stop list before the seed runs (Phase 6, migration 002).

export const STATIONS = [
  { id: "uottawa", name: "uOttawa", lat: 45.4205, lon: -75.6828 },
  { id: "rideau", name: "Rideau", lat: 45.4265, lon: -75.692 },
  { id: "parliament", name: "Parliament", lat: 45.4215, lon: -75.699 },
  { id: "lyon", name: "Lyon", lat: 45.419, lon: -75.704 },
  { id: "hurdman", name: "Hurdman", lat: 45.4125, lon: -75.6645 },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];

export function stationById(id: string) {
  return STATIONS.find((s) => s.id === id);
}
