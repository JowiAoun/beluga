"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { deviceVibrate, supportsVibration, vibrationPattern, type VibrationSettings, type VibrationStrength } from "@/lib/haptics/engine";
import { CHECKBOX, SECONDARY, SELECT } from "./styles";

const subscribe = () => () => {};
const serverSupport = () => null;

export default function VibrationControls({ settings, onChange, practice = false }: {
  settings: VibrationSettings; onChange: (next: VibrationSettings) => void; practice?: boolean;
}) {
  const supported = useSyncExternalStore(subscribe, supportsVibration, serverSupport);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const hidden = () => { if (document.hidden) deviceVibrate(0); };
    document.addEventListener("visibilitychange", hidden);
    return () => { deviceVibrate(0); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  const change = (patch: Partial<VibrationSettings>) => {
    deviceVibrate(0);
    onChange({ ...settings, ...patch });
    setMessage("");
  };
  return <fieldset className="flex flex-col gap-3">
    <legend className="mb-3 text-xl font-bold">Vibration alerts</legend>
    <label className="flex min-h-16 items-center gap-4 text-lg">
      <input type="checkbox" className={CHECKBOX} checked={settings.vibrationOn} disabled={supported !== true}
        onChange={(event) => change({ vibrationOn: event.target.checked })} />
      Vibrations {settings.vibrationOn ? "on" : "off"}
    </label>
    <label className="flex flex-col gap-2 text-lg">Vibration strength
      <select className={SELECT} value={settings.vibrationStrength} disabled={!settings.vibrationOn || supported !== true}
        onChange={(event) => change({ vibrationStrength: event.target.value as VibrationStrength })}>
        <option value="light">Light — brief pulses</option>
        <option value="medium">Medium — regular pulses</option>
        <option value="strong">Strong — longer pulses</option>
      </select>
    </label>
    <p className="text-base text-muted">Strength changes pulse length, not motor intensity. Your phone controls the motor intensity. Audio still gives the obstacle’s direction.</p>
    {supported === false && <p role="status">Vibration is unavailable in this browser. Audio alerts still work.</p>}
    <button type="button" className={SECONDARY} disabled={!settings.vibrationOn || supported !== true}
      onClick={() => setMessage(deviceVibrate(vibrationPattern("obstacle", settings.vibrationStrength))
        ? "Test requested. If you feel nothing, check your phone’s vibration and Do Not Disturb settings."
        : "The phone could not start vibration.")}>Test vibration</button>
    {practice && <div className="grid gap-2">
      {(["calibrated", "obstacle", "head_height", "drop_off"] as const).map((kind) => <button key={kind} type="button"
        className={SECONDARY} disabled={!settings.vibrationOn || supported !== true}
        onClick={() => { const ok = deviceVibrate(vibrationPattern(kind, settings.vibrationStrength)); setMessage(ok ? `Simulated ${kind.replaceAll("_", " ")} vibration.` : "The phone could not start vibration."); }}>
        Feel simulated {kind === "calibrated" ? "calibration complete" : kind.replaceAll("_", " ")}
      </button>)}
      <button type="button" className={SECONDARY} onClick={() => { deviceVibrate(0); setMessage("Practice vibration stopped."); }}>Stop vibration</button>
    </div>}
    <p role="status" aria-atomic="true">{message}</p>
  </fieldset>;
}
