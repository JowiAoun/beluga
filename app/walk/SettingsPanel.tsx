"use client";

// Settings outside the walk (Phase 9): height, starting station, sounds, which warnings play, volume
// and camera-only mode. Every change is saved on the phone right away.

import { IconChevronDown, IconMinus, IconPlus, IconRefresh, IconSettings } from "@tabler/icons-react";
import type { OneSound } from "@/lib/audio/sounds";
import { STATIONS, type StationId } from "@/lib/shared/stations";
import { cn } from "@/lib/utils";
import { heightText, stepHeight, VOLUME_RANGE_DB, type Settings } from "./settings";
import { CHECKBOX, PANEL, SECONDARY, SELECT } from "./styles";
import { DEPTH_WARNINGS, OBJECT_WARNINGS, type WarningGroup, type WarningId } from "./warnings";
import VibrationControls from "./VibrationControls";

const TOGGLE = "flex min-h-16 items-center gap-4 text-lg";
const STEP_BUTTON = cn(SECONDARY, "flex-col gap-1 px-2 py-2 text-lg text-balance");

// One checkbox per kind of warning. Ticked means it plays.
function WarningList({
  legend,
  note,
  groups,
  off,
  showSound,
  onToggle,
}: {
  legend: string;
  note: string;
  groups: readonly WarningGroup[];
  off: readonly WarningId[];
  showSound: boolean;
  onToggle: (id: WarningId, on: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-lg font-semibold">{legend}</legend>
      <p className="mb-1 text-base text-muted">{note}</p>
      {groups.map((group) => (
        <label key={group.id} className={cn(TOGGLE, "min-h-14 border-t border-line pt-2")}>
          <input
            type="checkbox"
            checked={!off.includes(group.id)}
            onChange={(e) => onToggle(group.id, e.target.checked)}
            className={CHECKBOX}
          />
          <span className="flex flex-col">
            {group.name}
            {showSound && <span className="text-base text-muted">{group.sound}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

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
  const toggleWarning = (id: WarningId, on: boolean) =>
    set({ warningsOff: on ? settings.warningsOff.filter((w) => w !== id) : [...settings.warningsOff, id] });
  return (
    <details className={cn(PANEL, "group p-0")}>
      <summary className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md px-5 text-xl font-semibold [&::-webkit-details-marker]:hidden">
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

        <label className="flex flex-col gap-2 text-lg">
          Warning sounds
          <select
            value={settings.oneSound ?? "each"}
            onChange={(e) => set({ oneSound: e.target.value === "each" ? null : (e.target.value as OneSound) })}
            className={SELECT}
          >
            <option value="each">All sounds and names</option>
            <option value="tick">One sound: wooden tick</option>
            <option value="ping">One sound: metal ping</option>
            <option value="marimba">One sound: soft marimba</option>
          </select>
          <span className="text-base text-muted">
            {settings.oneSound
              ? "Every warning plays this one sound, from the side of the hazard and faster as you get closer. Drop-offs and head-height hazards sound like everything else, and no names are spoken."
              : "Each kind of hazard has its own sound, and names like \"pole, left\" are spoken as it comes near."}
          </span>
        </label>

        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={settings.spokenNames}
            disabled={settings.oneSound !== null}
            onChange={(e) => set({ spokenNames: e.target.checked })}
            className={CHECKBOX}
          />
          Say what it is as it comes near, like &quot;pole, left&quot;
        </label>

        <WarningList
          legend="Things beluga names"
          note="Untick one to stop its own sound and name. With depth, beluga still warns about it with the plain wooden tick, since it is still in your path. In camera-only mode it gives no warning for it at all."
          groups={OBJECT_WARNINGS}
          off={settings.warningsOff}
          showSound={settings.oneSound === null}
          onToggle={toggleWarning}
        />

        <WarningList
          legend="Depth warnings"
          note="Untick one and beluga gives no warning for it at all, by sound or vibration. Drop-offs include yellow edge strips."
          groups={DEPTH_WARNINGS}
          off={settings.warningsOff}
          showSound={settings.oneSound === null}
          onToggle={toggleWarning}
        />

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
