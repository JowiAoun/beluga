// Shapes that cross the network, from "Shared data contracts" in docs/PLAN.md.
// The backend validates every request and every model answer against these schemas.
// Units: metres, degrees (negative is left), milliseconds, ISO-8601 UTC timestamps.

import { z } from "zod";
import {
  CIVIC_CATEGORIES,
  DETECTOR_CLASSES,
  EVENT_KINDS,
  HAZARD_KINDS,
  SCENE_CONTEXTS,
  SEVERITIES,
  WAY_AROUND,
  type CivicCategory,
  type DetectorClass,
  type HazardKind,
  type Severity,
  type Source,
} from "./enums";
import { COARSENING, FRAMES, NETWORK, REPORTING } from "./params";

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function descriptionSchema(minLength: number) {
  return z
    .string()
    .trim()
    .min(minLength)
    .max(200)
    .refine((s) => countWords(s) <= REPORTING.descriptionMaxWords, {
      message: `At most ${REPORTING.descriptionMaxWords} words`,
    });
}

export const DescriptionSchema = descriptionSchema(0);

export const SeveritySchema = z.literal(SEVERITIES);

export const CellSchema = z
  .string()
  .regex(new RegExp(`^[0-9bcdefghjkmnpqrstuvwxyz]{${COARSENING.geohashLength}}$`), "Not a grid cell");

export const DeviceKeySchema = z.string().min(8).max(64);

// Top, left, bottom, right, scaled 0 to 1000.
const boxEdge = z.int().min(0).max(1000);
export const BoxSchema = z
  .tuple([boxEdge, boxEdge, boxEdge, boxEdge])
  .refine(([top, left, bottom, right]) => top <= bottom && left <= right, {
    message: "Box edges out of order",
  });
export type Box = z.infer<typeof BoxSchema>;

// Raw base64 of a JPEG (no data: prefix). "/9j/" is the base64 of the JPEG start bytes.
const maxFrameBase64Length = Math.ceil(FRAMES.maxFrameBytes / 3) * 4;
export const FrameSchema = z
  .base64()
  .max(maxFrameBase64Length, "Frame over 400 KB")
  .refine((s) => s.startsWith("/9j/"), { message: "Frame is not a JPEG" });

export const CivicSchema = z.object({
  category: z.enum(CIVIC_CATEGORIES),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  description: descriptionSchema(1),
});
export type Civic = z.infer<typeof CivicSchema>;

export const EventSchema = z
  .object({
    ts: z.iso.datetime(),
    // Random id kept on the phone. The backend hashes it for civic reports only and never stores it.
    deviceKey: DeviceKeySchema,
    kind: z.enum(EVENT_KINDS),
    hazardKind: z.enum(HAZARD_KINDS),
    detectorClass: z.enum(DETECTOR_CLASSES),
    closestDistance: z.number().min(0).max(10),
    angle: z.number().min(-180).max(180).optional(),
    heading: z.number().min(0).max(360).optional(),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    cell: CellSchema,
    stationId: z.string().min(1).max(32).nullable().optional(),
    context: z.enum(SCENE_CONTEXTS).optional(),
    // Intake drops civic fields on other event kinds.
    civic: CivicSchema.nullable().optional(),
  })
  .superRefine((event, ctx) => {
    if (event.kind === "civic_report" && !event.civic) {
      ctx.addIssue({ code: "custom", message: "A civic report needs its civic fields", path: ["civic"] });
    }
  });
export type BelugaEvent = z.infer<typeof EventSchema>;

const consentVersion = z.int().min(1);

export const EventBatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(NETWORK.eventBatchLimit),
  consentVersion,
});
export type EventBatch = z.infer<typeof EventBatchSchema>;

// Intake checks the envelope first, then each event on its own, so one bad event
// only drops itself and not the whole batch.
export const EventBatchEnvelopeSchema = z.object({
  events: z.array(z.unknown()).min(1).max(NETWORK.eventBatchLimit),
  consentVersion,
});

export interface EventBatchResult {
  accepted: number;
  rejected: number;
}

export const TriageHazardSchema = z.object({
  kind: z.enum(HAZARD_KINDS),
  distance: z.number().min(0).max(10),
  angle: z.number().min(-180).max(180),
  // Lowest and highest hazard point above the floor, in metres, when the phone has them.
  heightBand: z.object({ bottom: z.number(), top: z.number() }).nullable(),
  blocking: z.number().min(0).max(1),
  detectorClass: z.enum(DETECTOR_CLASSES),
});
export type TriageHazard = z.infer<typeof TriageHazardSchema>;

export const TriageRequestSchema = z.object({
  frame: FrameSchema,
  hazard: TriageHazardSchema,
  cell: CellSchema,
  sceneHint: z.enum(SCENE_CONTEXTS).nullable().optional(),
  // For rate limiting only.
  deviceKey: DeviceKeySchema,
});
export type TriageRequest = z.infer<typeof TriageRequestSchema>;

// The agent gives yes/no answers; the backend works out severity and report.
export const TriageResponseSchema = z.object({
  report: z.boolean(),
  category: z.enum(CIVIC_CATEGORIES).nullable(),
  isPublic: z.boolean(),
  leftOrFixed: z.boolean(),
  wayAround: z.enum(WAY_AROUND),
  caneWarning: z.boolean(),
  tripOrDrop: z.boolean(),
  // 1 when there is no category.
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  description: DescriptionSchema,
  context: z.enum(SCENE_CONTEXTS),
  box: BoxSchema.nullable(),
  budgetRemaining: z.int().min(0),
  latencyMs: z.number().min(0),
});
export type TriageResponse = z.infer<typeof TriageResponseSchema>;

export const AskRequestSchema = z.object({
  frame: FrameSchema,
  // The MVP always asks "What's in front of me?".
  question: z.string().trim().max(200).optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

// Sent in the ASK_META_HEADER header next to the MP3 body, or as the JSON body when voice failed.
export const AskMetaSchema = z.object({
  answer: z.string().trim().min(1).max(300),
  label: z.string().trim().max(40).nullable(),
  box: BoxSchema.nullable(),
  voiceFailed: z.boolean(),
});
export type AskMeta = z.infer<typeof AskMetaSchema>;

export const ASK_META_HEADER = "x-beluga-ask";

export function encodeAskMeta(meta: AskMeta): string {
  return encodeURIComponent(JSON.stringify(meta));
}

export function decodeAskMeta(value: string | null): AskMeta | null {
  if (!value) return null;
  try {
    const parsed = AskMetaSchema.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Phone only: hazard engine to audio, events and the frame gate. Never sent as is.
export interface HazardUpdate {
  // Stable while the hazard persists: kind + side bucket + short counter.
  id: string;
  kind: HazardKind;
  distance: number;
  angle: number;
  label: DetectorClass;
  // Share of corridor width covered, 0 to 1.
  blocking: number;
  active: boolean;
  // Milliseconds since session start.
  firstSeenAt: number;
  updatedAt: number;
}

// Dashboard read endpoints (Phase 7). Every response says whether simulated rows are in it.
export interface DashboardResponse {
  includesSimulated: boolean;
}

export interface ScoreParts {
  severityWeight: number;
  reporters: number;
  nearMissPressure: number;
  recency: number;
  transit: number;
}

export interface QueueRow {
  cell: string;
  placeLabel: string;
  lat: number;
  lon: number;
  category: CivicCategory;
  whoFixesIt: string;
  worstSeverity: Severity;
  reporters: number;
  nearMisses: number;
  lastSeen: string;
  score: number;
  parts: ScoreParts;
  includesSimulated: boolean;
}

export interface QueueResponse extends DashboardResponse {
  rows: QueueRow[];
}

// "Check now": severity 4, cell and day only, never the time of day.
export interface UrgentRow {
  cell: string;
  placeLabel: string;
  category: CivicCategory;
  whoFixesIt: string;
  // YYYY-MM-DD, UTC bucket.
  day: string;
  source: Source;
}

export interface UrgentResponse extends DashboardResponse {
  rows: UrgentRow[];
}

export interface CellRow {
  cell: string;
  lat: number;
  lon: number;
  events: number;
  nearMisses: number;
  reports: number;
  // Null when the cell has no civic reports; the map then colours by event count.
  score: number | null;
}

export interface CellsResponse extends DashboardResponse {
  rows: CellRow[];
}

export interface StationSeries {
  stationId: string;
  name: string;
  points: { hour: string; nearMisses: number }[];
}

export interface HourOfDayProfile {
  stationId: string;
  // Local hour 0 to 23.
  hours: { hour: number; nearMisses: number }[];
}

export interface StationsResponse extends DashboardResponse {
  series: StationSeries[];
  profile: HourOfDayProfile | null;
}

export interface FeedRow {
  time: string;
  category: CivicCategory;
  severity: Severity;
  description: string;
  placeLabel: string;
  source: Source;
  // So a new report can flash on the map too.
  cell: string;
}

export interface FeedResponse extends DashboardResponse {
  rows: FeedRow[];
}

export interface PerfSnapshot {
  takenAt: string;
  rawMs: number;
  aggregateMs: number;
  compressedBytes: number | null;
  uncompressedBytes: number | null;
  compressionRatio: number | null;
  totalRows: number;
  seedLoadSeconds: number | null;
  notes: string | null;
}

export interface PerfResponse extends DashboardResponse {
  latest: PerfSnapshot | null;
}
