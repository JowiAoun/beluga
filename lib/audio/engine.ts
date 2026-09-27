// Plays the warning sounds on the phone: one AudioContext, a limiter on the mix, a stereo voice
// per hazard, and a quiet keep-alive so Bluetooth never sleeps between warnings. Part of the
// safety loop, so it never touches the network: every sound is in memory before the walk starts.

import { priorityOf } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { SOUND_IDS, type SoundId } from "@/lib/shared/enums";
import { AUDIO } from "@/lib/shared/params";
import { isClipId, type ClipId, type DecodedLibrary } from "./library";
import { createPlacer, DEFAULT_EARS, lateralOf, type EarSettings, type Pan, type Placer } from "./placement";
import { QUIET, Scheduler, type Action, type Scene, type SoundInfo, type VoiceView, type WarnFrom } from "./scheduler";
import { renderTone } from "./tones";

interface LoadedSound {
  buffer: AudioBuffer;
  loop: AudioBuffer | null;
  gain: number;
}

interface Playing {
  source: AudioBufferSourceNode;
  gain: GainNode;
  level: number;
}

interface VoiceNodes {
  placer: Placer;
  pan: Pan;
  gainDb: number;
  current: Playing | null;
  loop: Playing | null;
}

export interface AudioEngineOptions {
  // Speaks a voice clip's words when the recorded clips don't cover them.
  speak?: (text: string) => void;
  ears?: EarSettings;
}

export interface AudioStats {
  voices: VoiceView[];
  recentWarnings: WarningSoundLog[];
  // "library" once the ElevenLabs sounds are decoded, "tones" before.
  source: "tones" | "library";
  // How far ahead the bands look, from Chrome's output latency.
  leadMs: number;
  outputLatencyMs: number;
  state: AudioContextState;
}

export interface WarningSoundLog {
  id: string;
  sound: SoundId;
  kind: HazardUpdate["kind"];
  label: HazardUpdate["label"];
  distance: number;
  angle: number;
  lateral: number;
  blocking: number;
  reason: string;
  rhythm: string;
  repeatMs: number;
  count: number;
  time: string;
}

// Level changes glide over this time constant, in seconds, so they never click.
const LEVEL_SECONDS = 0.03;

// Silence between the word and the side in a voice clip, in seconds.
const CLIP_GAP_S = 0.05;

function warningReason(hazard: HazardUpdate, blocked: boolean): string {
  if (hazard.kind === "drop_off") return "depth detected a drop-off";
  if (hazard.kind === "head_height") return "depth detected a head-height obstacle";
  if (blocked) return "triage marked the path blocked";
  if (hazard.label !== "unknown") return `detector matched ${hazard.label.replace(/_/g, " ")}`;
  return "depth detected an obstacle; no detector label matched";
}

function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

function toBuffer(ctx: BaseAudioContext, samples: Float32Array<ArrayBuffer>): AudioBuffer {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}

function loadTones(ctx: BaseAudioContext): Record<SoundId, LoadedSound> {
  const sounds = {} as Record<SoundId, LoadedSound>;
  for (const id of SOUND_IDS) {
    const tone = renderTone(id, ctx.sampleRate);
    sounds[id] = {
      buffer: toBuffer(ctx, tone.samples),
      loop: tone.loop && toBuffer(ctx, tone.loop),
      gain: dbToGain(tone.trimDb),
    };
  }
  return sounds;
}

export class AudioEngine {
  private readonly limiter: DynamicsCompressorNode;
  private readonly master: GainNode;
  // Every hazard warning goes through here, so it can be turned down under an Ask answer.
  private readonly hazardBus: GainNode;
  private hazardsDucked = false;
  // Audio-clock time the phone's own voice is expected to stop speaking an answer.
  private spokenUntil = 0;
  // Counts phone-voice answers, so a late end from an older one can't lift the duck of a newer one.
  private spokenAnswers = 0;
  private readonly centre: Placer;
  private sounds: Record<SoundId, LoadedSound>;
  private clips: Partial<Record<ClipId, AudioBuffer>> = {};
  private source: AudioStats["source"] = "tones";
  private readonly scheduler: Scheduler;
  private readonly voices = new Map<string, VoiceNodes>();
  private readonly ears: EarSettings;
  private readonly speak?: (text: string) => void;
  private scene: Scene = QUIET;
  private timer: ReturnType<typeof setInterval> | null = null;
  private keepAlive: AudioBufferSourceNode | null = null;
  private aliveTick = false;
  // Audio-clock time the last sound started, for the alive tick.
  private lastSoundAt = 0;
  private readonly oneShots = new Set<Playing>();
  private recentWarnings: WarningSoundLog[] = [];
  // The spoken Ask answer, while it plays.
  private answer: { playing: Playing; placer: Placer } | null = null;

  constructor(
    private readonly ctx: AudioContext,
    options: AudioEngineOptions = {},
  ) {
    this.ears = options.ears ?? DEFAULT_EARS;
    this.speak = options.speak;
    // A hazard, its centre marker and a voice at once could clip, and clipping buzzes on bone conduction.
    this.limiter = new DynamicsCompressorNode(ctx, {
      threshold: AUDIO.limiterThresholdDb,
      knee: 0,
      ratio: 20,
      attack: 0.002,
      release: 0.1,
    });
    this.limiter.connect(ctx.destination);
    this.master = new GainNode(ctx);
    this.master.connect(this.limiter);
    this.hazardBus = new GainNode(ctx);
    this.hazardBus.connect(this.master);
    this.centre = createPlacer(ctx, this.hazardBus, 0, this.ears);
    this.sounds = loadTones(ctx);
    this.scheduler = new Scheduler(this.soundInfo());
  }

  // Swaps in the ElevenLabs sounds and clips. Sounds missing from the library keep their tone.
  useLibrary(library: DecodedLibrary): void {
    const sounds = { ...this.sounds };
    for (const id of SOUND_IDS) {
      const sound = library.sounds[id];
      if (sound) sounds[id] = { buffer: sound.buffer, loop: sound.loop, gain: dbToGain(sound.gainDb) };
    }
    this.sounds = sounds;
    this.clips = library.clips;
    this.source = Object.keys(library.sounds).length > 0 ? "library" : this.source;
    this.scheduler.setSounds(this.soundInfo());
  }

  private soundInfo(): Record<SoundId, SoundInfo> {
    const info = {} as Record<SoundId, SoundInfo>;
    for (const id of SOUND_IDS) {
      info[id] = { durationS: this.sounds[id].buffer.duration, hasLoop: this.sounds[id].loop !== null };
    }
    return info;
  }

  start(): void {
    if (this.timer !== null) return;
    this.startKeepAlive();
    this.timer = setInterval(() => this.tick(), AUDIO.schedulerTickMs);
  }

  // Call on every hazard engine result. An empty list silences every voice. `blocked` holds the
  // hazards triage said block the path.
  update(hazards: HazardUpdate[], motion: { speed: number; stationary: boolean }, blocked?: ReadonlySet<string>): void {
    this.scene = { hazards, speed: motion.speed, stationary: motion.stationary, leadS: this.leadS(), blocked };
    // Straight away, not on the next tick: a new hazard should sound as soon as it is known.
    if (this.timer !== null) this.tick();
  }

  // A one-off sound, like the "reported" blip or an audition, from one side.
  play(sound: SoundId, pan: Pan = 0): void {
    const { buffer, gain } = this.sounds[sound];
    this.playBuffer(buffer, pan, gain);
  }

  // Any decoded buffer, such as a library variant on the audition page. Returns when it ends,
  // on the audio clock.
  playBuffer(buffer: AudioBuffer, pan: Pan = 0, level = 1, at = this.ctx.currentTime): number {
    const placer = createPlacer(this.ctx, this.master, pan, this.ears);
    const playing = this.startSound(buffer, level, placer, at, false);
    this.oneShots.add(playing);
    playing.source.onended = () => {
      this.oneShots.delete(playing);
      playing.gain.disconnect();
      placer.disconnect();
    };
    return Math.max(at, this.ctx.currentTime) + buffer.duration;
  }

  // Fades everything out and lets go of the mix. The AudioContext stays for the next session.
  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.scene = QUIET;
    this.stopAnswer();
    this.apply(this.scheduler.clear());
    this.keepAlive?.stop();
    this.keepAlive?.disconnect();
    this.keepAlive = null;
    for (const playing of this.oneShots) this.fade(playing, this.ctx.currentTime);
    this.oneShots.clear();
    setTimeout(() => this.limiter.disconnect(), 200);
  }

  stats(): AudioStats {
    return {
      voices: this.scheduler.snapshot(),
      recentWarnings: this.recentWarnings.map((warning) => ({ ...warning })),
      source: this.source,
      leadMs: Math.round(this.leadS() * 1000),
      outputLatencyMs: Math.round(((this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)) * 1000),
      state: this.ctx.state,
    };
  }

  private leadS(): number {
    const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.min(latency, AUDIO.latencyLeadMaxMs / 1000);
  }

  private tick(): void {
    this.apply(this.scheduler.tick(this.ctx.currentTime, this.scene));
    this.fitAnswer();
    if (this.aliveTick && this.ctx.currentTime - this.lastSoundAt >= AUDIO.aliveTickMs / 1000) {
      this.play("centre_tick");
    }
  }

  // Master volume in dB; 0 plays the sounds at the level they were made.
  setVolume(db: number): void {
    this.master.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, LEVEL_SECONDS);
  }

  // How far away each hazard starts to sound, from Settings.
  setWarnFrom(warnFrom: WarnFrom): void {
    this.scheduler.setWarnFrom(warnFrom);
  }

  // Plays this one sound for every warning, with no words, or null for a sound per kind of hazard.
  setOneSound(sound: SoundId | null): void {
    this.scheduler.setOneSound(sound);
  }

  setWords(on: boolean): void {
    this.scheduler.setWords(on);
  }

  // A soft tick after 30 s with no other sound, so the user knows beluga is still running.
  setAliveTick(on: boolean): void {
    this.aliveTick = on;
    this.lastSoundAt = this.ctx.currentTime;
  }

  // An Ask answer from the side of the object it describes. It plays at full level with obstacle
  // warnings turned down under it, and stops for a drop-off or head-height hazard: those come first.
  playAnswer(buffer: AudioBuffer, pan: Pan): boolean {
    this.stopAnswer();
    if (this.scene.hazards.some((h) => h.active && priorityOf(h) <= 2)) return false;
    const placer = createPlacer(this.ctx, this.master, pan, this.ears);
    const playing = this.startSound(buffer, 1, placer, this.ctx.currentTime, false);
    const answer = { playing, placer };
    playing.source.onended = () => {
      playing.gain.disconnect();
      placer.disconnect();
      if (this.answer === answer) this.answer = null;
      this.fitHazardBus();
    };
    this.answer = answer;
    this.fitAnswer();
    return this.answer === answer;
  }

  stopAnswer(): void {
    if (!this.answer) return;
    this.fade(this.answer.playing, this.ctx.currentTime);
    this.answer = null;
    this.fitHazardBus();
  }

  // For an answer the phone's own voice speaks: obstacle warnings stay down while it talks.
  // Call the returned function when the voice ends. The duck also ends on its own after
  // `expectedMs`, capped, so a lost end event can't leave the warnings quiet.
  duckForSpokenAnswer(expectedMs: number): () => void {
    const ms = Math.min(Math.max(expectedMs, 0), AUDIO.spokenAnswerMaxMs);
    const answer = ++this.spokenAnswers;
    this.spokenUntil = this.ctx.currentTime + ms / 1000;
    this.fitHazardBus();
    return () => {
      if (this.spokenAnswers !== answer) return;
      this.spokenUntil = 0;
      this.fitHazardBus();
    };
  }

  answerPlaying(): boolean {
    return this.answer !== null;
  }

  private fitAnswer(): void {
    if (this.answer && this.scene.hazards.some((h) => priorityOf(h) <= 2)) this.stopAnswer();
    this.fitHazardBus();
  }

  // Warnings at half amplitude while an answer is spoken, unless a drop-off or head-height
  // hazard is active: those always play at full level.
  private fitHazardBus(): void {
    const speaking = this.answer !== null || this.ctx.currentTime < this.spokenUntil;
    const urgent = this.scene.hazards.some((h) => h.active && priorityOf(h) <= 2);
    const ducked = speaking && !urgent;
    if (ducked === this.hazardsDucked) return;
    this.hazardsDucked = ducked;
    const gain = ducked ? dbToGain(AUDIO.hazardUnderAnswerDb) : 1;
    this.hazardBus.gain.setTargetAtTime(gain, this.ctx.currentTime, LEVEL_SECONDS);
  }

  private apply(actions: Action[]): void {
    for (const action of actions) {
      if (action.type === "say") {
        this.say(action.words, action.pan);
        continue;
      }
      const voice = this.voices.get(action.id);
      switch (action.type) {
        case "voice":
          if (!voice) {
            const placer = createPlacer(this.ctx, this.hazardBus, action.pan, this.ears);
            placer.input.gain.value = dbToGain(action.gainDb);
            this.voices.set(action.id, { placer, pan: action.pan, gainDb: action.gainDb, current: null, loop: null });
            break;
          }
          if (Math.abs(voice.pan - action.pan) > 0.01) {
            voice.pan = action.pan;
            voice.placer.setPan(action.pan);
          }
          if (Math.abs(voice.gainDb - action.gainDb) > 0.1) {
            voice.gainDb = action.gainDb;
            voice.placer.input.gain.setTargetAtTime(dbToGain(action.gainDb), this.ctx.currentTime, LEVEL_SECONDS);
          }
          break;
        case "hit": {
          if (!voice) break;
          const sound = this.sounds[action.sound];
          this.recordWarning(action.id, action.sound, "repeating");
          // One instance per hazard: the new repeat cuts the one still playing.
          if (voice.current) this.fade(voice.current, action.at);
          voice.current = this.startSound(sound.buffer, sound.gain, voice.placer, action.at, false);
          if (action.centre) {
            const tick = this.sounds.centre_tick;
            this.startSound(tick.buffer, tick.gain * dbToGain(voice.gainDb), this.centre, action.at, false);
          }
          break;
        }
        case "loop_start": {
          const loop = this.sounds[action.sound].loop;
          if (!voice || !loop) break;
          this.recordWarning(action.id, action.sound, "continuous");
          if (voice.current) this.fade(voice.current, action.at);
          voice.current = null;
          voice.loop = this.startSound(loop, this.sounds[action.sound].gain, voice.placer, action.at, true);
          break;
        }
        case "loop_stop":
          if (voice?.loop) this.fade(voice.loop, action.at);
          if (voice) voice.loop = null;
          break;
        case "end": {
          if (!voice) break;
          if (voice.current) this.fade(voice.current, this.ctx.currentTime);
          if (voice.loop) this.fade(voice.loop, this.ctx.currentTime);
          this.voices.delete(action.id);
          setTimeout(() => voice.placer.disconnect(), 100);
          break;
        }
      }
    }
  }

  // Recorded clips play one after another from the hazard's side. Without all of them, the
  // phone's own voice says the words, from both sides.
  say(words: string[], pan: Pan = 0): void {
    const buffers = words.map((word) => (isClipId(word) ? this.clips[word] : undefined));
    if (buffers.some((b) => !b)) {
      this.speak?.(words.join(", "));
      return;
    }
    let at = this.ctx.currentTime;
    for (const buffer of buffers) at = this.playBuffer(buffer!, pan, 1, at) + CLIP_GAP_S;
  }

  private recordWarning(id: string, sound: SoundId, rhythm: string): void {
    const hazard = this.scene.hazards.find((item) => item.id === id);
    if (!hazard) return;
    const voice = this.scheduler.snapshot().find((item) => item.id === id);
    const previous = this.recentWarnings.find((item) => item.id === id && item.sound === sound);
    const warning: WarningSoundLog = {
      id,
      sound,
      kind: hazard.kind,
      label: hazard.label,
      distance: voice?.distance ?? hazard.distance,
      angle: hazard.angle,
      lateral: lateralOf(hazard),
      blocking: hazard.blocking,
      reason: warningReason(hazard, this.scene.blocked?.has(id) ?? false),
      rhythm,
      repeatMs: voice?.repeatMs ?? 0,
      count: previous?.count ?? 0,
      time: new Date().toLocaleTimeString(),
    };
    warning.count++;
    this.recentWarnings = [warning, ...this.recentWarnings.filter((item) => item !== previous)].slice(0, 6);
  }

  private startSound(buffer: AudioBuffer, level: number, placer: Placer, at: number, loop: boolean): Playing {
    const t = Math.max(at, this.ctx.currentTime);
    const source = new AudioBufferSourceNode(this.ctx, { buffer, loop });
    const gain = new GainNode(this.ctx, { gain: loop ? 0 : level });
    if (loop) {
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level, t + AUDIO.cutFadeMs / 1000);
    }
    source.connect(gain).connect(placer.input);
    source.onended = () => gain.disconnect();
    source.start(t);
    this.lastSoundAt = Math.max(this.lastSoundAt, t);
    return { source, gain, level };
  }

  private fade(playing: Playing, at: number): void {
    const t = Math.max(at, this.ctx.currentTime);
    const end = t + AUDIO.cutFadeMs / 1000;
    playing.gain.gain.cancelScheduledValues(t);
    playing.gain.gain.setValueAtTime(playing.level, t);
    playing.gain.gain.linearRampToValueAtTime(0, end);
    try {
      playing.source.stop(end);
    } catch {
      // Already stopped.
    }
  }

  // Android and the earbuds go idle after a few seconds of silence and clip the start of the next
  // sound. This noise sits far below hearing and keeps the whole path awake.
  private startKeepAlive(): void {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const level = dbToGain(AUDIO.keepAliveDbfs);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * level;
    const source = new AudioBufferSourceNode(this.ctx, { buffer, loop: true });
    source.connect(this.ctx.destination);
    source.start();
    this.keepAlive = source;
  }
}
