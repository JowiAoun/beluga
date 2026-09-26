"use client";

import { IconChartBar, IconTable } from "@tabler/icons-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { CARD } from "@/components/brand/Card";
import { useStill } from "@/components/brand/MotionPrefs";
import type { StationsResponse } from "@/lib/shared/contracts";
import { cn } from "@/lib/utils";
import { Empty, PanelHeading } from "./Panels";
import type { Load } from "./usePoll";

const SONAR = "#38bdf8";
const MUTED = "#94a3b8";
const DRAW_MS = 900;

const hours = (h: number) => `${h}:00 to ${h + 1}:00`;

function HourTooltip({ active, payload, label }: TooltipContentProps) {
  const value = payload?.[0]?.value;
  if (!active || typeof value !== "number") return null;
  return (
    <div className="rounded-2xl border border-line bg-abyss/95 px-4 py-3 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)]">
      <p className="font-mono text-sm text-muted">{hours(Number(label))}</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-medium text-sonar">{value.toLocaleString("en-CA")}</span>
        <span className="text-sm text-muted">near-misses</span>
      </p>
    </div>
  );
}

// Hourly near-misses per station over 7 days, and the selected station's hour-of-day profile.
// The charts draw in once, on the first load, and never with reduced motion or Pause motion.
export default function StationPanels({
  data,
  load,
  selected,
  onSelect,
  className,
}: {
  data: StationsResponse | null;
  load: Load;
  selected: string;
  onSelect: (stationId: string) => void;
  className?: string;
}) {
  const still = useStill();
  const [drawn, setDrawn] = useState(false);
  const animate = !still && !drawn;
  const series = data?.series ?? [];
  const profile = data?.profile;
  const name = series.find((s) => s.stationId === selected)?.name ?? selected;
  const peak = profile?.hours.reduce((a, b) => (b.nearMisses > a.nearMisses ? b : a), profile.hours[0]);

  return (
    <section aria-labelledby="stations" className={cn(CARD, "flex flex-col p-4 sm:p-6", className)}>
      <PanelHeading
        id="stations"
        icon={IconChartBar}
        title="Stations"
        note="Near-misses per hour over the last 7 days. Pick a station to see its day."
      />
      {series.length === 0 ? (
        <Empty load={load}>No station data yet.</Empty>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {series.map((s) => {
            const on = selected === s.stationId;
            return (
              <button
                key={s.stationId}
                type="button"
                onClick={() => onSelect(s.stationId)}
                aria-pressed={on}
                className={cn(
                  "flex min-h-11 flex-col rounded-2xl border p-3 text-left transition-colors duration-150",
                  on
                    ? "border-sonar/70 bg-sonar/10 shadow-[0_0_32px_-12px_rgb(56_189_248/0.6)] contrast-more:shadow-none"
                    : "border-line bg-abyss/50 hover:border-white/25",
                )}
              >
                <span className="font-bold">{s.name}</span>
                <span className="font-mono text-sm text-muted tabular-nums">
                  {s.points.reduce((sum, p) => sum + p.nearMisses, 0).toLocaleString("en-CA")}
                  <span className="font-sans"> near-misses</span>
                </span>
                <span className="mt-2 block h-12" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={s.points}
                      margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                      accessibilityLayer={false}
                    >
                      <defs>
                        <linearGradient id={`spark-${s.stationId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor={SONAR} stopOpacity={on ? 0.55 : 0.35} />
                          <stop offset="1" stopColor={SONAR} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="nearMisses"
                        stroke={on ? SONAR : MUTED}
                        strokeWidth={1.5}
                        fill={`url(#spark-${s.stationId})`}
                        dot={false}
                        isAnimationActive={animate}
                        animationDuration={DRAW_MS}
                        onAnimationEnd={() => setDrawn(true)}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {profile && (
        <div className="mt-6">
          <h3 className="text-lg font-bold">{name}: near-misses by hour of day (Ottawa time)</h3>
          {peak && (
            <p className="mt-1 text-muted">
              Busiest hour: <span className="font-mono text-foreground">{hours(peak.hour)}</span>, with{" "}
              <span className="font-mono text-foreground">{peak.nearMisses.toLocaleString("en-CA")}</span> near-misses.
            </p>
          )}
          <div className="mt-3 h-56" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={profile.hours}
                margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
                accessibilityLayer={false}
              >
                <defs>
                  <linearGradient id="hour-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={SONAR} stopOpacity={0.95} />
                    <stop offset="1" stopColor={SONAR} stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="hour"
                  stroke={MUTED}
                  tick={{ fill: MUTED, fontSize: 14 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                  tickFormatter={(h: number) => `${h}h`}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  stroke={MUTED}
                  tick={{ fill: MUTED, fontSize: 14 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip content={HourTooltip} cursor={{ fill: "rgba(56,189,248,0.08)" }} />
                <Bar
                  dataKey="nearMisses"
                  name="Near-misses"
                  fill="url(#hour-fill)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={animate}
                  animationDuration={DRAW_MS}
                  onAnimationEnd={() => setDrawn(true)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="group mt-3">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl px-2 font-semibold text-sonar hover:bg-white/5">
              <IconTable aria-hidden size={20} />
              Show the hours as a table
            </summary>
            <div
              className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line"
              tabIndex={0}
              role="region"
              aria-label={`${name} hours table`}
            >
              <table className="w-full text-left text-base">
                <caption className="sr-only">{name}: near-misses by hour of day, Ottawa time</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky top-0 bg-[#0d1726] px-3 py-2 text-sm font-semibold text-muted">
                      Hour
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 bg-[#0d1726] px-3 py-2 text-right text-sm font-semibold text-muted"
                    >
                      Near-misses
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profile.hours.map((h) => (
                    <tr key={h.hour} className="border-t border-line">
                      <th scope="row" className="px-3 py-1.5 font-mono font-normal">
                        {hours(h.hour)}
                      </th>
                      <td className="px-3 py-1.5 text-right font-mono">{h.nearMisses.toLocaleString("en-CA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
