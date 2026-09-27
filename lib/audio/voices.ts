// Best Use of ElevenLabs: the five voices a user can pick in setup and Settings. The chosen voice
// says the warning words ("pole", "left") and speaks Ask's answers. Its recorded clips live in
// `public/sounds/voice/<key>`, made by `npm run sounds`.

// ElevenLabs' most expressive model, for every voice clip and every Ask answer, at the best MP3 the
// account's plan allows. Eleven v3 takes about 2 s for a two-sentence Ask answer, against 0.5 s for
// Flash v2.5; ELEVENLABS_TTS_MODEL can swap the model back on the server if that ever matters more.
export const TTS_MODEL = "eleven_v3";
export const TTS_FORMAT = "mp3_44100_192";

export interface Voice {
  key: string;
  name: string;
  // How it sounds, in a few words, shown next to the name.
  tone: string;
  // ElevenLabs' id for the voice. A public id for one of its default voices, not a secret.
  elevenId: string;
  // Played when the user taps Play: a line in the voice's own manner. None of them promise safety.
  sample: string;
}

export const VOICES = [
  {
    key: "river",
    name: "River",
    tone: "Calm and even",
    elevenId: "SAz9YHcvj6GT2YYXdXww",
    sample: "I'm River. I'll stay calm and keep it short. Step down, ahead.",
  },
  {
    key: "sarah",
    name: "Sarah",
    tone: "Warm and reassuring",
    elevenId: "EXAVITQu4vr4xnSDxMaL",
    sample: "Hi, I'm Sarah, and I'm here to help. Take your time. Pole, on your left.",
  },
  {
    key: "alice",
    name: "Alice",
    tone: "Clear and crisp",
    elevenId: "Xb7hH8MSUJpSbSDYk0k2",
    sample: "I'm Alice. Short, clear directions, every step of the way. Bike, on your right.",
  },
  {
    key: "eric",
    name: "Eric",
    tone: "Steady and smooth",
    elevenId: "cjVigY5qzO86Huf0OWal",
    sample: "I'm Eric. I'll tell you what's ahead, nice and steady. Something at head height, ahead.",
  },
  {
    key: "chris",
    name: "Chris",
    tone: "Friendly and down-to-earth",
    elevenId: "iP95p4xoKVk53GoZ742B",
    sample: "Hey, I'm Chris. Let's get walking. I'll give you a shout when something's in your way.",
  },
] as const satisfies readonly Voice[];

export type VoiceKey = (typeof VOICES)[number]["key"];

export const VOICE_KEYS = VOICES.map((v) => v.key) as [VoiceKey, ...VoiceKey[]];

// The voice beluga had before there was a choice.
export const DEFAULT_VOICE: VoiceKey = "river";

export function isVoiceKey(value: unknown): value is VoiceKey {
  return typeof value === "string" && (VOICE_KEYS as readonly string[]).includes(value);
}

export function voiceOf(key: VoiceKey): Voice {
  return VOICES.find((v) => v.key === key) ?? VOICES[0];
}

// Where a voice's recorded sample is, under /sounds.
export function samplePath(key: VoiceKey): string {
  return `voice/${key}/sample.mp3`;
}
