"use client";

// The dashboard map: MapLibre with OpenFreeMap's no-key style, and each grid cell drawn as a square
// from its geohash bounds, so the squares match the queue exactly. Loaded only in the browser.

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { CellRow } from "@/lib/shared/contracts";
import { cellBounds } from "@/lib/shared/geo";
import { STATIONS } from "@/lib/shared/stations";
import { NO_REPORT_COLOUR, SCORE_COLOURS, scoreStep } from "./format";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const CENTRE: [number, number] = [-75.688, 45.4205];

function features(cells: CellRow[], flashing: ReadonlySet<string>) {
  const top = Math.max(0, ...cells.map((c) => c.score ?? 0));
  const busiest = Math.max(1, ...cells.map((c) => c.events));
  return {
    type: "FeatureCollection" as const,
    features: cells.map((c) => {
      const b = cellBounds(c.cell);
      return {
        type: "Feature" as const,
        properties: {
          cell: c.cell,
          colour: c.score === null ? NO_REPORT_COLOUR : SCORE_COLOURS[scoreStep(c.score, top)],
          // Cells with no reports fade by how busy they are.
          opacity: c.score === null ? 0.15 + 0.35 * (c.events / busiest) : 0.7,
          flash: flashing.has(c.cell) ? 1 : 0,
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [b.west, b.south],
              [b.east, b.south],
              [b.east, b.north],
              [b.west, b.north],
              [b.west, b.south],
            ],
          ],
        },
      };
    }),
  };
}

export default function CellMap({
  cells,
  selected,
  flashing,
  onSelect,
}: {
  cells: CellRow[];
  selected: string | null;
  flashing: ReadonlySet<string>;
  onSelect: (cell: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const dataRef = useRef({ cells, flashing });

  useEffect(() => {
    onSelectRef.current = onSelect;
    dataRef.current = { cells, flashing };
    const source = mapRef.current?.getSource("cells") as GeoJSONSource | undefined;
    if (readyRef.current && source) source.setData(features(cells, flashing));
  }, [cells, flashing, onSelect]);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    void import("maplibre-gl").then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
      if (cancelled || !containerRef.current) return;
      // A bundle moves MapLibre away from its worker; scripts/assets.ts serves a copy here.
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      // Opens on all five stations, Hurdman included.
      const lons = STATIONS.map((st) => st.lon);
      const lats = STATIONS.map((st) => st.lat);
      map = new Map({
        container: containerRef.current,
        style: STYLE,
        center: CENTRE,
        bounds: [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        fitBoundsOptions: { padding: 50 },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }));
      for (const s of STATIONS) {
        const pin = document.createElement("div");
        pin.className = "rounded bg-black px-1.5 py-0.5 text-xs font-semibold text-white ring-2 ring-white";
        pin.textContent = s.name;
        new Marker({ element: pin }).setLngLat([s.lon, s.lat]).addTo(map);
      }
      map.on("load", () => {
        if (!map) return;
        map.addSource("cells", { type: "geojson", data: features(dataRef.current.cells, dataRef.current.flashing) });
        map.addLayer({
          id: "cells",
          type: "fill",
          source: "cells",
          paint: { "fill-color": ["get", "colour"], "fill-opacity": ["get", "opacity"] },
        });
        map.addLayer({
          id: "cell-edges",
          type: "line",
          source: "cells",
          paint: {
            "line-color": ["case", ["==", ["get", "flash"], 1], "#fde047", "#111827"],
            "line-width": ["case", ["==", ["get", "flash"], 1], 4, 0.5],
          },
        });
        map.addLayer({
          id: "cell-selected",
          type: "line",
          source: "cells",
          filter: ["==", ["get", "cell"], ""],
          paint: { "line-color": "#ffffff", "line-width": 3 },
        });
        map.on("click", "cells", (e) => {
          const cell = e.features?.[0]?.properties?.cell;
          if (typeof cell === "string") onSelectRef.current(cell);
        });
        map.on("mouseenter", "cells", () => map && (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "cells", () => map && (map.getCanvas().style.cursor = ""));
        readyRef.current = true;
      });
    });
    return () => {
      cancelled = true;
      readyRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to the selected cell and outline it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setFilter("cell-selected", ["==", ["get", "cell"], selected ?? ""]);
    if (!selected) return;
    const b = cellBounds(selected);
    map.flyTo({ center: [(b.west + b.east) / 2, (b.south + b.north) / 2], zoom: 15.5 });
  }, [selected]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of hazard cells around the five stations"
      className="h-[28rem] w-full overflow-hidden rounded-lg"
    />
  );
}
