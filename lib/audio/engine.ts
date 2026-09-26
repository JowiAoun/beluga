// Plays the warning sounds on the phone: one AudioContext, a limiter on the mix, a stereo voice
// per hazard, and a quiet keep-alive so Bluetooth never sleeps between warnings. Part of the
// safety loop, so it never touches the network: every sound is in memory before the walk starts.

import type { HazardUpdate } from "@/lib/shared/contracts";
import { SOUND_IDS, type SoundId } from "@/lib/shared/enums";
import { AUDIO } from "@/lib/shared/params";
import { createPlacer, DEFAULT_EARS, type EarSettings, type Pan, type Placer } from "./placement";
import { QUIET, Scheduler, type Action, type Scene, type SoundInfo, type VoiceView } from "./scheduler";
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
  // Speaks a voice clip's words while there are no recorded clips (Phase 3a).
  speak?: (text: string) => void;
  ears?: EarSettings;
}

export interface AudioStats {
  voices: VoiceView[];
  // How far ahead the bands look, from Chrome's output latency.
  leadMs: number;
  outputLatencyMs: number;
  state: AudioContextState;
}

// Level changes glide over this time constant, in seconds, so they never click.
const LEVEL_SECONDS = 0.03;

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
  private readonly centre: Placer;
  private readonly sounds: Record<SoundId, LoadedSound>;
  private readonly scheduler: Scheduler;
  private readonly voices = new Map<string, VoiceNodes>();
  private readonly ears: EarSettings;
  private readonly speak?: (text: string) => void;
  private scene: Scene = QUIET;
  private timer: ReturnType<typeof setInterval> | null = null;
  private keepAlive: AudioBufferSourceNode | null = null;

  constructor(
    private readonly ctx: AudioContext,
    options: AudioEngineOptions = {},
  ) {
    this.ears = options.ears ?? DEFAULT_EARS;
    this.speak = options.speak;
    // Two hazards and a voice at once would clip, and clipping buzzes on bone conduction.
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
    this.centre = createPlacer(ctx, this.master, 0, this.ears);
    this.sounds = loadTones(ctx);
    const info = {} as Record<SoundId, SoundInfo>;
    for (const id of SOUND_IDS) {
      info[id] = { durationS: this.sounds[id].buffer.duration, hasLoop: this.sounds[id].loop !== null };
    }
    this.scheduler = new Scheduler(info);
  }

  start(): void {
    if (this.timer !== null) return;
    this.startKeepAlive();
    this.timer = setInterval(() => this.tick(), AUDIO.schedulerTickMs);
  }

  // Call on every hazard engine result. An empty list silences every voice.
  update(hazards: HazardUpdate[], motion: { speed: number; stationary: boolean }): void {
    this.scene = { hazards, speed: motion.speed, stationary: motion.stationary, leadS: this.leadS() };
    // Straight away, not on the next tick: a new hazard should sound as soon as it is known.
    if (this.timer !== null) this.tick();
  }

  // A one-off sound, like the "reported" blip or an audition, from one side.
  play(sound: SoundId, pan: Pan = 0): void {
    const placer = createPlacer(this.ctx, this.master, pan, this.ears);
    const { buffer, gain } = this.sounds[sound];
    const playing = this.startSound(buffer, gain, placer, this.ctx.currentTime, false);
    playing.source.onended = () => {
      playing.gain.disconnect();
      placer.disconnect();
    };
  }

  // Fades everything out and lets go of the mix. The AudioContext stays for the next session.
  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.scene = QUIET;
    this.apply(this.scheduler.clear());
    this.keepAlive?.stop();
    this.keepAlive?.disconnect();
    this.keepAlive = null;
    setTimeout(() => this.limiter.disconnect(), 200);
  }

  stats(): AudioStats {
    return {
      voices: this.scheduler.snapshot(),
      leadMs: Math.round(this.leadS() * 1000),
      outputLatencyMs: Math.round(((this.ctx.outputLatency || 0) + this.ctx.baseLatency) * 1000),
      state: this.ctx.state,
    };
  }

  private leadS(): number {
    const latency = (this.ctx.outputLatency || 0) + this.ctx.baseLatency;
    return Math.min(latency, AUDIO.latencyLeadMaxMs / 1000);
  }

  private tick(): void {
    this.apply(this.scheduler.tick(this.ctx.currentTime, this.scene));
  }

  private apply(actions: Action[]): void {
    for (const action of actions) {
      if (action.type === "say") {
        // Until the recorded clips exist, the phone's own voice says it, from both sides.
        this.speak?.(action.words.join(", "));
        continue;
      }
      const voice = this.voices.get(action.id);
      switch (action.type) {
        case "voice":
          if (!voice) {
            const placer = createPlacer(this.ctx, this.master, action.pan, this.ears);
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
