import {
  AgentSpeakingSpeed,
  ListenMode,
  PipelineKind,
  ReplyLanguage,
  TurnPatience,
  type AgentStackSection,
} from '../profile.interface';

// ─────────────────────────────────────────────────────────────────────────────
// The agent-stack catalog: everything an owner may pick, as typed data.
//
// This is the single source of truth for three consumers — the DTO validator,
// the resolver that builds the worker's wire config, and the dashboard, which
// renders its options from `GET /profiles/agent-stack/catalog`. Adding a model
// or a voice is one entry here and nothing else.
//
// Every id is a LiveKit Inference descriptor (`provider/model`, voices as
// `provider/model:voiceId`), so no provider API key is ever involved. Deliberately
// curated rather than exhaustive: an owner picks between a handful of options
// described in plain language, not between forty model strings.
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogLanguage {
  /** BCP-47 base code. */
  code: string;
  label: string;
}

/**
 * The languages Portvilla offers as a *primary* language. Each must be spoken
 * by the default STT and TTS models, so the default stack works for any of them.
 * The Indian languages are here because that is the launch market.
 */
export const LANGUAGES: readonly CatalogLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'pl', label: 'Polish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'mr', label: 'Marathi' },
  { code: 'bn', label: 'Bengali' },
];

const ALL_LANGUAGES = LANGUAGES.map((l) => l.code);

/** How a model decides the visitor has finished speaking. */
export type TurnDetectionKind = 'model' | 'stt';

export interface CatalogSttModel {
  id: string;
  label: string;
  description: string;
  /** Catalog language codes it transcribes; `null` means every language. */
  languages: readonly string[] | null;
  /** Accepts `language="multi"` and detects the language per utterance. */
  multilingual: boolean;
  /** Accepts a `keyterm` boost list. */
  keyterms: boolean;
  /**
   * `stt` for models with their own end-of-turn detector (Deepgram Flux), which
   * the session should defer to; `model` for everything else, where LiveKit's
   * multilingual turn detector runs on the transcript.
   */
  turnDetection: TurnDetectionKind;
}

export const STT_MODELS: readonly CatalogSttModel[] = [
  {
    id: 'deepgram/nova-3',
    label: 'Deepgram Nova-3',
    description:
      'Understands every language on the list, can follow a visitor who switches mid-sentence, and learns your product names.',
    languages: ALL_LANGUAGES,
    multilingual: true,
    keyterms: true,
    turnDetection: 'model',
  },
  {
    id: 'deepgram/flux-general-multi',
    label: 'Deepgram Flux (multilingual)',
    description:
      'Built for conversation: senses the end of a sentence from how it is said, so replies land sooner. Ten languages.',
    languages: ['en', 'es', 'fr', 'de', 'hi', 'ru', 'pt', 'ja', 'it', 'nl'],
    multilingual: true,
    keyterms: true,
    turnDetection: 'stt',
  },
  {
    id: 'deepgram/flux-general-en',
    label: 'Deepgram Flux (English)',
    description: 'The quickest turn-taking, for an English-only agent.',
    languages: ['en'],
    multilingual: false,
    keyterms: true,
    turnDetection: 'stt',
  },
  {
    id: 'assemblyai/universal-streaming',
    label: 'AssemblyAI Universal',
    description: 'Very accurate English transcription, one language only.',
    languages: ['en'],
    multilingual: false,
    keyterms: false,
    turnDetection: 'model',
  },
  {
    id: 'cartesia/ink-whisper',
    label: 'Cartesia Ink Whisper',
    description:
      'Covers a hundred languages, one at a time — pick it for a language the others do not reach.',
    languages: null,
    multilingual: false,
    keyterms: false,
    turnDetection: 'model',
  },
];

export interface CatalogLlmModel {
  id: string;
  label: string;
  description: string;
}

export const LLM_MODELS: readonly CatalogLlmModel[] = [
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    description:
      'Fast and proven — every Portvilla agent has run on it so far.',
  },
  {
    id: 'openai/gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    description:
      'Follows instructions a little more sharply, at a small cost in speed.',
  },
  {
    id: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    description:
      'Google’s fast model; strong when visitors speak several languages.',
  },
  {
    id: 'google/gemma-4-31b-it',
    label: 'Gemma 4 31B',
    description:
      'An open model hosted by LiveKit itself, for the lowest latency.',
  },
];

export interface CatalogTtsModel {
  id: string;
  label: string;
  /** Catalog language codes the model can speak. */
  languages: readonly string[];
  /** Accepts the slow / normal / fast speed presets. */
  speedControl: boolean;
}

export const TTS_MODELS: readonly CatalogTtsModel[] = [
  {
    id: 'cartesia/sonic-3',
    label: 'Cartesia Sonic 3',
    languages: ALL_LANGUAGES,
    speedControl: true,
  },
  {
    id: 'inworld/inworld-tts-2',
    label: 'Inworld TTS 2',
    languages: ALL_LANGUAGES,
    speedControl: false,
  },
  {
    id: 'deepgram/aura-2',
    label: 'Deepgram Aura 2',
    languages: ['en', 'es', 'nl', 'fr', 'de', 'it', 'ja'],
    speedControl: false,
  },
  {
    id: 'rime/coda',
    label: 'Rime Coda',
    languages: ['en', 'es', 'fr', 'de', 'hi', 'ja', 'pt', 'ar'],
    speedControl: false,
  },
  {
    id: 'xai/tts-1',
    label: 'xAI TTS',
    languages: [
      'en',
      'ar',
      'bn',
      'zh',
      'fr',
      'de',
      'hi',
      'it',
      'ja',
      'ko',
      'pt',
      'ru',
      'es',
      'tr',
    ],
    speedControl: false,
  },
];

export interface CatalogVoice {
  /** `"<model>:<voiceId>"` — what is stored and what the worker receives. */
  descriptor: string;
  label: string;
  description: string;
  /** The locale the sample was recorded in; the model speaks the rest. */
  language: string;
}

const voice = (
  model: string,
  id: string,
  label: string,
  description: string,
  language: string,
): CatalogVoice => ({
  descriptor: `${model}:${id}`,
  label,
  description,
  language,
});

/**
 * LiveKit's suggested voices, one entry each. Every descriptor here appears
 * verbatim in the LiveKit Inference TTS documentation — never invent one.
 */
export const VOICES: readonly CatalogVoice[] = [
  voice(
    'cartesia/sonic-3',
    '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
    'Jacqueline',
    'Confident, young American female',
    'en-US',
  ),
  voice(
    'cartesia/sonic-3',
    'a167e0f3-df7e-4d52-a9c3-f949145efdab',
    'Blake',
    'Energetic American male',
    'en-US',
  ),
  voice(
    'cartesia/sonic-3',
    'f31cc6a7-c1e8-4764-980c-60a361443dd1',
    'Robyn',
    'Neutral, mature Australian female',
    'en-AU',
  ),
  voice(
    'cartesia/sonic-3',
    '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c',
    'Daniela',
    'Calm and trusting Mexican female',
    'es-MX',
  ),
  voice(
    'inworld/inworld-tts-2',
    'Ashley',
    'Ashley',
    'Warm, natural American female',
    'en-US',
  ),
  voice(
    'inworld/inworld-tts-2',
    'Edward',
    'Edward',
    'Fast-talking, emphatic American male',
    'en-US',
  ),
  voice(
    'inworld/inworld-tts-2',
    'Olivia',
    'Olivia',
    'Upbeat, friendly British female',
    'en-GB',
  ),
  voice(
    'inworld/inworld-tts-2',
    'Diego',
    'Diego',
    'Soothing, gentle Mexican male',
    'es-MX',
  ),
  voice(
    'deepgram/aura-2',
    'athena',
    'Athena',
    'Smooth, professional female',
    'en-US',
  ),
  voice(
    'deepgram/aura-2',
    'odysseus',
    'Odysseus',
    'Calm, professional male',
    'en-US',
  ),
  voice(
    'deepgram/aura-2',
    'apollo',
    'Apollo',
    'Comfortable, casual male',
    'en-US',
  ),
  voice(
    'deepgram/aura-2',
    'theia',
    'Theia',
    'Expressive, polite female',
    'en-AU',
  ),
  voice(
    'rime/coda',
    'astra',
    'Astra',
    'Chipper, upbeat American female',
    'en-US',
  ),
  voice(
    'rime/coda',
    'celeste',
    'Celeste',
    'Chill Gen-Z American female',
    'en-US',
  ),
  voice(
    'rime/coda',
    'luna',
    'Luna',
    'Chill but excitable American female',
    'en-US',
  ),
  voice('xai/tts-1', 'ara', 'Ara', 'Warm, friendly', 'en-US'),
  voice('xai/tts-1', 'leo', 'Leo', 'Authoritative, strong', 'en-US'),
  voice('xai/tts-1', 'sal', 'Sal', 'Smooth, balanced', 'en-US'),
  voice('xai/tts-1', 'carina', 'Carina', 'Soft, empathetic', 'en-US'),
  voice('xai/tts-1', 'rigel', 'Rigel', 'Precise, professional', 'en-US'),
  voice('xai/tts-1', 'naksh', 'Naksh', 'Warm, thoughtful', 'en-US'),
];

/**
 * A voice from Cartesia's public library, pasted by the owner as a UUID. The
 * only model whose full library LiveKit Inference exposes without a key, which
 * is why it is the only custom form accepted.
 */
export const CUSTOM_CARTESIA_VOICE_REGEX =
  /^cartesia\/sonic-3:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface CatalogPipeline {
  id: PipelineKind;
  label: string;
  description: string;
  available: boolean;
  /** Why an owner cannot pick it yet; `null` when available. */
  reason: string | null;
}

export const PIPELINES: readonly CatalogPipeline[] = [
  {
    id: PipelineKind.STT_LLM_TTS,
    label: 'Speech → text → speech',
    description:
      'Three specialised models. The agent puts the right slide on screen before it speaks, and every word is on record.',
    available: true,
    reason: null,
  },
  {
    id: PipelineKind.HALF_CASCADE,
    label: 'Realtime understanding, chosen voice',
    description:
      'A speech-native model hears tone and emphasis; your chosen voice still speaks the reply.',
    available: false,
    reason:
      'Realtime models are not part of LiveKit Inference — they need a provider account and key that Portvilla does not hold yet.',
  },
  {
    id: PipelineKind.REALTIME,
    label: 'Realtime speech-to-speech',
    description:
      'One model listens and speaks, with the lowest possible delay.',
    available: false,
    reason:
      'Needs a provider key, and cannot put a slide on screen before it talks — the agent would narrate to a blank screen.',
  },
];

export interface CatalogAvatar {
  available: boolean;
  reason: string;
}

export const AVATAR: CatalogAvatar = {
  available: false,
  reason:
    'Video avatars (Anam, Tavus, Beyond Presence and others) need a provider account. The orb is the agent’s face for now.',
};

// ─── Presets ──────────────────────────────────────────────────────────────────

/**
 * A ready-made stack the owner picks by name. The engine details stay here;
 * the catalog endpoint serves only `id`, `label`, `tagline` and the language.
 * Decision: docs/decisions/2026-09-13-agent-stack-presets.md
 */
export interface CatalogPreset {
  id: string;
  label: string;
  /** Owner-facing character line — what it sounds like, not what it runs on. */
  tagline: string;
  stack: Omit<AgentStackSection, 'preset'>;
}

/** What the dashboard sees of a preset. */
export interface CatalogPresetSummary {
  id: string;
  label: string;
  tagline: string;
  /** Catalog language code the preview clip is spoken in. */
  language: string;
}

const ENGLISH_MULTI = {
  primary: 'en',
  listen: ListenMode.MULTILINGUAL,
  reply: ReplyLanguage.PRIMARY,
} as const;

const preset = (
  id: string,
  label: string,
  tagline: string,
  voiceDescriptor: string,
  patience: TurnPatience,
): CatalogPreset => ({
  id,
  label,
  tagline,
  stack: {
    pipeline: PipelineKind.STT_LLM_TTS,
    language: { ...ENGLISH_MULTI },
    stt: { model: 'deepgram/nova-3', keyterms: [] },
    llm: { model: 'openai/gpt-4o-mini' },
    tts: { voice: voiceDescriptor, speed: AgentSpeakingSpeed.NORMAL },
    turnTaking: { allowInterruptions: true, patience },
  },
});

const voiceByLabel = (label: string): string =>
  VOICES.find((v) => v.label === label)!.descriptor;

export const PRESETS: readonly CatalogPreset[] = [
  preset(
    'confident',
    'Confident guide',
    'Clear and self-assured — keeps answers tight and moves the conversation along.',
    voiceByLabel('Jacqueline'),
    TurnPatience.BALANCED,
  ),
  preset(
    'energetic',
    'Energetic pitch',
    'Bright and quick — the voice of a founder excited about what they built.',
    voiceByLabel('Blake'),
    TurnPatience.QUICK,
  ),
  preset(
    'warm',
    'Warm host',
    'Natural and unhurried — gives visitors room to think and ask again.',
    voiceByLabel('Ashley'),
    TurnPatience.PATIENT,
  ),
  preset(
    'calm',
    'Calm professional',
    'Measured and composed — the tone of a good account manager.',
    voiceByLabel('Odysseus'),
    TurnPatience.BALANCED,
  ),
];

export const findPreset = (id: string): CatalogPreset | undefined =>
  PRESETS.find((p) => p.id === id);

export const presetSummaries = (): CatalogPresetSummary[] =>
  PRESETS.map(({ id, label, tagline, stack }) => ({
    id,
    label,
    tagline,
    language: stack.language.primary,
  }));

/**
 * Where every new profile starts, and what the worker falls back to. It *is*
 * the first preset, so a fresh owner is in ready-made mode from day one.
 */
export const DEFAULT_AGENT_STACK: Readonly<AgentStackSection> = {
  preset: PRESETS[0].id,
  ...PRESETS[0].stack,
};

/** A fresh, mutable copy of the default — Mongoose and the service both mutate what they are given. */
export const defaultAgentStack = (): AgentStackSection =>
  structuredClone(DEFAULT_AGENT_STACK);

// ─── Lookups ──────────────────────────────────────────────────────────────────

export const findLanguage = (code: string): CatalogLanguage | undefined =>
  LANGUAGES.find((l) => l.code === code);

export const findSttModel = (id: string): CatalogSttModel | undefined =>
  STT_MODELS.find((m) => m.id === id);

export const findLlmModel = (id: string): CatalogLlmModel | undefined =>
  LLM_MODELS.find((m) => m.id === id);

export const findTtsModel = (id: string): CatalogTtsModel | undefined =>
  TTS_MODELS.find((m) => m.id === id);

/** Splits `"<model>:<voiceId>"`; `null` when the shape is wrong. */
export function parseVoiceDescriptor(
  descriptor: string,
): { model: string; voiceId: string } | null {
  const at = descriptor.indexOf(':');
  if (at <= 0 || at === descriptor.length - 1) return null;
  return { model: descriptor.slice(0, at), voiceId: descriptor.slice(at + 1) };
}

/** A catalog voice, or a well-formed custom Cartesia voice. */
export const isKnownVoice = (descriptor: string): boolean =>
  VOICES.some((v) => v.descriptor === descriptor) ||
  CUSTOM_CARTESIA_VOICE_REGEX.test(descriptor);

export const sttSpeaks = (model: CatalogSttModel, code: string): boolean =>
  model.languages === null || model.languages.includes(code);
