// Decides what the warning sounds do on each tick: which hazards sound, how often, how loud,
// from which side, and when a word is spoken. Pure logic on the audio clock, so tests can run it
// with made-up times; the engine turns its actions into Web Audio calls.

import { priorityOf } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import type { SoundId } from "@/lib/shared/enums";
import { AUDIO, AUDIO_BANDS, audioBandFor } from "@/lib/shared/params";
import { lateralOf, panForLateral, sideOf, type Pan } from "./placement";
import { soundFor, wordFor } from "./sounds";

export interface SoundInfo {
  durationS: number;
  hasLoop: boolean;
}

export interface Scene {
  // Active hazards, most urgent first, as the hazard engine gives them.
  hazards: HazardUpdate[];
  // Metres per second.
  speed: number;
  stationary: boolean;
  // Seconds from scheduling a sound to hearing it (mostly Bluetooth).
  leadS: number;
}

export const QUIET: Scene = { hazards: [], speed: 0, stationary: false, leadS: 0 };

export type Action =
  // Creates the hazard's voice, or moves it and sets its level.
  | { type: "voice"; id: string; pan: Pan; gainDb: number }
  | { type: "hit"; id: string; sound: SoundId; at: number; centre: boolean }
  | { type: "loop_start"; id: string; sound: SoundId; at: number }
  | { type: "loop_stop"; id: string; at: number }
  | { type: "say"; id: string; words: string[]; pan: Pan }
  | { type: "end"; id: string };

export interface VoiceView {
  id: string;
  sound: SoundId;
  // The distance the bands used, after the Bluetooth lead.
  distance: number;
  pan: Pan;
  gainDb: number;
  repeatMs: number;
  looping: boolean;
  muted: boolean;
}

interface Voice extends VoiceView {
  nextAt: number | null;
  lastHitAt: number | null;
  stationaryRepeats: number;
}

export class Scheduler {
  private voices = new Map<string, Voice>();
  // Hazards that have had their word, and when each word + side was last said.
  private spoken = new Set<string>();
  private lastSaid = new Map<string, number>();

  constructor(private readonly sounds: Readonly<Record<SoundId, SoundInfo>>) {}

  // What each voice is doing, for the debug overlay.
  snapshot(): VoiceView[] {
    return [...this.voices.values()].map((v) => ({
      id: v.id,
      sound: v.sound,
      distance: v.distance,
      pan: v.pan,
      gainDb: v.gainDb,
      repeatMs: v.repeatMs,
      looping: v.looping,
      muted: v.muted,
    }));
  }

  // Ends every voice, for a stopped session.
  clear(): Action[] {
    const actions: Action[] = [];
    for (const voice of this.voices.values()) this.end(voice, 0, actions);
    this.voices.clear();
    this.spoken.clear();
    return actions;
  }

  // `now` is the audio clock in seconds. Hits land from now up to the schedule-ahead window.
  tick(now: number, scene: Scene): Action[] {
    const actions: Action[] = [];
    const aheadS = AUDIO.scheduleAheadMs / 1000;
    const lead = scene.stationary ? 0 : scene.speed * scene.leadS;

    const audible = [];
    for (const hazard of scene.hazards) {
      const distance = Math.max(0, hazard.distance - lead);
      const band = audioBandFor(distance, hazard.kind);
      if (band) audible.push({ hazard, distance, band });
      if (audible.length === AUDIO.maxHazardVoices) break;
    }

    const keep = new Set(audible.map((a) => a.hazard.id));
    for (const voice of this.voices.values()) {
      if (keep.has(voice.id)) continue;
      this.end(voice, now, actions);
      this.voices.delete(voice.id);
    }
    const present = new Set(scene.hazards.map((h) => h.id));
    for (const id of this.spoken) if (!present.has(id)) this.spoken.delete(id);

    const dropOffPlaying = audible.length > 0 && priorityOf(audible[0].hazard) === 1;

    for (const { hazard, distance, band } of audible) {
      const lateral = lateralOf(hazard);
      const pan = panForLateral(lateral);
      const side = sideOf(lateral);
      const sound = soundFor(hazard);
      const info = this.sounds[sound];

      let voice = this.voices.get(hazard.id);
      if (!voice) {
        voice = {
          id: hazard.id,
          sound,
          distance,
          pan,
          gainDb: 0,
          repeatMs: band.repeatMs,
          looping: false,
          muted: false,
          nextAt: null,
          lastHitAt: null,
          stationaryRepeats: 0,
        };
        this.voices.set(hazard.id, voice);
      }
      if (voice.sound !== sound && voice.looping) {
        // A detector label arrived mid-loop: restart the loop with the new sound.
        actions.push({ type: "loop_stop", id: voice.id, at: now });
        voice.looping = false;
      }
      voice.sound = sound;
      voice.distance = distance;
      voice.pan = pan;
      voice.repeatMs = band.repeatMs;

      // Standing still: obstacles drop and then stop until the user moves. Drop-offs never do.
      const reduced = scene.stationary && hazard.kind !== "drop_off";
      if (!reduced) voice.stationaryRepeats = 0;
      voice.muted = reduced && voice.stationaryRepeats >= AUDIO.stationaryStopAfterRepeats;

      const ducked = dropOffPlaying && priorityOf(hazard) > 1;
      voice.gainDb =
        band.gainDb + (ducked ? AUDIO.lowerPriorityDuckDb : 0) + (reduced ? AUDIO.stationaryReductionDb : 0);
      actions.push({ type: "voice", id: voice.id, pan, gainDb: voice.gainDb });

      // In the closest band a sound longer than the repeat plays as its loop, or repeats would pile up.
      const interval = band.repeatMs / 1000;
      const wantLoop =
        band === AUDIO_BANDS[0] && info.hasLoop && info.durationS > interval && !reduced && !voice.muted;
      if (wantLoop && !voice.looping) {
        voice.looping = true;
        actions.push({ type: "loop_start", id: voice.id, sound, at: now });
      } else if (!wantLoop && voice.looping) {
        voice.looping = false;
        voice.nextAt = null;
        actions.push({ type: "loop_stop", id: voice.id, at: now });
      }

      if (!voice.looping && !voice.muted) {
        if (voice.nextAt === null) voice.nextAt = now;
        // Closer means a shorter repeat, and the next one comes sooner.
        else if (voice.lastHitAt !== null) voice.nextAt = Math.min(voice.nextAt, voice.lastHitAt + interval);
        while (voice.nextAt <= now + aheadS) {
          const at = Math.max(voice.nextAt, now);
          actions.push({ type: "hit", id: voice.id, sound, at, centre: side === "ahead" });
          voice.lastHitAt = at;
          voice.nextAt = at + interval;
          if (reduced && ++voice.stationaryRepeats >= AUDIO.stationaryStopAfterRepeats) {
            voice.muted = true;
            voice.nextAt = null;
            break;
          }
        }
      } else if (voice.muted) {
        voice.nextAt = null;
      }

      // Its word, once, as it comes into the 1.5 to 2.0 m band.
      const word = wordFor(hazard);
      const inClipBand = distance >= AUDIO.voiceClipBandM.from && distance <= AUDIO.voiceClipBandM.to;
      if (word && inClipBand && !this.spoken.has(hazard.id)) {
        this.spoken.add(hazard.id);
        const key = `${word}:${side}`;
        const last = this.lastSaid.get(key);
        if (last === undefined || now - last >= AUDIO.voiceClipCooldownMs / 1000) {
          this.lastSaid.set(key, now);
          actions.push({ type: "say", id: hazard.id, words: AUDIO.voiceClipSaysSide ? [word, side] : [word], pan });
        }
      }
    }
    return actions;
  }

  private end(voice: Voice, now: number, actions: Action[]): void {
    if (voice.looping) actions.push({ type: "loop_stop", id: voice.id, at: now });
    actions.push({ type: "end", id: voice.id });
  }
}
