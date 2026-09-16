import {
  AgentSpeakingSpeed,
  ListenMode,
  PipelineKind,
  ReplyLanguage,
  TurnPatience,
  type AgentStackSection,
} from '../profile.interface';

import { DEFAULT_AGENT_STACK, PRESETS, VOICES } from './catalog';
import {
  MAX_KEYTERMS,
  deriveKeyterms,
  mergeAgentStack,
  resolveAgentStack,
  validateAgentStack,
} from './agent-stack.rules';

const sources = {
  ownerName: 'Jane Doe',
  agentName: 'Alex',
  workNames: ['Atlas'],
};

function aStack(overrides: Partial<AgentStackSection> = {}): AgentStackSection {
  return mergeAgentStack(DEFAULT_AGENT_STACK, overrides);
}

describe('mergeAgentStack', () => {
  it('changes only what the patch names', () => {
    const merged = mergeAgentStack(DEFAULT_AGENT_STACK, {
      language: { primary: 'hi' },
      tts: { speed: AgentSpeakingSpeed.FAST },
    });
    expect(merged.language).toEqual({
      ...DEFAULT_AGENT_STACK.language,
      primary: 'hi',
    });
    expect(merged.tts).toEqual({
      ...DEFAULT_AGENT_STACK.tts,
      speed: AgentSpeakingSpeed.FAST,
    });
    expect(merged.stt).toEqual(DEFAULT_AGENT_STACK.stt);
  });

  it('replaces keyterms rather than appending', () => {
    const current = aStack({
      stt: { model: 'deepgram/nova-3', keyterms: ['old'] },
    });
    expect(
      mergeAgentStack(current, { stt: { keyterms: ['new'] } }).stt.keyterms,
    ).toEqual(['new']);
  });
});

describe('mergeAgentStack — presets', () => {
  const warm = PRESETS.find((p) => p.id === 'warm')!;

  it('every preset is a valid stack on its own', () => {
    for (const p of PRESETS) {
      expect(validateAgentStack({ preset: p.id, ...p.stack })).toEqual([]);
    }
  });

  it('applying a preset copies its engine and records the id', () => {
    const merged = mergeAgentStack(DEFAULT_AGENT_STACK, { preset: 'warm' });
    expect(merged.preset).toBe('warm');
    expect(merged.tts.voice).toBe(warm.stack.tts.voice);
    expect(merged.turnTaking).toEqual(warm.stack.turnTaking);
  });

  it('keeps the owner language and keyterms when the preset can speak it', () => {
    const current = aStack({
      language: { ...DEFAULT_AGENT_STACK.language, primary: 'hi' },
      stt: { model: 'deepgram/nova-3', keyterms: ['Atlas'] },
    });
    const merged = mergeAgentStack(current, { preset: 'warm' });
    expect(merged.language.primary).toBe('hi');
    expect(merged.stt.keyterms).toEqual(['Atlas']);
    expect(validateAgentStack(merged)).toEqual([]);
  });

  it('falls back to the preset language when its voice cannot speak the owner’s', () => {
    // "calm" uses Deepgram Aura 2, which does not speak Hindi.
    const current = aStack({
      language: { ...DEFAULT_AGENT_STACK.language, primary: 'hi' },
    });
    const merged = mergeAgentStack(current, { preset: 'calm' });
    expect(merged.preset).toBe('calm');
    expect(merged.language.primary).toBe('en');
    expect(validateAgentStack(merged)).toEqual([]);
  });

  it('an engine edit leaves the preset; a language edit keeps it', () => {
    const onPreset = mergeAgentStack(DEFAULT_AGENT_STACK, { preset: 'warm' });
    expect(
      mergeAgentStack(onPreset, { tts: { speed: AgentSpeakingSpeed.FAST } })
        .preset,
    ).toBeNull();
    expect(
      mergeAgentStack(onPreset, { language: { primary: 'es' } }).preset,
    ).toBe('warm');
  });

  it('preset: null detaches without touching the values', () => {
    const onPreset = mergeAgentStack(DEFAULT_AGENT_STACK, { preset: 'warm' });
    const detached = mergeAgentStack(onPreset, { preset: null });
    expect(detached).toEqual({ ...onPreset, preset: null });
  });

  it('an unknown preset id is reported by validation, not silently ignored', () => {
    const merged = mergeAgentStack(DEFAULT_AGENT_STACK, { preset: 'nope' });
    expect(validateAgentStack(merged)).toEqual(
      expect.arrayContaining([expect.stringContaining('"nope"')]),
    );
  });
});

describe('validateAgentStack', () => {
  it('accepts the default stack for every catalog language', () => {
    for (const code of ['en', 'hi', 'ta', 'ja', 'ar']) {
      expect(
        validateAgentStack(
          aStack({
            language: { ...DEFAULT_AGENT_STACK.language, primary: code },
          }),
        ),
      ).toEqual([]);
    }
  });

  it('rejects unknown ids with one problem each', () => {
    const problems = validateAgentStack(
      aStack({
        stt: { model: 'nope/stt', keyterms: [] },
        llm: { model: 'nope/llm' },
        tts: { voice: 'nope/tts:x', speed: AgentSpeakingSpeed.NORMAL },
      }),
    );
    expect(problems).toHaveLength(3);
  });

  it('rejects a pipeline kind that is not shipped', () => {
    expect(
      validateAgentStack(aStack({ pipeline: PipelineKind.REALTIME })),
    ).toHaveLength(1);
  });

  it('rejects a primary language the listening model cannot hear', () => {
    const problems = validateAgentStack(
      aStack({
        language: {
          primary: 'hi',
          listen: ListenMode.PRIMARY,
          reply: ReplyLanguage.PRIMARY,
        },
        stt: { model: 'deepgram/flux-general-en', keyterms: [] },
      }),
    );
    expect(problems).toEqual([
      expect.stringContaining('does not understand Hindi'),
    ]);
  });

  it('rejects a primary language the voice cannot speak', () => {
    const aura = VOICES.find((v) =>
      v.descriptor.startsWith('deepgram/aura-2'),
    )!;
    const problems = validateAgentStack(
      aStack({
        language: {
          primary: 'hi',
          listen: ListenMode.MULTILINGUAL,
          reply: ReplyLanguage.PRIMARY,
        },
        tts: { voice: aura.descriptor, speed: AgentSpeakingSpeed.NORMAL },
      }),
    );
    expect(problems).toEqual([expect.stringContaining('cannot speak Hindi')]);
  });

  it('requires a multilingual model for multilingual listening', () => {
    const problems = validateAgentStack(
      aStack({
        stt: { model: 'assemblyai/universal-streaming', keyterms: [] },
      }),
    );
    expect(problems).toEqual([
      expect.stringContaining('one language at a time'),
    ]);
  });

  it('requires multilingual listening to reply in the visitor’s language', () => {
    const problems = validateAgentStack(
      aStack({
        language: {
          primary: 'en',
          listen: ListenMode.PRIMARY,
          reply: ReplyLanguage.MATCH_VISITOR,
        },
      }),
    );
    expect(problems).toEqual([
      expect.stringContaining('multilingual listening'),
    ]);
  });

  it('accepts a custom Cartesia library voice', () => {
    const custom = 'cartesia/sonic-3:00000000-1111-2222-3333-444444444444';
    expect(
      validateAgentStack(
        aStack({ tts: { voice: custom, speed: AgentSpeakingSpeed.SLOW } }),
      ),
    ).toEqual([]);
  });
});

describe('deriveKeyterms', () => {
  it('puts owner terms first, adds the names, dedupes case-insensitively', () => {
    expect(deriveKeyterms(['Kubernetes', 'atlas'], sources)).toEqual([
      'Kubernetes',
      'atlas',
      'Jane Doe',
      'Alex',
    ]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 100 }, (_, i) => `term${i}`);
    expect(deriveKeyterms(many, sources)).toHaveLength(MAX_KEYTERMS);
  });
});

describe('resolveAgentStack', () => {
  it('resolves the default stack to what the worker ran on before this existed', () => {
    const resolved = resolveAgentStack(DEFAULT_AGENT_STACK, sources);
    expect(resolved.stt).toEqual({
      model: 'deepgram/nova-3',
      language: 'multi',
      keyterms: ['Jane Doe', 'Alex', 'Atlas'],
    });
    expect(resolved.llm).toEqual({ model: 'openai/gpt-4o-mini' });
    expect(resolved.tts).toEqual({
      model: 'cartesia/sonic-3',
      voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      language: 'en',
      speed: AgentSpeakingSpeed.NORMAL,
    });
    expect(resolved.turnTaking).toEqual({
      detection: 'model',
      allowInterruptions: true,
      minEndpointingDelay: 0.5,
      maxEndpointingDelay: 3.0,
    });
  });

  it('pins one language when listening is primary-only', () => {
    const resolved = resolveAgentStack(
      aStack({
        language: {
          primary: 'hi',
          listen: ListenMode.PRIMARY,
          reply: ReplyLanguage.PRIMARY,
        },
      }),
      sources,
    );
    expect(resolved.stt.language).toBe('hi');
    expect(resolved.tts.language).toBe('hi');
    expect(resolved.language.label).toBe('Hindi');
  });

  it('leaves the TTS language open when replies follow the visitor', () => {
    const resolved = resolveAgentStack(
      aStack({
        language: {
          primary: 'en',
          listen: ListenMode.MULTILINGUAL,
          reply: ReplyLanguage.MATCH_VISITOR,
        },
      }),
      sources,
    );
    expect(resolved.tts.language).toBeNull();
  });

  it('defers turn detection to Deepgram Flux and drops keyterms for models without them', () => {
    const flux = resolveAgentStack(
      aStack({
        stt: { model: 'deepgram/flux-general-multi', keyterms: ['x'] },
      }),
      sources,
    );
    expect(flux.turnTaking.detection).toBe('stt');
    expect(flux.stt.keyterms[0]).toBe('x');

    const whisper = resolveAgentStack(
      aStack({
        language: {
          primary: 'en',
          listen: ListenMode.PRIMARY,
          reply: ReplyLanguage.PRIMARY,
        },
        stt: { model: 'cartesia/ink-whisper', keyterms: ['x'] },
      }),
      sources,
    );
    expect(whisper.stt.keyterms).toEqual([]);
  });

  it('drops speed for a voice whose model has no speed control', () => {
    const inworld = VOICES.find((v) => v.descriptor.startsWith('inworld/'))!;
    const resolved = resolveAgentStack(
      aStack({
        tts: { voice: inworld.descriptor, speed: AgentSpeakingSpeed.FAST },
      }),
      sources,
    );
    expect(resolved.tts).toEqual({
      model: 'inworld/inworld-tts-2',
      voice: inworld.label,
      language: 'en',
      speed: null,
    });
  });

  it('falls back to defaults for ids the catalog no longer knows', () => {
    const resolved = resolveAgentStack(
      aStack({
        stt: { model: 'retired/model', keyterms: [] },
        llm: { model: 'retired/llm' },
        tts: { voice: 'retired/tts:v', speed: AgentSpeakingSpeed.NORMAL },
        turnTaking: {
          allowInterruptions: false,
          patience: 'weird' as TurnPatience,
        },
      }),
      sources,
    );
    expect(resolved.stt.model).toBe(DEFAULT_AGENT_STACK.stt.model);
    expect(resolved.llm.model).toBe(DEFAULT_AGENT_STACK.llm.model);
    expect(resolved.tts.model).toBe('cartesia/sonic-3');
    expect(resolved.turnTaking).toMatchObject({
      allowInterruptions: false,
      minEndpointingDelay: 0.5,
    });
  });
});
