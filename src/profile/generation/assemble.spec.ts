import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UpdateProfileDto } from '../dto/update-profile.dto';
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
import { projectSlides } from '../domain/slide.projector';

import { applyDraft, assembleDraft, parseFactSheet } from './assemble';
import { GENERATED_SECTIONS } from './generation.types';
import type { GeneratedSection, SectionResult } from './generation.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Every grounding check reads this text, so everything a test expects to
 * survive has to be in here — which is the point: the description is the only
 * authority the workflow has.
 */
const DESCRIPTION = [
  'Portvilla turns a portfolio into a voice agent that speaks for its owner.',
  'It launched in 2026 and serves 120 voice minutes a month on the free plan.',
  'The Team plan is $29/mo. Priya Nair said "It put the right slide on screen',
  'before it finished the sentence." The source is at https://github.com/portvilla',
  'and the site is https://portvilla.in. Sam Reyes is the founder.',
].join(' ');

function result(section: GeneratedSection, entries: unknown[]): SectionResult {
  return { section, value: { entries } };
}

function draftFrom(...results: SectionResult[]) {
  return assembleDraft(DESCRIPTION, results);
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
    brief: { text: DESCRIPTION },
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

const aCapability = (name: string) => ({ name });
const aWork = (over: Record<string, unknown> = {}) => ({
  type: 'product',
  name: 'Narrative layer',
  description: 'Slides derived from the profile.',
  date: '2026-09',
  ...over,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseFactSheet', () => {
  const sheet = {
    summary: 'A voice agent for portfolios.',
    audience: 'developers',
    language: 'en',
    facts: [{ id: 'f1', kind: 'date', text: '2026', source: 'It launched…' }],
    sections: { capabilities: { include: true, reason: 'features listed' } },
  };

  it('reads a well-formed sheet', () => {
    const parsed = parseFactSheet(sheet);
    expect(parsed?.language).toBe('en');
    expect(parsed?.facts).toHaveLength(1);
    expect(parsed?.sections.capabilities).toEqual({
      include: true,
      reason: 'features listed',
    });
  });

  it('plans every section, so a forgotten one is simply not attempted', () => {
    const parsed = parseFactSheet(sheet);
    expect(Object.keys(parsed?.sections ?? {}).sort()).toEqual(
      [...GENERATED_SECTIONS].sort(),
    );
    expect(parsed?.sections.metrics.include).toBe(false);
  });

  it('rejects a sheet with no facts — it would licence pure invention', () => {
    expect(parseFactSheet({ ...sheet, facts: [] })).toBeNull();
    expect(parseFactSheet({ ...sheet, facts: 'lots' })).toBeNull();
  });

  it('rejects anything that is not an object', () => {
    expect(parseFactSheet(null)).toBeNull();
    expect(parseFactSheet('{"facts":[]}')).toBeNull();
    expect(parseFactSheet([sheet])).toBeNull();
  });

  it('falls back to a claim for a fact kind it does not know', () => {
    const parsed = parseFactSheet({
      ...sheet,
      facts: [{ id: 'f1', kind: 'vibe', text: 'fast', source: 's' }],
    });
    expect(parsed?.facts[0].kind).toBe('claim');
  });
});

describe('assembleDraft', () => {
  describe('validation', () => {
    it('drops the invalid entry, not the section around it', () => {
      const { draft, warnings } = draftFrom(
        result('capabilities', [
          aCapability('Voice pipeline'),
          { description: 'no name at all' },
          aCapability('Slide projector'),
        ]),
      );

      expect(draft.capabilities?.map((c) => c.name)).toEqual([
        'Voice pipeline',
        'Slide projector',
      ]);
      expect(warnings).toContainEqual(
        expect.objectContaining({
          section: 'capabilities',
          code: 'INVALID_ENTRY',
        }),
      );
    });

    it('rejects a value outside an enum', () => {
      const { draft, warnings } = draftFrom(
        result('capabilities', [
          { name: 'TypeScript', proficiency: 'legendary' },
        ]),
      );

      expect(draft.capabilities).toBeUndefined();
      expect(warnings[0].code).toBe('INVALID_ENTRY');
    });

    it('strips a key the model minted — the repository owns those', () => {
      const { draft } = draftFrom(
        result('capabilities', [{ key: 'FAKEKEY1', name: 'TypeScript' }]),
      );
      // The DTO declares `key`, so `plainToInstance` materialises it; what
      // matters is that the model's value did not survive onto it.
      expect(draft.capabilities?.[0].key).toBeUndefined();
    });

    it('strips a field no DTO claims', () => {
      const { draft } = draftFrom(
        result('capabilities', [
          { name: 'TypeScript', confidence: 0.9, sourceFactIds: ['f1'] },
        ]),
      );
      const entry = draft.capabilities?.[0] ?? {};
      expect(entry).not.toHaveProperty('confidence');
      expect(entry).not.toHaveProperty('sourceFactIds');
    });
  });

  describe('grounding', () => {
    it('drops an entry linking somewhere the description never mentions', () => {
      const { draft, warnings } = draftFrom(
        result('content', [
          {
            type: 'blog',
            title: 'Invented post',
            url: 'https://example.com/made-up',
          },
        ]),
      );

      expect(draft.content).toBeUndefined();
      expect(warnings[0].code).toBe('UNGROUNDED_URL');
    });

    it('keeps an entry whose URL is in the description', () => {
      const { draft } = draftFrom(
        result('works', [
          aWork({ repoUrl: 'https://github.com/portvilla', name: 'Portvilla' }),
        ]),
      );
      expect(draft.works).toHaveLength(1);
    });

    it('catches a URL smuggled into a prose field', () => {
      const { warnings } = draftFrom(
        result('capabilities', [
          { name: 'Voice', description: 'See https://evil.example.com/pwn' },
        ]),
      );
      expect(warnings[0].code).toBe('UNGROUNDED_URL');
    });

    it('drops a quote nobody in the description said', () => {
      const { draft, warnings } = draftFrom(
        result('testimonials', [
          {
            text: 'Absolutely the best product I have ever used.',
            author: 'Priya Nair',
            relationship: 'client',
          },
        ]),
      );

      expect(draft.testimonials).toBeUndefined();
      expect(warnings[0].code).toBe('UNGROUNDED_QUOTE');
    });

    it('keeps a quote that is really there, however it was punctuated', () => {
      const { draft } = draftFrom(
        result('testimonials', [
          {
            text: 'It put the right slide on screen   before it finished the sentence.',
            author: 'Priya Nair',
            relationship: 'client',
          },
        ]),
      );
      expect(draft.testimonials).toHaveLength(1);
    });

    it('drops a number the description never states', () => {
      const { draft, warnings } = draftFrom(
        result('metrics', [
          { value: '4,200', label: 'Customers' },
          { value: '120', label: 'Voice minutes a month' },
        ]),
      );

      expect(draft.metrics?.map((m) => m.label)).toEqual([
        'Voice minutes a month',
      ]);
      expect(warnings[0].code).toBe('UNGROUNDED_METRIC');
    });

    it('drops a work dated outside the description', () => {
      const { draft, warnings } = draftFrom(
        result('works', [
          aWork({ name: 'Real', date: '2026-09' }),
          aWork({ name: 'Imagined', date: '2019-04' }),
        ]),
      );

      expect(draft.works?.map((w) => w.name)).toEqual(['Real']);
      expect(warnings[0].code).toBe('UNDATED_WORK');
    });

    it('accepts the year alone as a date being grounded', () => {
      const { draft } = draftFrom(
        result('timeline', [
          { category: 'product_launch', date: '2026-03', label: 'Launch' },
        ]),
      );
      expect(draft.timeline).toHaveLength(1);
    });
  });

  describe('image fields', () => {
    it('never fills one, even with a URL that is in the description', () => {
      const { draft } = draftFrom(
        result('team', [
          {
            name: 'Sam Reyes',
            role: 'Founder',
            avatarUrl: 'https://portvilla.in',
          },
        ]),
      );
      // Absent, not null: a null through PATCH would clear an uploaded avatar.
      expect(draft.team?.[0]).not.toHaveProperty('avatarUrl');
    });

    it('clears a work cover and its screenshots', () => {
      const { draft } = draftFrom(
        result('works', [
          aWork({
            coverImage: 'https://portvilla.in',
            screenshots: [{ url: 'https://portvilla.in' }],
          }),
        ]),
      );
      expect(draft.works?.[0]).not.toHaveProperty('coverImage');
      expect(draft.works?.[0]).not.toHaveProperty('screenshots');
    });
  });

  describe('caps and duplicates', () => {
    it('caps a section and says it did', () => {
      const { draft, warnings } = draftFrom(
        result(
          'capabilities',
          Array.from({ length: 20 }, (_, i) => aCapability(`Skill ${i}`)),
        ),
      );

      expect(draft.capabilities).toHaveLength(12);
      expect(warnings).toContainEqual(
        expect.objectContaining({ code: 'CAPPED', section: 'capabilities' }),
      );
    });

    it('dedupes before capping, so copies cannot eat the budget', () => {
      const { draft } = draftFrom(
        result('capabilities', [
          ...Array.from({ length: 15 }, () => aCapability('TypeScript')),
          aCapability('React'),
        ]),
      );

      expect(draft.capabilities?.map((c) => c.name)).toEqual([
        'TypeScript',
        'React',
      ]);
    });

    it('treats case and spacing as the same name', () => {
      const { draft, warnings } = draftFrom(
        result('capabilities', [
          aCapability('Voice  Pipeline'),
          aCapability('voice pipeline'),
        ]),
      );

      expect(draft.capabilities).toHaveLength(1);
      expect(warnings[0].code).toBe('DUPLICATE');
    });

    it("caps a work's stages without dropping the work", () => {
      const stage = (label: string) => ({ label, summary: 'Shipped it.' });
      const { draft } = draftFrom(
        result('works', [
          aWork({
            stages: Array.from({ length: 9 }, (_, i) => stage(`Stage ${i}`)),
          }),
        ]),
      );

      expect(draft.works).toHaveLength(1);
      expect(draft.works?.[0].stages).toHaveLength(6);
    });
  });

  describe('section status', () => {
    it('is empty for a section that was never attempted', () => {
      const { sections } = draftFrom(
        result('capabilities', [aCapability('X')]),
      );
      expect(sections.capabilities).toBe('generated');
      expect(sections.testimonials).toBe('empty');
    });

    it('is empty when the model honestly found nothing', () => {
      const { sections, draft } = draftFrom(result('testimonials', []));
      expect(sections.testimonials).toBe('empty');
      expect(draft.testimonials).toBeUndefined();
    });

    it('is failed when the call came back with nothing', () => {
      const { sections, warnings } = assembleDraft(DESCRIPTION, [
        { section: 'works', value: null },
      ]);
      expect(sections.works).toBe('failed');
      expect(warnings[0].code).toBe('SECTION_FAILED');
    });

    it('is failed when the shape is unreadable', () => {
      const { sections, warnings } = assembleDraft(DESCRIPTION, [
        { section: 'works', value: { items: [] } },
      ]);
      expect(sections.works).toBe('failed');
      expect(warnings[0].code).toBe('PARSE_FAILED');
    });

    it('lets one failed section leave the others alone', () => {
      const { draft, sections } = assembleDraft(DESCRIPTION, [
        { section: 'works', value: null },
        result('capabilities', [aCapability('TypeScript')]),
      ]);

      expect(sections.works).toBe('failed');
      expect(sections.capabilities).toBe('generated');
      expect(draft.capabilities).toHaveLength(1);
    });
  });

  describe('the draft as a PATCH body', () => {
    it('omits an empty section rather than sending an empty array', () => {
      // `PATCH /profiles/me` writes an array section whole, so `works: []`
      // would delete the owner's works instead of saying "none found".
      const { draft } = draftFrom(
        result('works', []),
        result('capabilities', [aCapability('TypeScript')]),
      );

      expect('works' in draft).toBe(false);
      expect(draft.capabilities).toBeDefined();
    });

    it('validates against UpdateProfileDto, unchanged', () => {
      const { draft } = draftFrom(
        result('identity', [
          { tagline: 'A portfolio that speaks', bio: 'Launched in 2026.' },
        ]),
        result('capabilities', [aCapability('TypeScript')]),
        result('works', [aWork()]),
        result('metrics', [{ value: '120', label: 'Voice minutes' }]),
        result('offerings', [
          { name: 'Team', description: 'For a company.', price: '$29/mo' },
        ]),
        result('timeline', [
          { category: 'product_launch', date: '2026', label: 'Launch' },
        ]),
        result('content', [
          { type: 'blog', title: 'Post', url: 'https://portvilla.in' },
        ]),
        result('team', [{ name: 'Sam Reyes', role: 'Founder' }]),
        result('social', [
          {
            links: [
              { platform: 'github', url: 'https://github.com/portvilla' },
            ],
          },
        ]),
      );

      const errors = validateSync(plainToInstance(UpdateProfileDto, draft), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors).toEqual([]);
    });

    it('never writes a section generation has no authority over', () => {
      const { draft } = draftFrom(
        result('capabilities', [aCapability('TypeScript')]),
      );
      const keys = Object.keys(draft);

      for (const forbidden of ['media', 'brief', 'visibility', 'aiSettings']) {
        expect(keys).not.toContain(forbidden);
      }
    });
  });

  describe('identity and social, the single-object sections', () => {
    it('takes the one object out of the entries array', () => {
      const { draft } = draftFrom(
        result('identity', [{ tagline: 'Speaks for you', location: 'Delhi' }]),
      );
      expect(draft.identity).toEqual({
        tagline: 'Speaks for you',
        location: 'Delhi',
      });
    });

    it('drops social entirely when it found nothing outward-facing', () => {
      const { draft } = draftFrom(result('social', [{ links: [] }]));
      expect(draft.social).toBeUndefined();
    });
  });
});

describe('applyDraft', () => {
  it('leaves the record it was given untouched', () => {
    const record = aRecord();
    const before = JSON.stringify(record);

    const { draft } = draftFrom(result('capabilities', [aCapability('Voice')]));
    applyDraft(record, draft);

    expect(JSON.stringify(record)).toBe(before);
  });

  it('keeps a stored field the draft did not mention', () => {
    const record = aRecord();
    record.identity.location = 'Delhi';

    const { draft } = draftFrom(result('identity', [{ tagline: 'Speaks' }]));
    const next = applyDraft(record, draft);

    expect(next.identity.location).toBe('Delhi');
    expect(next.identity.tagline).toBe('Speaks');
  });

  it('gives every entry a key, so the projector can build slide ids', () => {
    const { draft } = draftFrom(
      result('works', [
        aWork({ stages: [{ label: 'GA', summary: 'Shipped.' }] }),
      ]),
    );
    const next = applyDraft(aRecord(), draft);

    expect(next.works[0].key).toMatch(/^[a-z0-9]{8}$/);
    expect(next.works[0].stages[0].key).toMatch(/^[a-z0-9]{8}$/);
  });

  it('produces the same catalog every time it is applied', () => {
    const { draft } = draftFrom(
      result('works', [aWork()]),
      result('capabilities', [aCapability('Voice')]),
    );
    const record = aRecord();

    expect(projectSlides(applyDraft(record, draft))).toEqual(
      projectSlides(applyDraft(record, draft)),
    );
  });

  it('feeds the projector a catalog the owner can preview', () => {
    const { draft } = draftFrom(
      result('works', [
        aWork({ stages: [{ label: 'GA', summary: 'Shipped.' }] }),
      ]),
      result('capabilities', [aCapability('Voice')]),
      result('metrics', [{ value: '120', label: 'Voice minutes' }]),
    );

    const slides = projectSlides(applyDraft(aRecord(), draft));
    const templates = slides.map((s) => s.template);

    // A product leads with capabilities; the stage follows its own work.
    expect(templates).toEqual([
      'identity',
      'capabilities',
      'work',
      'work_stage',
      'metrics',
    ]);
  });

  it('never leaks the brief into the preview catalog', () => {
    const { draft } = draftFrom(result('capabilities', [aCapability('Voice')]));
    const slides = projectSlides(applyDraft(aRecord(), draft));

    expect(JSON.stringify(slides)).not.toContain('Priya Nair said');
  });
});
