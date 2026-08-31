import {
  AgentSpeakingSpeed,
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  EntityType,
  LlmProvider,
  ProfileVisibility,
  TimelineCategory,
  WorkType,
  type CapabilityEntry,
  type IProfileRecord,
  type StageEntry,
  type TimelineEntry,
  type WorkEntry,
} from './profile.interface';
import { MAX_SLIDES, projectSlides } from './slide.projector';
import { SlideTemplate } from './slide';
import { STAGE_SUMMARY_MAX_LENGTH } from './section-limits';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A profile with every section empty and every secret populated.
 *
 * The secrets are deliberate: several tests below assert they never reach the
 * catalog, and a fixture that left them null would pass those tests without
 * proving anything.
 */
function aProfile(overrides: Partial<IProfileRecord> = {}): IProfileRecord {
  return {
    id: 'profile-id',
    userId: 'user-id',
    username: 'jane',
    visibility: ProfileVisibility.PUBLIC,
    identity: {
      entityType: EntityType.INDIVIDUAL,
      name: 'Jane Doe',
      tagline: null,
      bio: null,
      about: null,
      primaryImage: null,
      coverImage: null,
      location: null,
      foundedOrBorn: null,
      industry: null,
      availability: null,
      resume: {
        url: 'https://example.com/SECRET-RESUME.pdf',
        parsedText: 'SECRET-RESUME-TEXT',
      },
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
    social: {
      links: [],
      email: 'SECRET-EMAIL@example.com',
      phone: 'SECRET-PHONE-555',
      calendarUrl: null,
    },
    aiSettings: {
      provider: LlmProvider.OPENAI,
      apiKey: 'SECRET-API-KEY',
      model: null,
      baseUrl: null,
    },
    agentPersona: {
      agentName: 'Alex',
      tone: AgentTone.BALANCED,
      verbosity: AgentVerbosity.CONCISE,
      technicalDepth: AgentTechnicalDepth.MEDIUM,
      speakingSpeed: AgentSpeakingSpeed.NORMAL,
      voiceId: null,
    },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function aWork(overrides: Partial<WorkEntry> = {}): WorkEntry {
  return {
    key: 'aaaaaaaa',
    type: WorkType.PROJECT,
    name: 'PortVilla',
    tagline: null,
    description: '',
    url: null,
    repoUrl: null,
    coverImage: null,
    screenshots: [],
    technologies: [],
    tags: [],
    status: 'completed',
    highlights: [],
    featured: false,
    codeSnippets: [],
    date: null,
    stages: [],
    ...overrides,
  };
}

function aStage(overrides: Partial<StageEntry> = {}): StageEntry {
  return {
    key: 'sssssss1',
    label: 'Private beta',
    status: 'completed',
    summary: 'Opened to 50 hand-picked teams.',
    detail: null,
    date: null,
    endDate: null,
    highlights: [],
    ...overrides,
  };
}

function aCapability(
  overrides: Partial<CapabilityEntry> = {},
): CapabilityEntry {
  return {
    key: 'cccccccc',
    name: 'TypeScript',
    description: null,
    icon: null,
    category: null,
    proficiency: null,
    yearsOfExperience: null,
    ...overrides,
  };
}

function aTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    key: 'tttttttt',
    category: TimelineCategory.CAREER,
    date: '2022-01',
    endDate: null,
    label: 'Senior Engineer',
    organization: null,
    organizationLogoUrl: null,
    description: null,
    highlight: false,
    url: null,
    ...overrides,
  };
}

const idsOf = (record: IProfileRecord) =>
  projectSlides(record).map((s) => s.id);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('projectSlides', () => {
  describe('an empty profile', () => {
    it('yields the identity slide and nothing else', () => {
      expect(idsOf(aProfile())).toEqual(['identity']);
    });

    it('falls back to the name when there is no tagline or bio to speak', () => {
      const [identity] = projectSlides(aProfile());
      expect(identity.talkTrack).toEqual({ summary: 'Jane Doe', detail: null });
    });
  });

  describe('the identity slide', () => {
    it('carries the allowlisted identity fields', () => {
      const record = aProfile();
      record.identity.tagline = 'Full-stack engineer';
      record.identity.location = 'Delhi';

      const [identity] = projectSlides(record);

      expect(identity.template).toBe(SlideTemplate.IDENTITY);
      expect(identity.title).toBe('Jane Doe');
      expect(identity.payload).toMatchObject({
        name: 'Jane Doe',
        tagline: 'Full-stack engineer',
        location: 'Delhi',
        entityType: EntityType.INDIVIDUAL,
      });
    });

    it('speaks the tagline and holds the longer about-text back as detail', () => {
      const record = aProfile();
      record.identity.tagline = 'Full-stack engineer';
      record.identity.about = 'A much longer story about the work.';

      const [identity] = projectSlides(record);

      expect(identity.talkTrack).toEqual({
        summary: 'Full-stack engineer',
        detail: 'A much longer story about the work.',
      });
    });

    it('drops detail that would only repeat the summary', () => {
      const record = aProfile();
      record.identity.tagline = 'Same words';
      record.identity.about = 'Same words';

      const [identity] = projectSlides(record);
      expect(identity.talkTrack.detail).toBeNull();
    });
  });

  describe('a work without stages', () => {
    it('yields one slide, keyed by the work', () => {
      const record = aProfile({ works: [aWork({ key: 'a7f21c9d' })] });
      expect(idsOf(record)).toEqual(['identity', 'work:a7f21c9d']);
    });

    it('reports a stage count of zero', () => {
      const [, work] = projectSlides(
        aProfile({ works: [aWork({ tagline: 'A portfolio platform' })] }),
      );

      expect(work.template).toBe(SlideTemplate.WORK);
      if (work.template !== SlideTemplate.WORK) throw new Error('unreachable');
      expect(work.payload.stageCount).toBe(0);
    });
  });

  describe('a work with stages', () => {
    const record = aProfile({
      works: [
        aWork({
          key: 'a7f21c9d',
          name: 'PortVilla',
          stages: [
            aStage({ key: 'c19dbeef', label: 'Private beta' }),
            aStage({ key: 'd20ecafe', label: 'GA', summary: 'Shipped.' }),
          ],
        }),
      ],
    });

    it('places each stage directly after its own work', () => {
      expect(idsOf(record)).toEqual([
        'identity',
        'work:a7f21c9d',
        'work:a7f21c9d:stage:c19dbeef',
        'work:a7f21c9d:stage:d20ecafe',
      ]);
    });

    it('preserves the authored order of the stages', () => {
      const labels = projectSlides(record)
        .filter((s) => s.template === SlideTemplate.WORK_STAGE)
        .map((s) => s.payload.label);

      expect(labels).toEqual(['Private beta', 'GA']);
    });

    it('numbers each stage within its arc', () => {
      const positions = projectSlides(record)
        .filter((s) => s.template === SlideTemplate.WORK_STAGE)
        .map((s) => [s.payload.position, s.payload.total]);

      expect(positions).toEqual([
        [1, 2],
        [2, 2],
      ]);
    });

    it('tells the work slide how many stages follow it', () => {
      const [, work] = projectSlides(record);
      if (work.template !== SlideTemplate.WORK) throw new Error('unreachable');
      expect(work.payload.stageCount).toBe(2);
    });

    it('passes an authored stage summary through untouched', () => {
      const [, , firstStage] = projectSlides(record);
      expect(firstStage.talkTrack).toEqual({
        summary: 'Opened to 50 hand-picked teams.',
        detail: null,
      });
    });

    it('titles a stage with its work, so the slide reads alone', () => {
      const [, , firstStage] = projectSlides(record);
      expect(firstStage.title).toBe('PortVilla — Private beta');
    });
  });

  describe('ordering', () => {
    it('runs identity, then works, then capabilities, timeline and contact', () => {
      const record = aProfile({
        works: [
          aWork({ key: 'work0001', stages: [aStage({ key: 'stage001' })] }),
          aWork({ key: 'work0002' }),
        ],
        capabilities: [aCapability()],
        timeline: [aTimelineEntry()],
      });
      record.social.links = [
        { platform: 'github', url: 'https://gh', label: null },
      ];

      expect(idsOf(record)).toEqual([
        'identity',
        'work:work0001',
        'work:work0001:stage:stage001',
        'work:work0002',
        'capabilities',
        'timeline',
        'contact',
      ]);
    });
  });

  describe('slide ids', () => {
    it('match the documented shapes', () => {
      const record = aProfile({
        works: [
          aWork({ key: 'a7f21c9d', stages: [aStage({ key: 'c19dbeef' })] }),
        ],
        capabilities: [aCapability()],
        timeline: [aTimelineEntry()],
      });
      record.social.calendarUrl = 'https://cal.com/jane';

      const shapes =
        /^(identity|capabilities|timeline|contact|work:[a-z0-9]{8}(:stage:[a-z0-9]{8})?)$/;

      for (const id of idsOf(record)) expect(id).toMatch(shapes);
    });

    it('are unique across the catalog, so a slide id resolves to one slide', () => {
      const record = aProfile({
        works: [
          aWork({ key: 'work0001', stages: [aStage({ key: 'stage001' })] }),
          aWork({ key: 'work0002', stages: [aStage({ key: 'stage001' })] }),
        ],
      });

      const ids = idsOf(record);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('sections with nothing in them', () => {
    it('produce no slide rather than an empty one', () => {
      expect(idsOf(aProfile())).not.toContain('capabilities');
      expect(idsOf(aProfile())).not.toContain('timeline');
      expect(idsOf(aProfile())).not.toContain('contact');
    });

    it('still yields contact when only a calendar link exists', () => {
      const record = aProfile();
      record.social.calendarUrl = 'https://cal.com/jane';
      expect(idsOf(record)).toContain('contact');
    });

    it('does not yield contact for an email or phone alone', () => {
      // The fixture has both set; neither is an outward-facing affordance.
      expect(idsOf(aProfile())).not.toContain('contact');
    });
  });

  describe('the catalog cap', () => {
    const oversized = aProfile({
      works: Array.from({ length: 100 }, (_, w) =>
        aWork({
          key: `work${String(w).padStart(4, '0')}`,
          stages: Array.from({ length: 20 }, (_, s) =>
            aStage({
              key: `st${String(w).padStart(3, '0')}${String(s).padStart(3, '0')}`,
            }),
          ),
        }),
      ),
      capabilities: [aCapability()],
      timeline: [aTimelineEntry()],
    });

    it('never exceeds MAX_SLIDES', () => {
      expect(projectSlides(oversized).length).toBeLessThanOrEqual(MAX_SLIDES);
    });

    it('drops whole works rather than cutting an arc in half', () => {
      const slides = projectSlides(oversized);

      const workKeys = slides
        .filter((s) => s.template === SlideTemplate.WORK)
        .map((s) => s.payload.key);

      // Every work that survived must have brought all 20 of its stages.
      for (const key of workKeys) {
        const stages = slides.filter(
          (s) =>
            s.template === SlideTemplate.WORK_STAGE &&
            s.payload.workKey === key,
        );
        expect(stages).toHaveLength(20);
      }
    });

    it('keeps a prefix of the works, in the order the user arranged them', () => {
      const workKeys = projectSlides(oversized)
        .filter((s) => s.template === SlideTemplate.WORK)
        .map((s) => s.payload.key);

      expect(workKeys).toEqual(
        oversized.works.slice(0, workKeys.length).map((w) => w.key),
      );
    });

    it('still emits the fixed slides after truncating works', () => {
      const ids = idsOf(oversized);
      expect(ids[0]).toBe('identity');
      expect(ids).toContain('capabilities');
      expect(ids).toContain('timeline');
    });

    it('truncates identically on every call', () => {
      expect(projectSlides(oversized)).toEqual(projectSlides(oversized));
    });
  });

  describe('the allowlist', () => {
    it('never leaks a secret into the catalog', () => {
      const record = aProfile({
        works: [aWork({ stages: [aStage()] })],
        capabilities: [aCapability()],
        timeline: [aTimelineEntry()],
      });
      record.social.calendarUrl = 'https://cal.com/jane';

      const serialized = JSON.stringify(projectSlides(record));

      for (const secret of [
        'SECRET-API-KEY',
        'SECRET-RESUME-TEXT',
        'SECRET-RESUME.pdf',
        'SECRET-EMAIL',
        'SECRET-PHONE',
      ]) {
        expect(serialized).not.toContain(secret);
      }
    });

    it('omits email and phone from the contact payload entirely', () => {
      const record = aProfile();
      record.social.links = [
        { platform: 'github', url: 'https://gh', label: null },
      ];

      const contact = projectSlides(record).find((s) => s.id === 'contact');
      if (contact?.template !== SlideTemplate.CONTACT) {
        throw new Error('expected a contact slide');
      }
      expect(Object.keys(contact.payload).sort()).toEqual([
        'calendarUrl',
        'links',
      ]);
    });
  });

  describe('talk tracks', () => {
    it('holds a derived summary to one breath', () => {
      const record = aProfile({
        works: [aWork({ description: 'word '.repeat(120).trim() })],
      });

      const [, work] = projectSlides(record);
      expect(work.talkTrack.summary.length).toBeLessThanOrEqual(
        STAGE_SUMMARY_MAX_LENGTH,
      );
    });

    it('cuts at a word boundary and marks the cut', () => {
      const record = aProfile({
        works: [aWork({ description: 'word '.repeat(120).trim() })],
      });

      const [, work] = projectSlides(record);
      expect(work.talkTrack.summary).toMatch(/word…$/);
    });

    it('keeps the full text as detail even when the summary was cut', () => {
      const description = 'word '.repeat(120).trim();
      const [, work] = projectSlides(
        aProfile({ works: [aWork({ description })] }),
      );

      expect(work.talkTrack.detail).toBe(description);
    });

    it('lists capabilities without naming more than a few aloud', () => {
      const record = aProfile({
        capabilities: [
          aCapability({ key: 'cap00001', name: 'TypeScript' }),
          aCapability({ key: 'cap00002', name: 'React' }),
          aCapability({ key: 'cap00003', name: 'Kubernetes' }),
          aCapability({ key: 'cap00004', name: 'Go' }),
          aCapability({ key: 'cap00005', name: 'Rust' }),
        ],
      });

      const capabilities = projectSlides(record).find(
        (s) => s.id === 'capabilities',
      );
      expect(capabilities?.talkTrack.summary).toBe(
        '5 capabilities, including TypeScript, React, Kubernetes and 2 more.',
      );
    });

    it('uses the singular for a section of one', () => {
      const record = aProfile({ capabilities: [aCapability()] });
      const capabilities = projectSlides(record).find(
        (s) => s.id === 'capabilities',
      );
      expect(capabilities?.talkTrack.summary).toBe(
        '1 capability, including TypeScript.',
      );
    });
  });

  describe('purity', () => {
    it('returns an equal catalog for an unchanged record', () => {
      const record = aProfile({
        works: [aWork({ stages: [aStage()] })],
        capabilities: [aCapability()],
      });

      expect(projectSlides(record)).toEqual(projectSlides(record));
    });

    it('does not mutate the record it was given', () => {
      const record = aProfile({
        works: [aWork({ technologies: ['NestJS'], stages: [aStage()] })],
        timeline: [aTimelineEntry()],
      });
      const before = JSON.stringify(record);

      projectSlides(record);

      expect(JSON.stringify(record)).toBe(before);
    });

    it('hands back payload arrays that do not alias the record', () => {
      const record = aProfile({
        works: [aWork({ technologies: ['NestJS'] })],
      });

      const [, work] = projectSlides(record);
      if (work.template !== SlideTemplate.WORK) throw new Error('unreachable');
      work.payload.technologies.push('mutated');

      expect(record.works[0].technologies).toEqual(['NestJS']);
    });
  });
});
