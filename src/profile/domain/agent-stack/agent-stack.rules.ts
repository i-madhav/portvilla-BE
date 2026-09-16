import {
  AgentSpeakingSpeed,
  ListenMode,
  PipelineKind,
  ReplyLanguage,
  TurnPatience,
  type AgentStackSection,
} from '../profile.interface';

import {
  DEFAULT_AGENT_STACK,
  findLanguage,
  findPreset,
  findLlmModel,
  findSttModel,
  findTtsModel,
  isKnownVoice,
  parseVoiceDescriptor,
  sttSpeaks,
  type TurnDetectionKind,
} from './catalog';

// ─────────────────────────────────────────────────────────────────────────────
// Pure rules over an agent stack: merge a partial update, validate the whole,
// and resolve it into what the worker needs. No I/O, no Nest — the service and
// the agent-context DTO call these, and the spec beside this file pins them.
// ─────────────────────────────────────────────────────────────────────────────

/** A PATCH body: every group optional, every field inside it optional. */
export type AgentStackPatch = {
  [G in keyof AgentStackSection]?: AgentStackSection[G] extends object
    ? Partial<AgentStackSection[G]>
    : AgentStackSection[G];
};

/** The groups that make a stack "the engine" — touching any of them leaves a preset. */
const ENGINE_GROUPS = ['pipeline', 'stt', 'llm', 'tts', 'turnTaking'] as const;

const touchesEngine = (patch: AgentStackPatch): boolean =>
  ENGINE_GROUPS.some((g) => patch[g] !== undefined);

/**
 * Applies a partial update over the stored section, two levels deep. Arrays
 * (`keyterms`) are replaced, not appended — the client sends the list it wants.
 *
 * `preset` decides the mode (2026-09-13-agent-stack-presets):
 * - a preset id applies that preset wholesale, keeping the owner's primary
 *   language and keyterms — those are owner facts, not engine choices;
 * - `null` detaches: values stay, mode becomes custom;
 * - an engine-group patch clears the preset; a language-only patch keeps it.
 */
export function mergeAgentStack(
  current: AgentStackSection,
  patch: AgentStackPatch,
): AgentStackSection {
  if (typeof patch.preset === 'string') {
    const chosen = findPreset(patch.preset);
    if (chosen) return applyPreset(current, chosen.id, chosen.stack);
    // Unknown id: fall through so validation reports it rather than silently
    // keeping the old stack.
  }

  const preset =
    patch.preset === null || touchesEngine(patch)
      ? null
      : (patch.preset ?? current.preset);

  return {
    preset,
    pipeline: patch.pipeline ?? current.pipeline,
    language: { ...current.language, ...patch.language },
    stt: { ...current.stt, ...patch.stt },
    llm: { ...current.llm, ...patch.llm },
    tts: { ...current.tts, ...patch.tts },
    turnTaking: { ...current.turnTaking, ...patch.turnTaking },
  };
}

/**
 * A preset's engine on top of the owner's own facts. If the preset's models
 * cannot speak the owner's language the preset's language wins — a preset must
 * always produce a valid stack, or picking one by name would be a trap.
 */
function applyPreset(
  current: AgentStackSection,
  id: string,
  stack: Omit<AgentStackSection, 'preset'>,
): AgentStackSection {
  const keepingLanguage: AgentStackSection = {
    preset: id,
    ...stack,
    language: { ...stack.language, primary: current.language.primary },
    stt: { ...stack.stt, keyterms: [...current.stt.keyterms] },
  };
  if (validateAgentStack(keepingLanguage).length === 0) return keepingLanguage;
  return {
    preset: id,
    ...stack,
    stt: { ...stack.stt, keyterms: [...current.stt.keyterms] },
  };
}

/**
 * Every problem with a stack, in owner-readable sentences. Empty means valid.
 *
 * Membership checks repeat what the DTO decorators enforce so that a stack from
 * *any* source — a stored document written before a model was retired, a
 * script — is judged by the same rules as a request.
 */
export function validateAgentStack(stack: AgentStackSection): string[] {
  const problems: string[] = [];

  if (stack.preset !== null && !findPreset(stack.preset)) {
    problems.push(`"${stack.preset}" is not an available preset.`);
  }

  if (stack.pipeline !== PipelineKind.STT_LLM_TTS) {
    problems.push(
      `The "${stack.pipeline}" pipeline is not available yet. Only "${PipelineKind.STT_LLM_TTS}" can be selected.`,
    );
  }

  const language = findLanguage(stack.language.primary);
  if (!language) {
    problems.push(
      `"${stack.language.primary}" is not a supported primary language.`,
    );
  }

  const stt = findSttModel(stack.stt.model);
  if (!stt) {
    problems.push(`"${stack.stt.model}" is not an available listening model.`);
  } else if (language && !sttSpeaks(stt, language.code)) {
    problems.push(`${stt.label} does not understand ${language.label}.`);
  }
  if (
    stt &&
    stack.language.listen === ListenMode.MULTILINGUAL &&
    !stt.multilingual
  ) {
    problems.push(
      `${stt.label} listens for one language at a time. Pick a multilingual model, or set listening to the primary language only.`,
    );
  }
  if (
    stack.language.reply === ReplyLanguage.MATCH_VISITOR &&
    stack.language.listen !== ListenMode.MULTILINGUAL
  ) {
    problems.push(
      'Replying in the visitor’s language needs multilingual listening, otherwise the agent cannot tell what they spoke.',
    );
  }

  if (!findLlmModel(stack.llm.model)) {
    problems.push(`"${stack.llm.model}" is not an available thinking model.`);
  }

  const parsed = parseVoiceDescriptor(stack.tts.voice);
  const ttsModel = parsed ? findTtsModel(parsed.model) : undefined;
  if (!parsed || !ttsModel || !isKnownVoice(stack.tts.voice)) {
    problems.push(`"${stack.tts.voice}" is not an available voice.`);
  } else if (language && !ttsModel.languages.includes(language.code)) {
    problems.push(`${ttsModel.label} voices cannot speak ${language.label}.`);
  }

  return problems;
}

// ─── Resolution: the shape the worker receives ────────────────────────────────

/** Seconds of silence before the agent takes its turn, per patience level. */
export const PATIENCE_DELAYS: Record<
  TurnPatience,
  { minDelay: number; maxDelay: number }
> = {
  [TurnPatience.QUICK]: { minDelay: 0.3, maxDelay: 2.0 },
  [TurnPatience.BALANCED]: { minDelay: 0.5, maxDelay: 3.0 },
  [TurnPatience.PATIENT]: { minDelay: 0.8, maxDelay: 4.0 },
};

/** Upper bound on keyterms sent to STT — Deepgram degrades past a few dozen. */
export const MAX_KEYTERMS = 40;

/**
 * What the worker builds its pipeline from. Concrete and already decided:
 * the worker does no catalog lookups and applies no policy of its own.
 */
export interface ResolvedLanguage {
  primary: string;
  /** Human label, so the prompt can say "answer in Hindi" without a table of its own. */
  label: string;
  reply: ReplyLanguage;
}

export interface ResolvedStt {
  model: string;
  /** A language code, or `multi`. */
  language: string;
  /** Empty when the model takes no keyterms. */
  keyterms: string[];
}

export interface ResolvedLlm {
  model: string;
}

export interface ResolvedTts {
  model: string;
  voice: string;
  /** Pinned for `primary` replies; `null` lets the voice follow whatever the LLM wrote. */
  language: string | null;
  /** `null` when the model has no speed control. */
  speed: AgentSpeakingSpeed | null;
}

export interface ResolvedTurnTaking {
  detection: TurnDetectionKind;
  allowInterruptions: boolean;
  minEndpointingDelay: number;
  maxEndpointingDelay: number;
}

export interface ResolvedAgentStack {
  language: ResolvedLanguage;
  stt: ResolvedStt;
  llm: ResolvedLlm;
  tts: ResolvedTts;
  turnTaking: ResolvedTurnTaking;
}

/** The profile facts that become recognition keyterms. */
export interface KeytermSources {
  ownerName: string;
  agentName: string;
  workNames: string[];
}

/**
 * Owner terms first, then the names a visitor is most likely to say and STT
 * most likely to mangle. Case-insensitive dedupe, capped.
 */
export function deriveKeyterms(
  own: string[],
  sources: KeytermSources,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [
    ...own,
    sources.ownerName,
    sources.agentName,
    ...sources.workNames,
  ]) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length === MAX_KEYTERMS) break;
  }
  return out;
}

/**
 * Resolves a *valid* stack. Anything unknown falls back to the default for that
 * component rather than throwing — this runs at room join, where a stored id
 * retired since the profile was saved must cost the owner a log line, not the
 * visitor a session.
 */
export function resolveAgentStack(
  stack: AgentStackSection,
  sources: KeytermSources,
): ResolvedAgentStack {
  const language =
    findLanguage(stack.language.primary) ??
    findLanguage(DEFAULT_AGENT_STACK.language.primary)!;
  const stt =
    findSttModel(stack.stt.model) ??
    findSttModel(DEFAULT_AGENT_STACK.stt.model)!;
  const llm =
    findLlmModel(stack.llm.model) ??
    findLlmModel(DEFAULT_AGENT_STACK.llm.model)!;

  const voiceDescriptor = isKnownVoice(stack.tts.voice)
    ? stack.tts.voice
    : DEFAULT_AGENT_STACK.tts.voice;
  const parsedVoice = parseVoiceDescriptor(voiceDescriptor)!;
  const ttsModel =
    findTtsModel(parsedVoice.model) ??
    findTtsModel(parseVoiceDescriptor(DEFAULT_AGENT_STACK.tts.voice)!.model)!;

  const multilingual =
    stack.language.listen === ListenMode.MULTILINGUAL && stt.multilingual;
  const delays =
    PATIENCE_DELAYS[stack.turnTaking.patience] ??
    PATIENCE_DELAYS[TurnPatience.BALANCED];

  return {
    language: {
      primary: language.code,
      label: language.label,
      reply: stack.language.reply,
    },
    stt: {
      model: stt.id,
      language: multilingual ? 'multi' : language.code,
      keyterms: stt.keyterms ? deriveKeyterms(stack.stt.keyterms, sources) : [],
    },
    llm: { model: llm.id },
    tts: {
      model: ttsModel.id,
      voice: parsedVoice.voiceId,
      language:
        stack.language.reply === ReplyLanguage.MATCH_VISITOR
          ? null
          : language.code,
      speed: ttsModel.speedControl ? stack.tts.speed : null,
    },
    turnTaking: {
      detection: stt.turnDetection,
      allowInterruptions: stack.turnTaking.allowInterruptions,
      minEndpointingDelay: delays.minDelay,
      maxEndpointingDelay: delays.maxDelay,
    },
  };
}
