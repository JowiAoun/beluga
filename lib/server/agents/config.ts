import "server-only";

// Best Use of ElevenLabs: the two agents that see for beluga, each with a Gemini model from the
// ElevenLabs list and one client tool that carries its answer back, and the Ask the data agent on
// the dashboard (Phase 7 stretch). `npm run agents` creates or updates them from this file, so a
// prompt change is a commit. Prompts are the Phase 5 wording.

import type { TriageHazard } from "@/lib/shared/contracts";
import {
  CIVIC_CATEGORIES,
  DASHBOARD_WINDOWS,
  SCENE_CONTEXTS,
  SOURCE_FILTERS,
  WAY_AROUND,
  type SceneContext,
} from "@/lib/shared/enums";
import { STATIONS } from "@/lib/shared/stations";
import { NO_CATEGORY } from "./answers";

export type AgentKey = "triage" | "ask" | "data";

interface JsonProperty {
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  enum?: readonly string[];
}

export interface ToolSpec {
  name: string;
  description: string;
  properties: Record<string, JsonProperty>;
  required: string[];
}

export interface AgentSpec {
  key: AgentKey;
  name: string;
  // Where the backend finds the agent's id once `npm run agents` has made it.
  idEnv: "ELEVENLABS_TRIAGE_AGENT_ID" | "ELEVENLABS_ASK_AGENT_ID" | "ELEVENLABS_DATA_AGENT_ID";
  llm: string;
  prompt: string;
  // Takes one photo per conversation (file input on).
  seesPhotos: boolean;
  // Carries the answer back and ends the turn.
  tool: ToolSpec;
  // Tools the backend answers with data before the answer comes (Ask the data only).
  lookups?: ToolSpec[];
}

const BOX = {
  type: "string",
  description:
    "Box around the main object as four integers top,left,bottom,right on a 0 to 1000 scale of the photo, " +
    'for example "420,120,980,610". Leave empty when there is no single object.',
} as const;

const TRIAGE_PROMPT =
  "You are the civic triage step of beluga, an app used by blind and low-vision pedestrians together with a white " +
  "cane or guide dog. You see one forward-facing chest-height photo and a short note about the hazard the phone " +
  "detected. Say what the hazard is and answer questions about it. You do not decide whether it is reported or how " +
  "severe it is. Pick the category from this list, or none: sidewalk_obstruction (scooter, bike or object left " +
  "across the walking path), construction_barrier, head_height_hazard (sign, branch, awning sticking out between " +
  "0.68 m and 2.1 m high, with nothing below for a cane to hit), surface_damage (hole, broken curb, heaved slab), " +
  "blocked_curb_cut, tactile_strip_issue (missing, worn or covered warning strip at a platform edge, the top of " +
  "stairs, or a curb ramp at a crossing), snow_ice, other_fixed. People, vehicles in the road, animals and things " +
  "being carried are always none. Then answer: is the place open to the public; is the thing left or fixed in " +
  "place, and not moving, held or in use; how much path is left to get past it (clear: 1.5 m or more, about two " +
  "people side by side; narrow: less; none); is there a warning a cane or foot can find, such as a solid barrier " +
  "with a rail or edge at or below 0.68 m, or an intact tactile strip; is there a lip, hole, trench or drop that " +
  "can catch a foot. If unsure, lower your confidence. Describe only what is visible in 15 words or fewer. Never " +
  "mention faces, licence plates or anything that identifies a person. Never say a road is safe to cross. Also " +
  "classify the scene context. Answer only by calling triage_answer, once.";

const ASK_PROMPT =
  "You are beluga's describe-the-scene helper for a blind or low-vision pedestrian. Answer the user's question " +
  "about one forward-facing chest-height photo in at most two short sentences, the most safety-relevant thing " +
  "first, using left, right or straight ahead and rough metres. If your answer is about one main object, return " +
  "its box. For traffic or walk signals say only what the signal appears to show; never say it is safe to cross. " +
  "Never describe people's faces or identities. Answer only by calling ask_answer, once.";

const DATA_PROMPT =
  "You answer questions from city staff about beluga's hazard data around Ottawa's O-Train stations. beluga users " +
  "are blind and low-vision pedestrians whose phones report hazards anonymously. Answer in one or two short, plain " +
  "sentences. Take every number from the lookup tools and never guess one. Use the time window the question asks " +
  "for, or 7d when it doesn't say. Every lookup says includesSimulated: when it is true, say the numbers include " +
  "simulated demo data, and never call them live. Times are Ottawa time. Use Canadian spelling, like metres. If " +
  "the tools can't answer the question, say so. Answer only by calling data_answer, once.";

const WINDOW = {
  type: "string",
  description: "Time window: 1h, 24h, 7d or 14d. Use 7d when the question doesn't say.",
  enum: DASHBOARD_WINDOWS,
} as const;
const SOURCE = {
  type: "string",
  description: "live for real reports, simulated for the demo data, both for all. Use both unless asked.",
  enum: SOURCE_FILTERS,
} as const;
const CATEGORY = {
  type: "string",
  description: "One report category, or all.",
  enum: [...CIVIC_CATEGORIES, "all"],
} as const;
const STATION = {
  type: "string",
  description: "One O-Train station id, or all.",
  enum: [...STATIONS.map((st) => st.id), "all"],
} as const;

const DATA_LOOKUPS: ToolSpec[] = [
  {
    name: "fix_first_queue",
    description:
      "The fix-first list: places ranked by a score from severity, distinct reporters, near-misses, how recent, " +
      "and nearness to a station. Returns the top 10, or the top 10 within a kilometre of one station.",
    properties: { window: WINDOW, category: CATEGORY, station: STATION, source: SOURCE },
    required: ["window", "category", "station", "source"],
  },
  {
    name: "check_now",
    description:
      "Spots with a severity 4 report (a fall risk, like a drop or a missing edge strip) in the last 14 days, " +
      "newest day first. These need a check before they reach the top of the fix-first list.",
    properties: { category: CATEGORY, source: SOURCE },
    required: ["category", "source"],
  },
  {
    name: "busiest_cells",
    description: "Map cells of about 150 m with the most hazard events, near-misses and reports. Returns the top 10.",
    properties: { window: WINDOW, source: SOURCE },
    required: ["window", "source"],
  },
  {
    name: "station_near_misses",
    description:
      "Near-misses per O-Train station over the last 7 days, most first. For one station, also its busiest hours.",
    properties: { station: STATION, source: SOURCE },
    required: ["station", "source"],
  },
  {
    name: "recent_reports",
    description: "The latest civic reports, newest first, up to 10.",
    properties: { category: CATEGORY, source: SOURCE },
    required: ["category", "source"],
  },
];

export const AGENTS: Record<AgentKey, AgentSpec> = {
  triage: {
    key: "triage",
    name: "beluga triage",
    idEnv: "ELEVENLABS_TRIAGE_AGENT_ID",
    llm: "gpt-4.1-mini",
    prompt: TRIAGE_PROMPT,
    seesPhotos: true,
    tool: {
      name: "triage_answer",
      description: "Returns the triage answers for the photo. Call it exactly once.",
      properties: {
        category: {
          type: "string",
          description: "The civic category, or none.",
          enum: [...CIVIC_CATEGORIES, NO_CATEGORY],
        },
        isPublic: { type: "boolean", description: "The place is open to the public." },
        leftOrFixed: {
          type: "boolean",
          description: "The thing is left or fixed in place: not moving, not held, not in use.",
        },
        wayAround: {
          type: "string",
          description: "Path left to get past it: clear is 1.5 m or more, narrow is less, none is no way past.",
          enum: WAY_AROUND,
        },
        caneWarning: {
          type: "boolean",
          description:
            "A cane or foot can find a warning: a barrier edge at or below 0.68 m, or an intact tactile strip.",
        },
        tripOrDrop: { type: "boolean", description: "A lip, hole, trench or drop that can catch a foot." },
        confidence: { type: "number", description: "How sure you are, from 0 to 1." },
        description: {
          type: "string",
          description: "What is visible, 15 words or fewer. Never people's faces, licence plates or identities.",
        },
        context: { type: "string", description: "The scene.", enum: SCENE_CONTEXTS },
        box: BOX,
      },
      required: [
        "category",
        "isPublic",
        "leftOrFixed",
        "wayAround",
        "caneWarning",
        "tripOrDrop",
        "confidence",
        "description",
        "context",
      ],
    },
  },
  ask: {
    key: "ask",
    name: "beluga ask",
    idEnv: "ELEVENLABS_ASK_AGENT_ID",
    llm: "gemini-3.5-flash-lite",
    prompt: ASK_PROMPT,
    seesPhotos: true,
    tool: {
      name: "ask_answer",
      description: "Returns the spoken answer. Call it exactly once.",
      properties: {
        answer: { type: "string", description: "At most two short sentences, the most safety-relevant thing first." },
        label: { type: "string", description: "One or two words naming the main object, or empty." },
        box: BOX,
      },
      required: ["answer"],
    },
  },
  data: {
    key: "data",
    name: "beluga data",
    idEnv: "ELEVENLABS_DATA_AGENT_ID",
    llm: "gemini-3.5-flash-lite",
    prompt: DATA_PROMPT,
    seesPhotos: false,
    tool: {
      name: "data_answer",
      description: "Returns the answer to the question. Call it exactly once, after the lookups.",
      properties: {
        answer: { type: "string", description: "One or two short, plain sentences with the numbers from the lookups." },
      },
      required: ["answer"],
    },
    lookups: DATA_LOOKUPS,
  },
};

function side(angle: number): string {
  const degrees = Math.round(Math.abs(angle));
  return degrees < 5 ? "straight ahead" : `${degrees}° ${angle < 0 ? "left" : "right"}`;
}

// The phone's measurements, as the short note that goes with the photo.
export function triageNote(hazard: TriageHazard, sceneHint: SceneContext | null | undefined): string {
  const parts = [
    `Hazard: ${hazard.kind}`,
    `${hazard.distance.toFixed(1)} m ahead`,
    side(hazard.angle),
    `blocking ${hazard.blocking.toFixed(1)}`,
    `detector label ${hazard.detectorClass}`,
  ];
  if (hazard.heightBand)
    parts.push(`${hazard.heightBand.bottom.toFixed(2)} to ${hazard.heightBand.top.toFixed(2)} m high`);
  if (sceneHint) parts.push(`scene hint ${sceneHint}`);
  return `${parts.join(", ")}.`;
}

export const ASK_QUESTION = "What's in front of me?";
