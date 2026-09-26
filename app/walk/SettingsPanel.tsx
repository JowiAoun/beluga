"use client";

// Settings outside the walk (Phase 9): height, starting station, sounds, volume and camera-only mode.

import { IconChevronDown, IconMinus, IconPlus, IconRefresh, IconSettings } from "@tabler/icons-react";
import { STATIONS, type StationId } from "@/lib/shared/stations";
import { cn } from "@/lib/utils";
import { heightText, stepHeight, VOLUME_RANGE_DB, type Settings } from "./settings";
import { CHECKBOX, PANEL, SECONDARY, SELECT } from "./styles";
import VibrationControls from "./VibrationControls";

const TOGGLE = "flex min-h-16 items-center gap-4 text-lg";
const STEP_BUTTON = cn(SECONDARY, "flex-col gap-1 px-2 py-2 text-lg text-balance");

export default function SettingsPanel({
  settings,
  onChange,
  onRunSetup,
  noDepth = false,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onRunSetup: () => void;
  // This browser can't give depth at all (Safari on an iPhone), so camera-only mode is always on.
  noDepth?: boolean;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <details className={cn(PANEL, "group p-0")}>
      <summary className="flex min-h-16 cursor-pointer items-center gap-3 rounded-3xl px-5 text-xl font-semibold [&::-webkit-details-marker]:hidden">
        <IconSettings aria-hidden size={24} className="shrink-0 text-sonar" />
        Settings
        <IconChevronDown
          aria-hidden
          size={24}
          className="ml-auto shrink-0 text-muted transition-transform duration-300 ease-water group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="flex flex-col gap-5 border-t border-line p-5">
        <VibrationControls settings={settings} onChange={set} />
        <div className="flex flex-col gap-3">
          <p className="text-lg">
            Height:{" "}
            <span aria-live="polite" className="font-mono font-medium tabular-nums">
              {heightText(settings.heightM)}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set({ heightM: stepHeight(settings.heightM, -1) })}
              className={STEP_BUTTON}
            >
              <IconMinus aria-hidden size={20} />
              Shorter by 5 cm
            </button>
            <button
              type="button"
              onClick={() => set({ heightM: stepHeight(settings.heightM, 1) })}
              className={STEP_BUTTON}
            >
              <IconPlus aria-hidden size={20} />
              Taller by 5 cm
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-2 text-lg">
          Starting station, used for reports when there is no location fix (underground or indoors)
          <select
            value={settings.station}
            onChange={(e) => set({ station: e.target.value as StationId | "street" })}
            className={SELECT}
          >
            <option value="street">On the street</option>
            {STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={settings.reportedSound}
            onChange={(e) => set({ reportedSound: e.target.checked })}
            className={CHECKBOX}
          />
          Play a sound when a report is sent
        </label>

        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={settings.aliveTick}
            onChange={(e) => set({ aliveTick: e.target.checked })}
            className={CHECKBOX}
          />
          Soft tick every 30 seconds when all is quiet, so you know beluga is running
        </label>

        <label className="flex flex-col gap-2 text-lg">
          <span>
            Volume:{" "}
            <span className="font-mono font-medium tabular-nums">
              {settings.volumeDb > 0 ? "+" : ""}
              {settings.volumeDb} dB
            </span>
          </span>
          <input
            type="range"
            min={VOLUME_RANGE_DB.min}
            max={VOLUME_RANGE_DB.max}
            step={1}
            value={settings.volumeDb}
            onChange={(e) => set({ volumeDb: Number(e.target.value) })}
            className="min-h-12 w-full accent-accent"
          />
        </label>

        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={settings.headsetAsk}
            onChange={(e) => set({ headsetAsk: e.target.checked })}
            className={CHECKBOX}
          />
          Ask with the earbuds&apos; play/pause button during a walk
        </label>

        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={settings.yellowStrip}
            onChange={(e) => set({ yellowStrip: e.target.checked })}
            className={CHECKBOX}
          />
          Warn about yellow edge strips on the floor, like a platform edge or a taped line. It goes by colour alone, so
          it adds to the depth warnings and never replaces them.
        </label>

        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={noDepth || settings.cameraOnly}
            disabled={noDepth}
            onChange={(e) => set({ cameraOnly: e.target.checked })}
            className={CHECKBOX}
          />
          {noDepth
            ? "Camera-only mode is always on in this browser: it can't measure depth, so beluga warns about things it can name, like people, bikes and chairs, and yellow edge strips. Chrome on an Android phone with depth adds step and drop-off warnings."
            : "Camera-only mode, for a phone without depth: warns about things it can name, like people, bikes and chairs, and yellow edge strips, with no step warnings. It turns on by itself when depth is missing."}
        </label>

        <button type="button" onClick={onRunSetup} className={SECONDARY}>
          <IconRefresh aria-hidden size={24} />
          Run the setup steps again
        </button>
      </div>
    </details>
  );
}
