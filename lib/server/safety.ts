import "server-only";

// Rule 7: beluga never tells anyone it is safe to cross. The prompts say so, and this backs them
// up when a model ignores its prompt: every text is checked before it is returned or spoken.

export const CROSSING_LINE = "I can't judge traffic. Cross the way you normally do.";

const CROSSING_ADVICE = [
  /\b(safe|okay|ok|clear|fine|good|free)\s+(for\s+you\s+)?to\s+cross\b/i,
  /\byou\s+(can|may|could|should)\s+(now\s+|safely\s+)?cross\b/i,
  /\bgo\s+ahead\s+and\s+cross\b/i,
  /\bcross\s+(now|safely)\b/i,
];

export function hasCrossingAdvice(text: string): boolean {
  return CROSSING_ADVICE.some((pattern) => pattern.test(text));
}

// Swaps each sentence with crossing advice for the fixed line, once, and keeps the rest.
export function withoutCrossingAdvice(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  let replaced = false;
  const kept: string[] = [];
  for (const sentence of sentences) {
    if (!hasCrossingAdvice(sentence)) {
      kept.push(sentence.trim());
      continue;
    }
    if (!replaced) kept.push(CROSSING_LINE);
    replaced = true;
  }
  return kept.filter(Boolean).join(" ");
}
