// Words and colours the dashboard shares.

import type { QueueRow } from "@/lib/shared/contracts";
import type { CivicCategory, DashboardWindow, Severity } from "@/lib/shared/enums";

export const CATEGORY_NAMES: Record<CivicCategory, string> = {
  sidewalk_obstruction: "Sidewalk obstruction",
  construction_barrier: "Construction barrier",
  head_height_hazard: "Head-height hazard",
  surface_damage: "Surface damage",
  blocked_curb_cut: "Blocked curb cut",
  tactile_strip_issue: "Tactile strip issue",
  snow_ice: "Snow or ice",
  other_fixed: "Other fixed hazard",
};

// The words for each severity, from "Severity" in docs/PLAN.md.
export const SEVERITY_NAMES: Record<Severity, string> = { 1: "minor", 2: "detour", 3: "collision", 4: "fall" };

export const WINDOW_NAMES: Record<DashboardWindow, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "14d": "14 days",
};

// Days ago in Ottawa time, as words.
export function seenAgo(iso: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(new Date(iso)))) / 86_400_000);
  if (days <= 0) return "seen today";
  if (days === 1) return "seen yesterday";
  return `seen ${days} days ago`;
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" });
}

// "Severity 3 × 6 reporters × 20 near-misses × seen yesterday × near Rideau"
export function whyLine(row: QueueRow): string {
  const parts = [
    `Severity ${row.worstSeverity}`,
    `${row.reporters} reporters`,
    `${row.nearMisses.toLocaleString("en-CA")} near-misses`,
    seenAgo(row.lastSeen),
  ];
  if (row.placeLabel.startsWith("near ")) parts.push(row.placeLabel);
  return parts.join(" × ");
}

// Viridis, low to high: one sequential scale that stays readable with colour blindness. It runs dark to
// bright, so the worst spots glow on the dark map.
export const SCORE_COLOURS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];
export const NO_REPORT_COLOUR = "#9ca3af";

// Which of the five steps a score falls in, against the top score on screen.
export function scoreStep(score: number, top: number): number {
  if (top <= 0) return 0;
  return Math.min(SCORE_COLOURS.length - 1, Math.floor((score / top) * SCORE_COLOURS.length));
}
