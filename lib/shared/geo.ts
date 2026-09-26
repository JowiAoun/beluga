// Location coarsening and grid cells. The phone and backend intake both call these,
// so a live event and a seeded one land in the same cell for the same place.

import ngeohash from "ngeohash";
import { COARSENING } from "./params";

const SCALE = 10 ** COARSENING.decimals;
const CELL_PATTERN = new RegExp(`^[0-9bcdefghjkmnpqrstuvwxyz]{${COARSENING.geohashLength}}$`);

export interface LatLon {
  lat: number;
  lon: number;
}

// About 100 m. The backend runs this again on every event, so a phone can't send finer.
export function coarsen(lat: number, lon: number): LatLon {
  return { lat: Math.round(lat * SCALE) / SCALE, lon: Math.round(lon * SCALE) / SCALE };
}

export function cellOf(lat: number, lon: number): string {
  const c = coarsen(lat, lon);
  return ngeohash.encode(c.lat, c.lon, COARSENING.geohashLength);
}

export function isCell(value: string): boolean {
  return CELL_PATTERN.test(value);
}

// Centre and bounds of a cell, for drawing it as a square on the map.
export function cellCentre(cell: string): LatLon {
  const { latitude, longitude } = ngeohash.decode(cell);
  return { lat: latitude, lon: longitude };
}

export function cellBounds(cell: string): { south: number; west: number; north: number; east: number } {
  const [south, west, north, east] = ngeohash.decode_bbox(cell);
  return { south, west, north, east };
}
