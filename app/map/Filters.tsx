"use client";

// The dashboard's filters. They stay native selects and radios, which work best with TalkBack and
// phone pickers, styled to match the rest of the page.

import { IconCategory, IconChevronDown, IconClock, IconDatabase, type Icon } from "@tabler/icons-react";
import { motion } from "motion/react";
import { CARD } from "@/components/brand/Card";
import {
  CIVIC_CATEGORIES,
  DASHBOARD_WINDOWS,
  type CivicCategory,
  type DashboardWindow,
  type SourceFilter,
} from "@/lib/shared/enums";
import { cn } from "@/lib/utils";
import { CATEGORY_NAMES, WINDOW_NAMES } from "./format";
import { EASE } from "./Panels";

const SOURCE_NAMES: Record<SourceFilter, string> = { live: "Live", simulated: "Simulated", both: "Both" };

function Select<T extends string>({
  id,
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  icon: Icon;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-2 sm:flex-none">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Icon aria-hidden size={20} className="text-sonar" />
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-13 w-full cursor-pointer appearance-none rounded-md border border-line-strong bg-abyss pr-12 pl-4 text-base font-semibold text-foreground [color-scheme:dark] transition-colors duration-300 ease-water hover:border-foreground sm:min-w-52"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <IconChevronDown
          aria-hidden
          size={20}
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}

export function Filters({
  window,
  category,
  source,
  onWindow,
  onCategory,
  onSource,
}: {
  window: DashboardWindow;
  category: CivicCategory | "all";
  source: SourceFilter;
  onWindow: (w: DashboardWindow) => void;
  onCategory: (c: CivicCategory | "all") => void;
  onSource: (s: SourceFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filters"
      className={cn(CARD, "flex flex-wrap items-end gap-4 p-4 sm:p-5")}
    >
      <Select
        id="filter-window"
        label="Time window"
        icon={IconClock}
        value={window}
        onChange={onWindow}
        options={DASHBOARD_WINDOWS.map((w) => ({ value: w, label: WINDOW_NAMES[w] }))}
      />
      <Select
        id="filter-category"
        label="Category"
        icon={IconCategory}
        value={category}
        onChange={onCategory}
        options={[
          { value: "all" as const, label: "All categories" },
          ...CIVIC_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_NAMES[c] })),
        ]}
      />
      <fieldset className="min-w-0">
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
          <IconDatabase aria-hidden size={20} className="text-sonar" />
          Data
        </legend>
        <div className="flex h-13 rounded-md bg-abyss p-1 ring-1 ring-line-strong ring-inset">
          {(Object.keys(SOURCE_NAMES) as SourceFilter[]).map((s) => (
            <label
              key={s}
              className={cn(
                "relative flex min-h-11 cursor-pointer items-center rounded-md px-4 font-semibold transition-colors duration-300 ease-water has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)",
                source === s ? "text-on-accent" : "text-muted hover:text-foreground",
              )}
            >
              {source === s && (
                <motion.span
                  layoutId="source-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-md bg-accent"
                  transition={{ duration: 0.3, ease: EASE }}
                />
              )}
              <input
                type="radio"
                name="source"
                value={s}
                checked={source === s}
                onChange={() => onSource(s)}
                className="sr-only"
              />
              <span className="relative">{SOURCE_NAMES[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
