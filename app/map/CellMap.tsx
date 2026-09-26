"use client";

// The dashboard map: MapLibre with OpenFreeMap's dark style (no key). Each grid cell is a bar raised
// from its geohash square, so the bars match the queue exactly. Loaded only in the browser.

import "maplibre-gl/dist/maplibre-gl.css";
import { IconFocusCentered } from "@tabler/icons-react";
import type { ExpressionSpecification, GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/brand/Button";
import { useStill } from "@/components/brand/MotionPrefs";
import { SonarRings } from "@/components/brand/SonarRings";
import type { CellRow } from "@/lib/shared/contracts";
import { cellBounds, cellCentre } from "@/lib/shared/geo";
import { STATIONS } from "@/lib/shared/stations";
import { cn } from "@/lib/utils";
import { NO_REPORT_COLOUR, SCORE_COLOURS, scoreStep } from "./format";

type MapLibre = typeof import("maplibre-gl");

const STYLE = "https://tiles.openfreemap.org/styles/dark";
const PITCH = 50;
const BEARING = -20;
const LONS = STATIONS.map((s) => s.lon);
const LATS = STATIONS.map((s) => s.lat);
// Opens on all five stations, Hurdman included, with room for the cells around them.
const STATION_BOUNDS: LngLatBoundsLike = [
  [Math.min(...LONS) - 0.0025, Math.min(...LATS) - 0.0015],
  [Math.max(...LONS) + 0.0025, Math.max(...LATS) + 0.0015],
];
// Bar heights in metres. A cell with reports always stands taller than one without.
const SCORED_FLOOR = 40;
const SCORED_RANGE = 320;
const QUIET_FLOOR = 3;
const QUIET_RANGE = 27;
// Cells with no reports can't fade per cell (fill-extrusion-opacity is one value), so busier ones get lighter.
const COLOUR: ExpressionSpecification = [
  "case",
  ["get", "scored"],
  ["get", "colour"],
  ["interpolate", ["linear"], ["get", "busy"], 0, "#353a40", 1, NO_REPORT_COLOUR],
];

// MapLibre's own CSS isn't in a layer, so these need `!` to win.
const CHROME = cn(
  "[&_.maplibregl-ctrl-group]:overflow-hidden [&_.maplibregl-ctrl-group]:rounded-md! [&_.maplibregl-ctrl-group]:border! [&_.maplibregl-ctrl-group]:border-line-strong! [&_.maplibregl-ctrl-group]:bg-abyss/85! [&_.maplibregl-ctrl-group]:shadow-none!",
  "[&_.maplibregl-ctrl-group_button]:size-11! [&_.maplibregl-ctrl-group_button+button]:border-line! [&_.maplibregl-ctrl-group_button:hover]:bg-surface! [&_.maplibregl-ctrl-icon]:invert",
  "[&_.maplibregl-ctrl-attrib]:bg-abyss/80! [&_.maplibregl-ctrl-attrib]:text-muted! [&_.maplibregl-ctrl-attrib_a]:text-muted!",
  "[&_.maplibregl-canvas:focus-visible]:outline-none!",
);

function features(cells: CellRow[]) {
  const top = Math.max(0, ...cells.map((c) => c.score ?? 0));
  const busiest = Math.max(1, ...cells.map((c) => c.events));
  return {
    type: "FeatureCollection" as const,
    features: cells.map((c) => {
      const b = cellBounds(c.cell);
      const busy = c.events / busiest;
      return {
        type: "Feature" as const,
        properties: {
          cell: c.cell,
          scored: c.score !== null,
          colour: c.score === null ? NO_REPORT_COLOUR : SCORE_COLOURS[scoreStep(c.score, top)],
          busy,
          height:
            c.score === null
              ? QUIET_FLOOR + QUIET_RANGE * busy
              : SCORED_FLOOR + SCORED_RANGE * (top > 0 ? c.score / top : 0),
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

function stationPin(name: string) {
  const pin = document.createElement("div");
  pin.className =
    "flex items-center gap-1.5 rounded-md border border-accent bg-abyss px-2.5 py-1 text-sm font-bold text-foreground";
  const dot = document.createElement("span");
  dot.className = "size-1.5 rounded-full bg-accent";
  pin.append(dot, name);
  return pin;
}

export default function CellMap({
  cells,
  selected,
  flashing,
  onSelect,
  emptyNote,
}: {
  cells: CellRow[];
  selected: string | null;
  flashing: ReadonlySet<string>;
  onSelect: (cell: string) => void;
  // Shown over the map while there are no cells to draw.
  emptyNote: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<MapLibre | null>(null);
  const onSelectRef = useRef(onSelect);
  const cellsRef = useRef(cells);
  const still = useStill();
  const stillRef = useRef(still);
  const [ready, setReady] = useState(false);
  const hintId = useId();

  useEffect(() => {
    onSelectRef.current = onSelect;
    cellsRef.current = cells;
    stillRef.current = still;
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    void import("maplibre-gl").then((lib) => {
      if (cancelled || !containerRef.current) return;
      libRef.current = lib;
      // A bundle moves MapLibre away from its worker; scripts/assets.ts serves a copy here.
      lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new lib.Map({
        container: containerRef.current,
        style: STYLE,
        bounds: STATION_BOUNDS,
        fitBoundsOptions: { padding: 40, pitch: PITCH, bearing: BEARING },
        pitch: PITCH,
        bearing: BEARING,
        maxPitch: 65,
        // One finger and the plain scroll wheel move the page, so the map never traps anyone.
        cooperativeGestures: true,
        attributionControl: { compact: false },
        locale: { "Map.Title": "3D map of hazard cells" },
      });
      mapRef.current = map;
      map.getCanvas().setAttribute("aria-describedby", hintId);
      map.addControl(new lib.NavigationControl({ visualizePitch: true }), "top-right");
      for (const s of STATIONS) {
        new lib.Marker({ element: stationPin(s.name) }).setLngLat([s.lon, s.lat]).addTo(map);
      }
      map.on("load", () => {
        if (!map) return;
        map.setPaintProperty("background", "background-color", "#0f141a");
        if (map.getLayer("water")) map.setPaintProperty("water", "fill-color", "#16283a");
        if (map.getLayer("waterway")) map.setPaintProperty("waterway", "line-color", "#16283a");
        map.addSource("cells", { type: "geojson", data: features(cellsRef.current) });
        map.addLayer({
          id: "cell-floors",
          type: "line",
          source: "cells",
          paint: { "line-color": "rgba(175, 190, 200, 0.25)", "line-width": 1 },
        });
        map.addLayer({
          id: "cells",
          type: "fill-extrusion",
          source: "cells",
          paint: {
            "fill-extrusion-color": COLOUR,
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.92,
          },
        });
        map.addLayer({
          id: "cell-selected-floor",
          type: "line",
          source: "cells",
          filter: ["==", ["get", "cell"], ""],
          paint: { "line-color": "#29b8ff", "line-width": 4 },
        });
        // A light lid on the selected bar, so it stands out from any colour.
        map.addLayer({
          id: "cell-selected",
          type: "fill-extrusion",
          source: "cells",
          filter: ["==", ["get", "cell"], ""],
          paint: {
            "fill-extrusion-color": "#eef3f6",
            "fill-extrusion-base": ["get", "height"],
            "fill-extrusion-height": ["+", ["get", "height"], 20],
            "fill-extrusion-opacity": 1,
          },
        });
        map.on("click", "cells", (e) => {
          const cell = e.features?.[0]?.properties?.cell;
          if (typeof cell === "string") onSelectRef.current(cell);
        });
        map.on("mouseenter", "cells", () => map && (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "cells", () => map && (map.getCanvas().style.cursor = ""));
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [hintId]);

  useEffect(() => {
    const source = mapRef.current?.getSource("cells") as GeoJSONSource | undefined;
    if (ready && source) source.setData(features(cells));
  }, [cells, ready]);

  // Fly to the selected cell and put a lid on its bar.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const filter: ExpressionSpecification = ["==", ["get", "cell"], selected ?? ""];
    map.setFilter("cell-selected", filter);
    map.setFilter("cell-selected-floor", filter);
    if (!selected) return;
    const c = cellCentre(selected);
    // Below the centre, so the bar rising from it stays in view.
    const camera = {
      center: [c.lon, c.lat] as [number, number],
      zoom: 14.9,
      pitch: PITCH,
      offset: [0, 70] as [number, number],
    };
    if (stillRef.current) map.easeTo({ ...camera, duration: 0 });
    else map.flyTo({ ...camera, duration: 1600 });
  }, [selected, ready]);

  // A sonar ring on the ground where each new report lands.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready || flashing.size === 0) return;
    const rings = [...flashing].map((cell) => {
      const el = document.createElement("div");
      el.className = "pointer-events-none size-40";
      const root = createRoot(el);
      root.render(
        <>
          <SonarRings className="inset-0" count={3} duration={2} />
          <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full bg-accent" />
        </>,
      );
      const c = cellCentre(cell);
      const marker = new lib.Marker({ element: el, pitchAlignment: "map", rotationAlignment: "map" })
        .setLngLat([c.lon, c.lat])
        .addTo(map);
      return { marker, root };
    });
    return () => {
      for (const { marker, root } of rings) {
        marker.remove();
        // React can't unmount one root while it is committing another.
        setTimeout(() => root.unmount(), 0);
      }
    };
  }, [flashing, ready]);

  const showAll = () => {
    mapRef.current?.fitBounds(STATION_BOUNDS, {
      padding: 40,
      pitch: PITCH,
      bearing: BEARING,
      duration: stillRef.current ? 0 : 1400,
    });
  };

  return (
    // The focus ring goes on this wrapper, since it clips anything drawn around the canvas.
    <div className="relative isolate h-[60svh] min-h-80 w-full overflow-hidden bg-abyss ring-1 ring-line has-[.maplibregl-canvas:focus-visible]:outline-3 has-[.maplibregl-canvas:focus-visible]:outline-offset-3 has-[.maplibregl-canvas:focus-visible]:outline-(--focus) lg:h-[36rem]">
      <div ref={containerRef} className={cn("size-full", CHROME)} />
      <p id={hintId} className="sr-only">
        Arrow keys move the map, and plus and minus zoom. Every spot on the map is also in the fix-first queue table.
      </p>
      <Button
        variant="secondary"
        onClick={showAll}
        className="absolute top-3 left-3 z-[2] min-h-11 bg-abyss/85 px-4 text-sm"
      >
        <IconFocusCentered aria-hidden size={20} />
        All stations
      </Button>
      {emptyNote && (
        <p className="absolute inset-x-3 bottom-12 z-[2] mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-md border border-line-strong bg-abyss px-4 py-2 text-center text-base text-muted">
          {emptyNote}
        </p>
      )}
    </div>
  );
}
