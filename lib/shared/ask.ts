import type { AskMeta } from "./contracts";

export function guardAnswer(meta: AskMeta): AskMeta {
  // Conservative: even negated crossing guidance is replaced, not spoken verbatim.
  if (/\b(cross(?:ing)?|walk\s+signal|green\s+light|traffic\s+light)\b/i.test(meta.answer)) {
    return { ...meta, answer: "I can't judge traffic. Cross the way you normally do.", label: null, box: null };
  }
  return meta;
}
