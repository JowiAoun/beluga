"use client";

// Settings outside the walk (Phase 9): height, starting station, the voice, sounds, which warnings
// play, volume and camera-only mode. Every change is saved on the phone right away.

import { IconChevronDown, IconMinus, IconPlus, IconRefresh, IconSettings } from "@tabler/icons-react";
import type { OneSound } from "@/lib/audio/sounds";
import { WARN_FROM } from "@/lib/shared/params";
import { STATIONS, type StationId } from "@/lib/shared/stations";
import { cn } from "@/lib/utils";
import { heightText, stepHeight, VOLUME_RANGE_DB, type Settings } from "./settings";
import { CHECKBOX, PANEL, SECONDARY, SELECT } from "./styles";
import {
  DEPTH_WARNINGS,
  OBJECT_WARNINGS,
  warnFromMax,
  type DistanceId,
  type WarningGroup,
  type WarningId,
  type WarnFromM,
} from "./warnings";
import VibrationControls from "./VibrationControls";
import VoicePicker from "./VoicePicker";

const TOGGLE = "flex min-h-16 items-center gap-4 text-lg";
const STEP_BUTTON = cn(SECONDARY, "flex-col gap-1 px-2 py-2 text-lg text-balance");

// "1.0", "1.25", "1.5": a slider's value in metres.
function metres(value: number): string {
  return value.toFixed(2).replace(/0$/, "");
}

// How far away one kind of hazard starts to warn, by sound and vibration.
function DistanceSlider({
  id,
  name,
  value,
  onChange,
}: {
  id: DistanceId;
  name: string;
  value: number;
  onChange: (id: DistanceId, metres: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-base">
      <span>
        Warns from <span className="font-mono font-medium tabular-nums">{metres(value)}</span> m away
      </span>
      <input
        type="range"
        min={WARN_FROM.minM}
        max={warnFromMax(id)}
        step={WARN_FROM.stepM}
        value={value}
        aria-label={`${name}: warns from`}
        aria-valuetext={`${metres(value)} metres`}
        onChange={(e) => onChange(id, Number(e.target.value))}
        className="min-h-12 w-full accent-accent"
      />
    </label>
  );
}

// One checkbox per kind of warning, and while it is on, how far away it starts.
function WarningList({
  legend,
  note,
  groups,
  off,
  warnFrom,
  showSound,
  onToggle,
  onDistance,
}: {
  legend: string;
  note: string;
  groups: readonly WarningGroup[];
  off: readonly WarningId[];
  warnFrom: WarnFromM;
  showSound: boolean;
  onToggle: (id: WarningId, on: boolean) => void;
  onDistance: (id: DistanceId, metres: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-lg font-semibold">{legend}</legend>
      <p className="mb-1 text-base text-muted">{note}</p>
      {groups.map((group) => {
        const on = !off.includes(group.id);
        return (
          <div key={group.id} className="flex flex-col gap-1 border-t border-line pt-2">
            <label className={cn(TOGGLE, "min-h-14")}>
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(group.id, e.target.checked)}
                className={CHECKBOX}
              />
              <span className="flex flex-col">
                {group.name}
                {showSound && <span className="text-base text-muted">{group.sound}</span>}
              </span>
            </label>
            {on && (
              <div className="pl-10">
                <DistanceSlider id={group.id} name={group.name} value={warnFrom[group.id]} onChange={onDistance} />
              </div>
            )}
          </div>
        );
      })}
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
  const setDistance = (id: DistanceId, metres: number) => set({ warnFromM: { ...settings.warnFromM, [id]: metres } });
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

        <VoicePicker legend="Voice for warnings and answers" value={settings.voice} onChange={(voice) => set({ voice })} />

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

        <p className="text-base text-muted">
          Each slider sets how far away that kind of hazard starts to warn, by sound and vibration. The sound speeds
          up as it gets closer. A shorter distance means fewer sounds, and less time to react.
        </p>

        <WarningList
          legend="Things beluga names"
          note="Untick one to stop its own sound and name. With depth, beluga still warns about it with the plain wooden tick, from the distance for everything else, since it is still in your path. In camera-only mode it gives no warning for it at all."
          groups={OBJECT_WARNINGS}
          off={settings.warningsOff}
          warnFrom={settings.warnFromM}
          showSound={settings.oneSound === null}
          onToggle={toggleWarning}
          onDistance={setDistance}
        />

        <WarningList
          legend="Depth warnings"
          note="Untick one and beluga gives no warning for it at all, by sound or vibration. Drop-offs include yellow edge strips."
          groups={DEPTH_WARNINGS}
          off={settings.warningsOff}
          warnFrom={settings.warnFromM}
          showSound={settings.oneSound === null}
          onToggle={toggleWarning}
          onDistance={setDistance}
        />

        <fieldset className="flex flex-col gap-1">
          <legend className="text-lg font-semibold">Everything else in your path</legend>
          <p className="mb-1 text-base text-muted">Walls, boxes and anything beluga can&apos;t name. Always on.</p>
          <DistanceSlider
            id="obstacles"
            name="Everything else in your path"
            value={settings.warnFromM.obstacles}
            onChange={setDistance}
          />
        </fieldset>

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
