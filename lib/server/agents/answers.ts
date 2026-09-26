import "server-only";

// What each agent's tool call carries back: the model's raw answer, checked here before any of it
// is used. Tool parameters are only loosely typed on the way through ElevenLabs, so numbers and
// yes/no values may arrive as text, and the box in whichever shape the tool schema allowed.

import { z } from "zod";
import { BoxSchema, DescriptionSchema, type Box } from "@/lib/shared/contracts";
import { CIVIC_CATEGORIES, SCENE_CONTEXTS, WAY_AROUND } from "@/lib/shared/enums";

const yesNo = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
const share = z.coerce.number().min(0).max(1);

// Top, left, bottom, right, 0 to 1000: a list, "t,l,b,r" text, or named edges. Anything else is no box.
function toBox(value: unknown): Box | null {
  let edges: unknown = value;
  if (typeof value === "string")
    edges = value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    edges = [v.top, v.left, v.bottom, v.right].map(Number);
  }
  if (Array.isArray(edges)) edges = edges.map((e) => Math.round(Number(e)));
  const parsed = BoxSchema.safeParse(edges);
  return parsed.success ? parsed.data : null;
}

const box = z.unknown().optional().transform(toBox);

export const NO_CATEGORY = "none";

export const TriageAnswerSchema = z.object({
  category: z.enum([...CIVIC_CATEGORIES, NO_CATEGORY]),
  isPublic: yesNo,
  leftOrFixed: yesNo,
  wayAround: z.enum(WAY_AROUND),
  caneWarning: yesNo,
  tripOrDrop: yesNo,
  confidence: share,
  description: DescriptionSchema,
  context: z.enum(SCENE_CONTEXTS),
  box,
});
export type TriageAnswer = z.infer<typeof TriageAnswerSchema>;

export const AskAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(300),
  label: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  box,
});
export type AskAnswer = z.infer<typeof AskAnswerSchema>;
