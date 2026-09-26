import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's own names. Without these, it reads `text-section` as a
// colour and drops it when `text-muted` comes later.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "section", "statement", "impact"] }],
      "font-family": [{ font: ["display", "serif"] }],
    },
  },
});

// Joins class names, and lets a later Tailwind class win over an earlier one.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
