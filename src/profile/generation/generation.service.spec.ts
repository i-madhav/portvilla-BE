import { ConfigService } from '@nestjs/config';

import type { IJsonCompleter, JsonCompletion } from '../../llm/llm.service';
import type { LlmCompleteOptions } from '../../llm/i-llm-provider';
import type { AiSettingsSection } from '../domain/profile.interface';
import {
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  EntityType,
  LlmProvider,
  ProfileVisibility,
} from '../domain/profile.interface';
import type { IProfileRecord } from '../domain/profile.interface';
import { defaultAgentStack } from '../domain/agent-stack/catalog';

import { GenerationFailedError, GenerationService } from './generation.service';
import { GENERATED_SECTIONS } from './generation.types';
import type { GeneratedSection } from './generation.types';

// ─── The fake ─────────────────────────────────────────────────────────────────

interface RecordedCall {
  system: string;
  user: string;
  options?: LlmCompleteOptions;
}

/**
 * Scripted by the `# section:` marker every Pass B prompt carries on its first
 * user line — the marker exists for exactly this. Pass A is the call with no
 * marker at all.
 *
 * A fake at the completer seam rather than at the provider: `GenerationService`
 * depends on `IJsonCompleter`, so this needs no network, no Nest testing module
 * and no cast.
 */
class FakeCompleter implements IJsonCompleter {
  readonly calls: RecordedCall[] = [];

  constructor(
    private readonly script: {
      brief?: unknown;
      sections?: Partial<Record<GeneratedSection, unknown>>;
      /** Sections whose call rejects outright — a dropped socket, not a refusal. */
      rejects?: GeneratedSection[];
    },
  ) {}

  completeJson(
    system: string,
    user: string,
    _settings: AiSettingsSection,
    options?: LlmCompleteOptions,
  ): Promise<JsonCompletion> {
    this.calls.push({ system, user, options });

    const marker = user.match(/^# section: (\w+)$/m)?.[1] as
      | GeneratedSection
      | undefined;

    if (marker && this.script.rejects?.includes(marker)) {
      return Promise.reject(new Error('socket hang up'));
    }

    // `in`, not `??`: a section scripted as `null` is the "this call came back
    // with nothing" case, and `??` would quietly turn it into an empty section.
    const sections = this.script.sections ?? {};
    const value = marker
      ? marker in sections
        ? sections[marker]
        : { entries: [] }
      : (this.script.brief ?? null);

    return Promise.resolve({
      value,
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DESCRIPTION =
  'Portvilla turns a portfolio into a voice agent. It launched in 2026 and ' +
  'serves 120 voice minutes a month. The source is at https://github.com/portvilla.';

function aFactSheet(
  include: GeneratedSection[] = ['capabilities', 'metrics'],
): unknown {
  return {
    summary: 'A voice agent for portfolios.',
    audience: 'developers',
    language: 'en',
    facts: [{ id: 'f1', kind: 'date', text: '2026', source: 'It launched…' }],
    sections: Object.fromEntries(
      GENERATED_SECTIONS.map((section) => [
        section,
        { include: include.includes(section), reason: 'because' },
      ]),
    ),
  };
}

function aRecord(): IProfileRecord {
  return {
    id: 'profile-id',
    userId: 'user-id',
    username: 'portvilla',
    visibility: ProfileVisibility.PUBLIC,
    identity: {
      entityType: EntityType.PRODUCT,
      name: 'Portvilla',
      tagline: null,
      bio: null,
      about: null,
      primaryImage: null,
      coverImage: null,
      location: null,
      foundedOrBorn: null,
      industry: null,
      availability: null,
      resume: { url: null, parsedText: null },
    },
    works: [],
    timeline: [],
    capabilities: [],
    offerings: [],
    metrics: [],
    testimonials: [],
    team: [],
    media: [],
    content: [],
    social: { links: [], email: null, phone: null, calendarUrl: null },
    brief: { text: null },
    aiSettings: {
      provider: LlmProvider.OPENAI,
      apiKey: null,
      model: null,
      baseUrl: null,
    },
    agentPersona: {
      agentName: 'Ada',
      tone: AgentTone.BALANCED,
      verbosity: AgentVerbosity.CONCISE,
      technicalDepth: AgentTechnicalDepth.MEDIUM,
    },
    agentStack: defaultAgentStack(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

const configured = () =>
  new ConfigService({
    PLATFORM_LLM_API_KEY: 'test-key',
    PLATFORM_LLM_PROVIDER: 'anthropic',
  });

const serviceWith = (fake: FakeCompleter, config = configured()) =>
  new GenerationService(fake, config);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GenerationService', () => {
  describe('the call pattern', () => {
    it('reads the description once, then fans out over the planned sections', async () => {
      const fake = new FakeCompleter({ brief: aFactSheet() });
      await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      expect(fake.calls).toHaveLength(3);
      expect(fake.calls[0].user).not.toContain('# section:');
      expect(
        fake.calls.slice(1).map((c) => c.user.match(/# section: (\w+)/)?.[1]),
      ).toEqual(['capabilities', 'metrics']);
    });

    it('never calls a section the fact sheet excluded', async () => {
      const fake = new FakeCompleter({ brief: aFactSheet(['works']) });
      await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      expect(fake.calls).toHaveLength(2);
      expect(fake.calls[1].user).toContain('# section: works');
    });

    it('reads carefully once and writes cheaply after', async () => {
      const fake = new FakeCompleter({ brief: aFactSheet() });
      await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      expect(fake.calls[0].options?.effort).toBe('high');
      expect(fake.calls[1].options?.effort).toBe('medium');
      expect(fake.calls[1].options?.maxTokens).toBeGreaterThan(0);
    });

    it('sends one byte-identical prefix to every fan-out call', async () => {
      // Phase 9 turns prompt caching on and checks `cache_read_input_tokens`.
      // A prefix that differs per section can never be a cache hit.
      const fake = new FakeCompleter({
        brief: aFactSheet(['capabilities', 'metrics', 'works']),
      });
      await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      const prefixes = new Set(fake.calls.slice(1).map((c) => c.system));
      expect(prefixes.size).toBe(1);
      expect([...prefixes][0]).toContain(DESCRIPTION);
    });

    it('tells each generator what this entity kind means by that section', async () => {
      const fake = new FakeCompleter({ brief: aFactSheet(['capabilities']) });
      await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      // The fixture is a product, so capabilities are its features.
      expect(fake.calls[1].user).toContain('features');
    });
  });

  describe('when a section fails', () => {
    it('marks it failed, warns, and still returns the rest', async () => {
      const fake = new FakeCompleter({
        brief: aFactSheet(['capabilities', 'metrics']),
        sections: {
          capabilities: null,
          metrics: { entries: [{ value: '120', label: 'Voice minutes' }] },
        },
      });

      const result = await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      expect(result.sections.capabilities).toBe('failed');
      expect(result.sections.metrics).toBe('generated');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          section: 'capabilities',
          code: 'SECTION_FAILED',
        }),
      );
      expect(result.draft.metrics).toHaveLength(1);
    });

    it('survives a call that throws outright', async () => {
      // `Promise.allSettled`, not `all`: one dropped socket must not take the
      // other sections with it.
      const fake = new FakeCompleter({
        brief: aFactSheet(['capabilities', 'metrics']),
        sections: {
          metrics: { entries: [{ value: '120', label: 'Minutes' }] },
        },
        rejects: ['capabilities'],
      });

      const result = await serviceWith(fake).generate(aRecord(), DESCRIPTION);

      expect(result.sections.capabilities).toBe('failed');
      expect(result.sections.metrics).toBe('generated');
    });
  });

  describe('when the brief fails', () => {
    const rejects = async (fake: FakeCompleter) => {
      await expect(
        serviceWith(fake).generate(aRecord(), DESCRIPTION),
      ).rejects.toBeInstanceOf(GenerationFailedError);
    };

    it('fails the request when nothing came back', async () => {
      await rejects(new FakeCompleter({ brief: null }));
    });

    it('fails the request when the sheet carries no facts', async () => {
      // Without facts every generator is licensed to invent, which is the one
      // outcome worse than no draft at all.
      await rejects(new FakeCompleter({ brief: { facts: [] } }));
    });

    it('never fans out after a failed brief', async () => {
      const fake = new FakeCompleter({ brief: null });
      await expect(
        serviceWith(fake).generate(aRecord(), DESCRIPTION),
      ).rejects.toThrow();

      expect(fake.calls).toHaveLength(1);
    });

    it('fails before spending anything when no platform key is set', async () => {
      const fake = new FakeCompleter({ brief: aFactSheet() });
      await expect(
        serviceWith(fake, new ConfigService({})).generate(
          aRecord(),
          DESCRIPTION,
        ),
      ).rejects.toBeInstanceOf(GenerationFailedError);

      expect(fake.calls).toHaveLength(0);
    });
  });

  describe('usage', () => {
    it('adds up every call it made', async () => {
      const fake = new FakeCompleter({ brief: aFactSheet() });
      const { usage } = await serviceWith(fake).generate(
        aRecord(),
        DESCRIPTION,
      );

      expect(usage.calls).toBe(3);
      expect(usage.inputTokens).toBe(300);
      expect(usage.outputTokens).toBe(150);
      expect(usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('still counts a call that came back unusable', async () => {
      const fake = new FakeCompleter({
        brief: aFactSheet(['capabilities']),
        sections: { capabilities: null },
      });
      const { usage } = await serviceWith(fake).generate(
        aRecord(),
        DESCRIPTION,
      );

      expect(usage.calls).toBe(2);
    });
  });

  it('writes nothing to the record it was handed', async () => {
    const record = aRecord();
    const before = JSON.stringify(record);

    const fake = new FakeCompleter({
      brief: aFactSheet(['capabilities']),
      sections: { capabilities: { entries: [{ name: 'Voice' }] } },
    });
    await serviceWith(fake).generate(record, DESCRIPTION);

    expect(JSON.stringify(record)).toBe(before);
  });
});
