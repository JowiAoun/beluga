// Reporting consent and the device key, kept on the phone. Reporting is off until the user turns
// it on, and a consent given under an older wording counts as off.

import { CONSENT_VERSION } from "@/lib/shared/enums";

const CONSENT_KEY = "beluga.consent";
const DEVICE_KEY = "beluga.deviceKey";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function store(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function reportingOn(storage: KeyValueStore | null = store()): boolean {
  try {
    const saved = JSON.parse(storage?.getItem(CONSENT_KEY) ?? "null") as { on?: boolean; version?: number } | null;
    return saved?.on === true && saved.version === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function setReporting(on: boolean, storage: KeyValueStore | null = store()): void {
  try {
    storage?.setItem(CONSENT_KEY, JSON.stringify({ on, version: CONSENT_VERSION, at: new Date().toISOString() }));
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
}

// A random id made once per phone. The backend turns it into a salted hash on civic reports only.
export function deviceKey(storage: KeyValueStore | null = store()): string {
  try {
    const saved = storage?.getItem(DEVICE_KEY);
    if (saved) return saved;
  } catch {
    // Falls through to a new key.
  }
  return newDeviceKey(storage);
}

// "New demo reporter" in the debug settings: a second judge's report isn't dropped as a repeat.
export function newDeviceKey(storage: KeyValueStore | null = store()): string {
  const key = crypto.randomUUID();
  try {
    storage?.setItem(DEVICE_KEY, key);
  } catch {
    // Private mode: this visit uses the new key without saving it.
  }
  return key;
}
