"use client";

// Settings outside the walk (Phase 9): height, starting station, sounds, volume and camera-only mode.

import { STATIONS, type StationId } from "@/lib/shared/stations";
import { heightText, stepHeight, VOLUME_RANGE_DB, type Settings } from "./settings";

export default function SettingsPanel({
  settings,
  onChange,
  onRunSetup,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onRunSetup: () => void;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <details className="rounded-lg border border-neutral-600 p-3">
      <summary className="min-h-12 cursor-pointer text-lg font-semibold">Settings</summary>
      <div className="mt-2 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-lg">
            Height: <span aria-live="polite">{heightText(settings.heightM)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set({ heightM: stepHeight(settings.heightM, -1) })}
              className="min-h-16 rounded-lg border-2 border-neutral-500 text-lg"
            >
              Shorter by 5 cm
            </button>
            <button
              type="button"
              onClick={() => set({ heightM: stepHeight(settings.heightM, 1) })}
              className="min-h-16 rounded-lg border-2 border-neutral-500 text-lg"
            >
              Taller by 5 cm
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-lg">
          Starting station, used for reports when there is no location fix (underground or indoors)
          <select
            value={settings.station}
            onChange={(e) => set({ station: e.target.value as StationId | "street" })}
            className="min-h-16 rounded bg-neutral-800 px-2"
          >
            <option value="street">On the street</option>
            {STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-16 items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={settings.reportedSound}
            onChange={(e) => set({ reportedSound: e.target.checked })}
            className="h-6 w-6"
          />
          Play a sound when a report is sent
        </label>

        <label className="flex min-h-16 items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={settings.aliveTick}
            onChange={(e) => set({ aliveTick: e.target.checked })}
            className="h-6 w-6"
          />
          Soft tick every 30 seconds when all is quiet, so you know beluga is running
        </label>

        <label className="flex flex-col gap-1 text-lg">
          Volume: {settings.volumeDb > 0 ? "+" : ""}
          {settings.volumeDb} dB
          <input
            type="range"
            min={VOLUME_RANGE_DB.min}
            max={VOLUME_RANGE_DB.max}
            step={1}
            value={settings.volumeDb}
            onChange={(e) => set({ volumeDb: Number(e.target.value) })}
            className="min-h-12"
          />
        </label>

        <label className="flex min-h-16 items-center gap-3 text-lg">
          <input
            type="checkbox"
            checked={settings.cameraOnly}
            onChange={(e) => set({ cameraOnly: e.target.checked })}
            className="h-6 w-6"
          />
          Camera-only mode, for a phone without depth: warns about things it can name, like people, bikes and
          chairs, with no edge or step warnings. It turns on by itself when depth is missing.
        </label>

        <button type="button" onClick={onRunSetup} className="min-h-16 rounded-lg border-2 border-neutral-500 text-lg">
          Run the setup steps again
        </button>
      </div>
    </details>
  );
}
