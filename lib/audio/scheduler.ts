// Decides what the warning sounds do on each tick: which hazards sound, how often, how loud,
// from which side, and when a word is spoken. Pure logic on the audio clock, so tests can run it
// with made-up times; the engine turns its actions into Web Audio calls.

import { priorityOf } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import type { SoundId } from "@/lib/shared/enums";
import { AUDIO, AUDIO_BANDS, audioBandFor, defaultWarnFromM } from "@/lib/shared/params";
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
  // Hazards triage said block the path (Phase 5): they play the "blocked" taps.
  blocked?: ReadonlySet<string>;
}

export const QUIET: Scene = { hazards: [], speed: 0, stationary: false, leadS: 0 };

// How far away a hazard starts to warn, in metres. The walk sets it from Settings, one per kind.
export type WarnFrom = (hazard: HazardUpdate) => number;

const DEFAULT_WARN_FROM: WarnFrom = (hazard) => defaultWarnFromM(hazard.kind);

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
  // When the centre marker last played with this voice; null while the hazard is off to a side.
  lastCentreAt: number | null;
}

export class Scheduler {
  private voices = new Map<string, Voice>();
  // Hazards that have had their word, and when each word + side was last said.
  private spoken = new Set<string>();
  private lastSaid = new Map<string, number>();
  // One sound for every warning, with no words and no centre marker, when the user picks it.
  private oneSound: SoundId | null = null;
  private warnFrom: WarnFrom = DEFAULT_WARN_FROM;
  // Names like "pole" as a hazard comes near. The user can turn them off in Settings.
  private words = true;

  constructor(
    private sounds: Readonly<Record<SoundId, SoundInfo>>,
    private readonly maxVoices: number = AUDIO.maxHazardVoices,
  ) {}

  setOneSound(sound: SoundId | null): void {
    this.oneSound = sound;
  }

  setWarnFrom(warnFrom: WarnFrom): void {
    this.warnFrom = warnFrom;
  }

  setWords(on: boolean): void {
    this.words = on;
  }

  // When the recorded library replaces the tones, lengths and loops change.
  setSounds(sounds: Readonly<Record<SoundId, SoundInfo>>): void {
    this.sounds = sounds;
  }

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

    const candidates = [];
    for (const hazard of scene.hazards) {
      const distance = Math.max(0, hazard.distance - lead);
      const warnFromM = this.warnFrom(hazard);
      const band = audioBandFor(distance, warnFromM);
      if (!band) continue;
      const playing = this.voices.has(hazard.id) ? 0 : 1;
      const rank = Math.floor(distance / AUDIO.sameDistanceM);
      candidates.push({ hazard, distance, warnFromM, band, rank, priority: priorityOf(hazard), playing });
    }
    // The nearest first, in 0.25 m steps, then the most urgent kind. In a tie the one already
    // sounding stays, so the sound doesn't flip between two sides.
    candidates.sort(
      (a, b) => a.rank - b.rank || a.priority - b.priority || a.playing - b.playing || a.distance - b.distance,
    );
    const audible = candidates.slice(0, this.maxVoices);

    const keep = new Set(audible.map((a) => a.hazard.id));
    for (const voice of this.voices.values()) {
      if (keep.has(voice.id)) continue;
      this.end(voice, now, actions);
      this.voices.delete(voice.id);
    }
    const present = new Set(scene.hazards.map((h) => h.id));
    for (const id of this.spoken) if (!present.has(id)) this.spoken.delete(id);

    const dropOffPlaying = audible.some((a) => a.priority === 1);

    for (const { hazard, distance, warnFromM, band, priority } of audible) {
      const lateral = lateralOf(hazard);
      const pan = panForLateral(lateral);
      const side = sideOf(lateral);
      const blocked = scene.blocked?.has(hazard.id) ?? false;
      const sound = this.oneSound ?? soundFor(hazard, blocked);
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
          lastCentreAt: null,
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

      const ducked = dropOffPlaying && priority > 1;
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
        if (side !== "ahead" || this.oneSound) voice.lastCentreAt = null;
        while (voice.nextAt <= now + aheadS) {
          const at = Math.max(voice.nextAt, now);
          const centre =
            side === "ahead" &&
            !this.oneSound &&
            (voice.lastCentreAt === null || at - voice.lastCentreAt >= AUDIO.centreMarkerEveryMs / 1000 - 1e-9);
          if (centre) voice.lastCentreAt = at;
          actions.push({ type: "hit", id: voice.id, sound, at, centre });
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

      // Its word, once, as it comes into the far half of its warning distance.
      const word = this.oneSound || !this.words ? null : wordFor(hazard, blocked);
      const clipBand = AUDIO.voiceClipBandShare;
      const inClipBand = distance >= clipBand.from * warnFromM && distance <= clipBand.to * warnFromM;
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
