// Tiger Data prize: 14 days of simulated walks around the five O-Train stations, for the
// dashboard's map, queue and trends. Every row is source = simulated. Seeded, so reruns give the
// same data. Severities come from the same rules as live reports (lib/shared/reporting).

import type { CivicCategory, DetectorClass, HazardKind, SceneContext } from "@/lib/shared/enums";
import { cellOf, coarsen } from "@/lib/shared/geo";
import { SEED } from "@/lib/shared/params";
import { measuredFrom, severityFor, type TriageAnswers } from "@/lib/shared/reporting";
import { STATIONS, type StationId } from "@/lib/shared/stations";

export interface SeedRow {
  time: Date;
  deviceKey: string | null;
  eventKind: "hazard_seen" | "near_miss" | "civic_report";
  hazardKind: HazardKind;
  detectorClass: DetectorClass;
  civicCategory: CivicCategory | null;
  severity: number | null;
  confidence: number | null;
  description: string | null;
  closestM: number;
  angleDeg: number;
  headingDeg: number;
  lat: number;
  lon: number;
  cell: string;
  stationId: StationId | null;
  context: string | null;
}

interface Story {
  station: StationId;
  // Weight by local hour, weekday.
  hourWeight: (hour: number, weekday: boolean) => number;
  hazards: Array<{ kind: HazardKind; classes: DetectorClass[]; weight: number }>;
  nearMissShare: number;
  // Civic reports, as a share of events, at a few recurring spots.
  report: {
    category: CivicCategory;
    rate: number;
    spots: number;
    // Metres from the station the spots sit within.
    radiusM: number;
    // Yes/no answers per spot, which pick its severity through the live rules.
    answers: (spot: number) => TriageAnswers;
    descriptions: string[];
    kind: HazardKind;
    classes: DetectorClass[];
    context: SceneContext;
    // Only report in these local hours, weekday or not.
    when?: (hour: number, weekday: boolean) => boolean;
  };
  // Metres from the station that walks wander.
  roamM: number;
  // Drop-off events stay this close to the platform.
  platformM: number;
}

// Rush hours at 07:00 to 09:00 and 16:00 to 18:00, quiet overnight.
const RUSH = [
  0.1, 0.05, 0.05, 0.05, 0.05, 0.2, 0.6, 1.5, 1.8, 1.2, 0.8, 0.8, 0.9, 0.8, 0.8, 1.0, 1.5, 1.8, 1.4, 1.0, 0.8, 0.6, 0.4,
  0.2,
];
const rush = (hour: number, weekday: boolean) => RUSH[hour] * (weekday ? 1 : 0.6);

const answers = (over: Partial<TriageAnswers>): TriageAnswers => ({
  isPublic: true,
  leftOrFixed: true,
  wayAround: "narrow",
  caneWarning: false,
  tripOrDrop: false,
  ...over,
});

export const STORIES: Story[] = [
  {
    station: "uottawa",
    // Evening e-scooter clusters on campus sidewalks.
    hourWeight: (h, w) => rush(h, w) + (h >= 17 && h <= 22 ? 1.2 : 0),
    hazards: [
      { kind: "obstacle", classes: ["bicycle", "motorcycle", "unknown"], weight: 5 },
      { kind: "obstacle", classes: ["person", "bench", "chair"], weight: 3 },
      { kind: "drop_off", classes: ["unknown"], weight: 1 },
    ],
    nearMissShare: 0.2,
    report: {
      category: "sidewalk_obstruction",
      rate: 0.025,
      spots: 12,
      radiusM: 400,
      answers: (spot) => answers({ wayAround: spot % 3 === 0 ? "none" : "narrow" }),
      descriptions: [
        "E-scooter lying across the sidewalk",
        "Two scooters parked across the path",
        "Rental scooter blocking the walkway",
      ],
      kind: "obstacle",
      classes: ["motorcycle", "bicycle", "unknown"],
      context: "sidewalk",
      when: (h) => h >= 16 || h <= 1,
    },
    roamM: 400,
    platformM: 20,
  },
  {
    station: "rideau",
    // Rush-hour crowding and platform-edge near-misses.
    hourWeight: (h, w) => rush(h, w) * 1.3,
    hazards: [
      { kind: "drop_off", classes: ["unknown"], weight: 4 },
      { kind: "obstacle", classes: ["person"], weight: 5 },
      { kind: "obstacle", classes: ["unknown", "suitcase"], weight: 1 },
    ],
    nearMissShare: 0.35,
    report: {
      category: "tactile_strip_issue",
      rate: 0.004,
      spots: 3,
      radiusM: 25,
      answers: () => answers({ wayAround: "clear" }),
      descriptions: ["Yellow warning strip worn away at the platform edge", "Tactile strip missing along the platform"],
      kind: "drop_off",
      classes: ["unknown"],
      context: "platform",
    },
    roamM: 300,
    platformM: 20,
  },
  {
    station: "parliament",
    // Head-height signage and hoarding near the entrances.
    hourWeight: rush,
    hazards: [
      { kind: "head_height", classes: ["unknown", "stop_sign"], weight: 3 },
      { kind: "obstacle", classes: ["person", "unknown"], weight: 4 },
      { kind: "drop_off", classes: ["unknown"], weight: 1 },
    ],
    nearMissShare: 0.2,
    report: {
      category: "head_height_hazard",
      rate: 0.02,
      spots: 8,
      radiusM: 250,
      answers: () => answers({ wayAround: "clear" }),
      descriptions: [
        "Sign sticking out at head height by the entrance",
        "Hoarding panel overhanging the sidewalk at head height",
      ],
      kind: "head_height",
      classes: ["unknown", "stop_sign"],
      context: "sidewalk",
    },
    roamM: 350,
    platformM: 20,
  },
  {
    station: "lyon",
    // Weekday construction barriers, 07:00 to 18:00.
    hourWeight: rush,
    hazards: [
      { kind: "obstacle", classes: ["unknown"], weight: 5 },
      { kind: "obstacle", classes: ["person", "truck"], weight: 2 },
      { kind: "drop_off", classes: ["unknown"], weight: 1 },
    ],
    nearMissShare: 0.2,
    report: {
      category: "construction_barrier",
      rate: 0.02,
      spots: 10,
      radiusM: 350,
      answers: (spot) => answers({ caneWarning: spot % 2 === 0 }),
      descriptions: [
        "Construction fencing across the sidewalk",
        "Barrier with no cane-detectable edge",
        "Work zone closes the walkway",
      ],
      kind: "obstacle",
      classes: ["unknown"],
      context: "sidewalk",
      when: (h, w) => w && h >= 7 && h < 18,
    },
    roamM: 400,
    platformM: 20,
  },
  {
    station: "hurdman",
    // Transfer-platform edge near-misses at bus and rail peaks.
    hourWeight: (h, w) => rush(h, w) * 1.2,
    hazards: [
      { kind: "drop_off", classes: ["unknown"], weight: 5 },
      { kind: "obstacle", classes: ["person", "bus"], weight: 3 },
    ],
    nearMissShare: 0.35,
    report: {
      category: "surface_damage",
      rate: 0.008,
      spots: 8,
      radiusM: 150,
      answers: (spot) => answers({ tripOrDrop: spot % 2 === 1 }),
      descriptions: ["Broken curb at the bus platform", "Heaved slab by the transfer walkway"],
      kind: "obstacle",
      classes: ["unknown"],
      context: "platform",
    },
    roamM: 300,
    platformM: 20,
  },
];

// Mulberry32: small, fast and seeded.
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const M_PER_DEG_LAT = 111_320;

// A random point within `radiusM` of a place, rounded the way the phone rounds it.
function near(lat: number, lon: number, rand: () => number, radiusM: number): { lat: number; lon: number } {
  const r = radiusM * Math.sqrt(rand());
  const a = rand() * 2 * Math.PI;
  return coarsen(
    lat + (r * Math.cos(a)) / M_PER_DEG_LAT,
    lon + (r * Math.sin(a)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)),
  );
}

function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (a.lat - b.lat) * M_PER_DEG_LAT;
  const dLon = (a.lon - b.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

// Nearest station within 150 m, as intake would fill it.
function stationNear(p: { lat: number; lon: number }): StationId | null {
  let best: StationId | null = null;
  let bestM = 150;
  for (const s of STATIONS) {
    const m = metresBetween(p, s);
    if (m <= bestM) {
      best = s.id;
      bestM = m;
    }
  }
  return best;
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

function weighted<T extends { weight: number }>(items: readonly T[], rand: () => number): T {
  let left = rand() * items.reduce((sum, i) => sum + i.weight, 0);
  for (const item of items) if ((left -= item.weight) <= 0) return item;
  return items[items.length - 1];
}

// A few spots collect most reports, so the queue ranks dozens of places, not thousands.
function spotIndex(spots: number, rand: () => number): number {
  return Math.min(spots - 1, Math.floor(spots * rand() ** 2));
}

// The description on the reporters `npm run demo-spot` stages. A reload of the fortnight keeps them.
export const STAGED_DESCRIPTION = "Staged demo reporter (simulated)";

// September and October in Ottawa are UTC-4.
const LOCAL_OFFSET_H = -4;
const HOUR_MS = 3_600_000;

// Midnight in Ottawa on the day of `time`, as a timestamp.
function localMidnight(time: Date): number {
  const local = time.getTime() + LOCAL_OFFSET_H * HOUR_MS;
  return local - (local % 86_400_000) - LOCAL_OFFSET_H * HOUR_MS;
}
const DEVICES_PER_STATION = 400;

export interface GenerateOptions {
  days?: number;
  // Sessions per station per day on a weekday; weekends get about half.
  sessionsPerDay?: [number, number];
  end?: Date;
  seed?: number;
}

export function* generate(options: GenerateOptions = {}): Generator<SeedRow> {
  const days = options.days ?? SEED.days;
  const [minSessions, maxSessions] = options.sessionsPerDay ?? [120, 200];
  const end = options.end ?? new Date();
  const rand = random(options.seed ?? 20260926);

  for (const story of STORIES) {
    const station = STATIONS.find((s) => s.id === story.station)!;
    const spots = Array.from({ length: story.report.spots }, () =>
      near(station.lat, station.lon, rand, story.report.radiusM),
    );
    // Each spot's reports come from its regulars: people whose commute passes it, 3 to 20 of them.
    const regulars = spots.map(() =>
      Array.from(
        { length: 3 + Math.floor(rand() * 18) },
        () => `sim-${story.station}-${Math.floor(rand() * DEVICES_PER_STATION)}`,
      ),
    );
    // The last day is the one the seed runs on, filled up to `end`, so the dashboard's 1 hour and
    // 24 hour windows have simulated rows right after a seed.
    const today = localMidnight(end);
    for (let d = days - 1; d >= 0; d--) {
      const dayStart = new Date(today - d * 86_400_000);
      const weekday = (dayStart.getUTCDay() + 6) % 7 < 5;
      const sessions = Math.round((minSessions + rand() * (maxSessions - minSessions)) * (weekday ? 1 : 0.5));
      const weights = Array.from({ length: 24 }, (_, h) => ({ hour: h, weight: story.hourWeight(h, weekday) }));
      for (let s = 0; s < sessions; s++) {
        const hour = weighted(weights, rand).hour;
        const start = dayStart.getTime() + (hour * 60 + rand() * 60) * 60_000;
        const minutes = 5 + rand() * 15;
        const centre = near(station.lat, station.lon, rand, story.roamM);
        const count = 30 + Math.floor(rand() * 30);
        for (let e = 0; e < count; e++) {
          const time = new Date(start + rand() * minutes * 60_000);
          if (time > end) continue;
          const localHour = (time.getUTCHours() + 24 + LOCAL_OFFSET_H) % 24;
          const r = story.report;
          if (rand() < r.rate && (!r.when || r.when(localHour, weekday))) {
            const spot = spotIndex(r.spots, rand);
            yield report(story, spots[spot], spot, pick(regulars[spot], rand), time, rand);
            continue;
          }
          const hazard = weighted(story.hazards, rand);
          const nearMiss = rand() < story.nearMissShare;
          const place =
            hazard.kind === "drop_off"
              ? near(station.lat, station.lon, rand, story.platformM)
              : near(centre.lat, centre.lon, rand, 60);
          yield {
            time,
            deviceKey: null,
            eventKind: nearMiss ? "near_miss" : "hazard_seen",
            hazardKind: hazard.kind,
            detectorClass: pick(hazard.classes, rand),
            civicCategory: null,
            severity: null,
            confidence: null,
            description: null,
            closestM: nearMiss ? 0.3 + rand() * 0.7 : 1 + rand() * 2,
            angleDeg: (rand() - 0.5) * 60,
            headingDeg: rand() * 360,
            lat: place.lat,
            lon: place.lon,
            cell: cellOf(place.lat, place.lon),
            stationId: stationNear(place),
            context: null,
          };
        }
      }
    }
  }
}

function report(
  story: Story,
  spot: { lat: number; lon: number },
  spotNumber: number,
  device: string,
  time: Date,
  rand: () => number,
): SeedRow {
  const r = story.report;
  const answered = r.answers(spotNumber);
  const blocking = answered.wayAround === "none" ? 0.8 : 0.4;
  const severity = severityFor(r.category, answered, measuredFrom({ kind: r.kind, blocking }, r.context));
  return {
    time,
    deviceKey: device,
    eventKind: "civic_report",
    hazardKind: r.kind,
    detectorClass: pick(r.classes, rand),
    civicCategory: r.category,
    severity,
    confidence: 0.75 + rand() * 0.2,
    description: pick(r.descriptions, rand),
    closestM: 0.8 + rand() * 1.2,
    angleDeg: (rand() - 0.5) * 30,
    headingDeg: rand() * 360,
    lat: spot.lat,
    lon: spot.lon,
    cell: cellOf(spot.lat, spot.lon),
    stationId: stationNear(spot),
    context: r.context,
  };
}
