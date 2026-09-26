import "server-only";

// Best Use of ElevenLabs: the two image-capable agents that see for beluga, each with one client
// tool that carries its answer back. `npm run agents` creates or
// updates them from this file, so a prompt change is a commit. Prompts are the Phase 5 wording.

import type { TriageHazard } from "@/lib/shared/contracts";
import { CIVIC_CATEGORIES, SCENE_CONTEXTS, WAY_AROUND, type SceneContext } from "@/lib/shared/enums";
import { NO_CATEGORY } from "./answers";

export type AgentKey = "triage" | "ask";

interface JsonProperty {
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  enum?: readonly string[];
}

export interface AgentSpec {
  key: AgentKey;
  name: string;
  // Where the backend finds the agent's id once `npm run agents` has made it.
  idEnv: "ELEVENLABS_TRIAGE_AGENT_ID" | "ELEVENLABS_ASK_AGENT_ID";
  llm: string;
  prompt: string;
  tool: {
    name: string;
    description: string;
    properties: Record<string, JsonProperty>;
    required: string[];
  };
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

export const AGENTS: Record<AgentKey, AgentSpec> = {
  triage: {
    key: "triage",
    name: "beluga triage",
    idEnv: "ELEVENLABS_TRIAGE_AGENT_ID",
    llm: "gpt-4.1-mini",
    prompt: TRIAGE_PROMPT,
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
