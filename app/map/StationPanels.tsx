"use client";

import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StationsResponse } from "@/lib/shared/contracts";

// Hourly near-misses per station over 7 days, and the selected station's hour-of-day profile.
export default function StationPanels({
  data,
  selected,
  onSelect,
}: {
  data: StationsResponse | null;
  selected: string;
  onSelect: (stationId: string) => void;
}) {
  const series = data?.series ?? [];
  const profile = data?.profile;
  const name = series.find((s) => s.stationId === selected)?.name ?? selected;
  return (
    <section aria-labelledby="stations" className="flex flex-col gap-2">
      <h2 id="stations" className="text-lg font-bold">
        Stations: near-misses per hour, last 7 days
      </h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {series.map((s) => (
          <button
            key={s.stationId}
            type="button"
            onClick={() => onSelect(s.stationId)}
            aria-pressed={selected === s.stationId}
            className={`rounded-lg border p-2 text-left ${selected === s.stationId ? "border-yellow-300" : "border-neutral-700"}`}
          >
            <span className="font-semibold">{s.name}</span>
            <span className="ml-1 text-sm tabular-nums opacity-80">
              {s.points.reduce((sum, p) => sum + p.nearMisses, 0).toLocaleString("en-CA")}
            </span>
            <div className="h-16" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.points}>
                  <Line
                    type="monotone"
                    dataKey="nearMisses"
                    stroke="#fde047"
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </button>
        ))}
      </div>
      {profile && (
        <div>
          <h3 className="font-semibold">{name}: near-misses by hour of day (Ottawa time)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profile.hours}>
                <XAxis dataKey="hour" stroke="#d1d5db" tickFormatter={(h: number) => `${h}h`} />
                <YAxis stroke="#d1d5db" width={48} />
                <Tooltip
                  contentStyle={{ background: "#0b1320", border: "1px solid #4b5563" }}
                  labelFormatter={(h) => `${h}:00 to ${Number(h) + 1}:00`}
                />
                <Bar dataKey="nearMisses" name="Near-misses" fill="#21918c" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
