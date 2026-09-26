// Points each plugged-in phone's localhost:3000 at this laptop's dev server over USB.
// Chrome treats localhost as a secure page, so /walk gets WebXR with no tunnel and no deploy.
// Finds adb inside the Android SDK too, for when platform-tools isn't on PATH.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = 3000;
const ADB = process.platform === "win32" ? "adb.exe" : "adb";

function findAdb(): string | null {
  try {
    execFileSync(ADB, ["version"], { stdio: "ignore" });
    return ADB;
  } catch {
    // Not on PATH: look where Android Studio puts the SDK.
  }
  const roots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(homedir(), "Android", "Sdk"),
    join(homedir(), "Library", "Android", "sdk"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Android", "Sdk"),
  ];
  for (const root of roots) {
    const path = root ? join(root, "platform-tools", ADB) : null;
    if (path && existsSync(path)) return path;
  }
  return null;
}

const TURN_ON_DEBUGGING = [
  "Turn on USB debugging on the phone:",
  "  1. Settings > About phone (Samsung: then Software information): tap Build number 7 times.",
  "  2. Settings > Developer options: turn on USB debugging.",
  "  3. Unplug and replug the cable, then tap Allow on the phone.",
  "If it still doesn't show up, the cable may only charge: try another one.",
].join("\n");

function fixFor(state: string): string {
  if (state === "unauthorized") return 'tap Allow on the phone\'s "Allow USB debugging?" prompt, then run this again';
  if (state === "offline") return "unplug the cable, plug it back in, then run this again";
  if (state.startsWith("no permissions")) return "this user can't open the USB device: add Android udev rules";
  return `adb says "${state}"`;
}

async function devServerUp(): Promise<boolean> {
  try {
    await fetch(`http://localhost:${PORT}/`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<number> {
  const adb = findAdb();
  if (!adb) {
    console.error("adb not found. Install Android platform-tools, or set ANDROID_HOME to your SDK folder.");
    return 1;
  }

  const run = (args: string[]) => execFileSync(adb, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const devices = run(["devices"])
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, ...rest] = line.split(/\s+/);
      return { serial, state: rest.join(" ") };
    });

  if (devices.length === 0) {
    console.error(`No phone found.\n${TURN_ON_DEBUGGING}`);
    return 1;
  }

  let ready = 0;
  for (const { serial, state } of devices) {
    if (state !== "device") {
      console.error(`${serial}: ${fixFor(state)}`);
      continue;
    }
    const model = run(["-s", serial, "shell", "getprop", "ro.product.model"]).trim();
    run(["-s", serial, "reverse", `tcp:${PORT}`, `tcp:${PORT}`]);
    console.info(`${model || serial}: localhost:${PORT} on the phone now reaches this laptop`);
    ready++;
  }
  if (ready === 0) return 1;

  if (!(await devServerUp())) console.warn(`Nothing answers on port ${PORT} yet: run npm run dev in another terminal.`);
  console.info(`Open http://localhost:${PORT}/walk in Chrome on the phone.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
