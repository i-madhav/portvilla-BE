import {
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  ContentType,
  EntityType,
  LlmProvider,
  ProfileVisibility,
  TestimonialRelationship,
  TimelineCategory,
  WorkType,
  type CapabilityEntry,
  type ContentEntry,
  type HotspotEntry,
  type IProfileRecord,
  type MetricEntry,
  type OfferingEntry,
  type ScreenshotEntry,
  type StageEntry,
  type TeamMemberEntry,
  type TestimonialEntry,
  type TimelineEntry,
  type WorkEntry,
} from './profile.interface';
import { defaultAgentStack } from './agent-stack/catalog';
import { MAX_SLIDES, projectSlides, sectionOrder } from './slide.projector';
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
    brief: { text: 'SECRET-BRIEF-TEXT' },
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
    },
    agentStack: defaultAgentStack(),
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
    date: '2024-01',
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

function anOffering(overrides: Partial<OfferingEntry> = {}): OfferingEntry {
  return {
    key: 'oooooooo',
    name: 'Starter',
    description: 'For one person getting going.',
    icon: null,
    price: '$0',
    features: ['One profile'],
    highlighted: false,
    tags: [],
    cta: null,
    ...overrides,
  };
}

function aMetric(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    key: 'mmmmmmmm',
    value: '99.9%',
    label: 'Uptime',
    description: null,
    icon: null,
    category: null,
    ...overrides,
  };
}

function aTestimonial(
  overrides: Partial<TestimonialEntry> = {},
): TestimonialEntry {
  return {
    key: 'rrrrrrrr',
    text: 'It does exactly what it says.',
    author: 'Priya Nair',
    role: null,
    organization: null,
    avatarUrl: null,
    relationship: TestimonialRelationship.CLIENT,
    featured: false,
    ...overrides,
  };
}

function aTeamMember(
  overrides: Partial<TeamMemberEntry> = {},
): TeamMemberEntry {
  return {
    key: 'pppppppp',
    name: 'Sam Reyes',
    role: 'Engineer',
    bio: null,
    avatarUrl: null,
    links: [],
    ...overrides,
  };
}

function aContentItem(overrides: Partial<ContentEntry> = {}): ContentEntry {
  return {
    key: 'nnnnnnnn',
    type: ContentType.BLOG,
    title: 'Deriving slides from a profile',
    url: 'https://example.com/post',
    description: null,
    thumbnailUrl: null,
    date: '2026-03',
    tags: [],
    featured: false,
    ...overrides,
  };
}

function aScreenshot(
  overrides: Partial<ScreenshotEntry> = {},
): ScreenshotEntry {
  return {
    key: 'shot0001',
    url: 'https://example.com/board.png',
    caption: 'The board',
    hotspots: [],
    ...overrides,
  };
}

/**
 * The note is a marker rather than prose: several tests below assert it never
 * reaches a payload, and a phrase that also appeared elsewhere would prove
 * nothing.
 */
function aHotspot(overrides: Partial<HotspotEntry> = {}): HotspotEntry {
  return {
    key: 'hot00001',
    label: 'Export button',
    note: 'AGENT-ONLY-NOTE: exports the board as a CSV.',
    x: 80,
    y: 4,
    w: 12,
    h: 6,
    ...overrides,
  };
}

/**
 * A profile with **every** section populated — the fixture the order and
 * allowlist tests need, since both are about what the whole catalog does.
 * `media` carries one image and one video: only the image may be projected.
 */
function aFullProfile(entityType = EntityType.INDIVIDUAL): IProfileRecord {
  const record = aProfile({
    works: [
      aWork({
        key: 'work0001',
        stages: [aStage({ key: 'stage001' })],
        screenshots: [aScreenshot({ hotspots: [aHotspot()] })],
      }),
    ],
    capabilities: [aCapability()],
    timeline: [aTimelineEntry()],
    offerings: [anOffering()],
    metrics: [aMetric()],
    testimonials: [aTestimonial()],
    team: [aTeamMember()],
    content: [aContentItem()],
    media: [
      {
        key: 'dddddddd',
        url: 'https://example.com/shot.png',
        caption: null,
        type: 'image',
        category: null,
      },
      {
        key: 'eeeeeeee',
        url: 'https://example.com/reel.mp4',
        caption: 'Reel',
        type: 'video',
        category: null,
      },
    ],
  });
  record.identity.entityType = entityType;
  record.social.links = [
    { platform: 'github', url: 'https://gh', label: null },
  ];
  return record;
}

const idsOf = (record: IProfileRecord) =>
  projectSlides(record).map((s) => s.id);

const slideById = (record: IProfileRecord, id: string) => {
  const slide = projectSlides(record).find((s) => s.id === id);
  if (!slide) throw new Error(`expected a ${id} slide`);
  return slide;
};

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

  describe('the offerings slide', () => {
    it('carries every offering field, including the call to action', () => {
      const record = aProfile({
        offerings: [
          anOffering({
            cta: { label: 'Start free', url: 'https://example.com/signup' },
            tags: ['popular'],
          }),
        ],
      });

      const slide = slideById(record, 'offerings');
      expect(slide.template).toBe(SlideTemplate.OFFERINGS);
      expect(slide.title).toBe('Offerings');
      if (slide.template !== SlideTemplate.OFFERINGS) throw new Error('x');
      expect(slide.payload.items[0]).toEqual({
        key: 'oooooooo',
        name: 'Starter',
        description: 'For one person getting going.',
        icon: null,
        price: '$0',
        features: ['One profile'],
        highlighted: false,
        tags: ['popular'],
        cta: { label: 'Start free', url: 'https://example.com/signup' },
      });
    });

    it('counts them and names a few aloud', () => {
      const record = aProfile({
        offerings: [
          anOffering({ key: 'off00001', name: 'Starter' }),
          anOffering({ key: 'off00002', name: 'Team' }),
          anOffering({ key: 'off00003', name: 'Enterprise' }),
        ],
      });

      expect(slideById(record, 'offerings').talkTrack).toEqual({
        summary: '3 offerings, including Starter, Team and Enterprise.',
        detail: null,
      });
    });
  });

  describe('the metrics slide', () => {
    it('carries the value as written, suffix and all', () => {
      const record = aProfile({
        metrics: [aMetric({ value: '10M+', label: 'Requests a day' })],
      });

      const slide = slideById(record, 'metrics');
      expect(slide.template).toBe(SlideTemplate.METRICS);
      expect(slide.title).toBe('By the numbers');
      if (slide.template !== SlideTemplate.METRICS) throw new Error('x');
      expect(slide.payload.items[0]).toEqual({
        key: 'mmmmmmmm',
        value: '10M+',
        label: 'Requests a day',
        description: null,
        icon: null,
        category: null,
      });
      expect(slide.talkTrack.summary).toBe(
        '1 number, including Requests a day.',
      );
    });
  });

  describe('the testimonials slide', () => {
    it('keeps the quote, its author and their picture', () => {
      const record = aProfile({
        testimonials: [
          aTestimonial({
            role: 'CTO',
            organization: 'Northwind',
            avatarUrl: 'https://example.com/priya.jpg',
            featured: true,
          }),
        ],
      });

      const slide = slideById(record, 'testimonials');
      expect(slide.template).toBe(SlideTemplate.TESTIMONIALS);
      expect(slide.title).toBe('What people say');
      if (slide.template !== SlideTemplate.TESTIMONIALS) throw new Error('x');
      expect(slide.payload.items[0]).toEqual({
        key: 'rrrrrrrr',
        text: 'It does exactly what it says.',
        author: 'Priya Nair',
        role: 'CTO',
        organization: 'Northwind',
        avatarUrl: 'https://example.com/priya.jpg',
        relationship: TestimonialRelationship.CLIENT,
        featured: true,
      });
    });

    it('attributes them rather than listing them', () => {
      const record = aProfile({
        testimonials: [
          aTestimonial({ key: 'tst00001', author: 'Priya Nair' }),
          aTestimonial({ key: 'tst00002', author: 'Sam Reyes' }),
        ],
      });

      expect(slideById(record, 'testimonials').talkTrack.summary).toBe(
        '2 testimonials, from Priya Nair and Sam Reyes.',
      );
    });

    it('leaves the authored order alone, featured or not', () => {
      const record = aProfile({
        testimonials: [
          aTestimonial({ key: 'tst00001', author: 'First' }),
          aTestimonial({ key: 'tst00002', author: 'Second', featured: true }),
        ],
      });

      const slide = slideById(record, 'testimonials');
      if (slide.template !== SlideTemplate.TESTIMONIALS) throw new Error('x');
      expect(slide.payload.items.map((t) => t.author)).toEqual([
        'First',
        'Second',
      ]);
    });
  });

  describe('the team slide', () => {
    it("carries each member's public links", () => {
      const record = aProfile({
        team: [
          aTeamMember({
            bio: 'Builds the projector.',
            links: [{ platform: 'github', url: 'https://gh/sam' }],
          }),
        ],
      });

      const slide = slideById(record, 'team');
      expect(slide.template).toBe(SlideTemplate.TEAM);
      expect(slide.title).toBe('The team');
      if (slide.template !== SlideTemplate.TEAM) throw new Error('x');
      expect(slide.payload.items[0]).toEqual({
        key: 'pppppppp',
        name: 'Sam Reyes',
        role: 'Engineer',
        bio: 'Builds the projector.',
        avatarUrl: null,
        links: [{ platform: 'github', url: 'https://gh/sam' }],
      });
      expect(slide.talkTrack.summary).toBe('1 person, including Sam Reyes.');
    });
  });

  describe('the content slide', () => {
    it('carries the piece, its type and its date', () => {
      const record = aProfile({
        content: [aContentItem({ type: ContentType.TALK, tags: ['voice'] })],
      });

      const slide = slideById(record, 'content');
      expect(slide.template).toBe(SlideTemplate.CONTENT);
      expect(slide.title).toBe('Writing and talks');
      if (slide.template !== SlideTemplate.CONTENT) throw new Error('x');
      expect(slide.payload.items[0]).toEqual({
        key: 'nnnnnnnn',
        type: ContentType.TALK,
        title: 'Deriving slides from a profile',
        url: 'https://example.com/post',
        description: null,
        thumbnailUrl: null,
        date: '2026-03',
        tags: ['voice'],
        featured: false,
      });
      expect(slide.talkTrack.summary).toBe(
        '1 piece, including Deriving slides from a profile.',
      );
    });
  });

  describe('the media slide', () => {
    const image = (key: string, caption: string | null) => ({
      key,
      url: `https://cdn.example.com/i/${key}/l`,
      caption,
      type: 'image' as const,
      category: null,
    });

    it('names the captioned images and counts all of them', () => {
      const slide = slideById(
        aProfile({
          media: [
            image('aaaaaaaa', 'Berlin offsite'),
            image('bbbbbbbb', null),
            image('cccccccc', 'Launch night'),
          ],
        }),
        'media',
      );

      expect(slide.talkTrack.summary).toBe(
        '3 images, including Berlin offsite and Launch night.',
      );
    });

    it('says only the count when nothing is captioned', () => {
      const slide = slideById(
        aProfile({ media: [image('aaaaaaaa', null)] }),
        'media',
      );
      expect(slide.talkTrack.summary).toBe('1 image.');
    });

    it('yields no slide for a section of videos alone', () => {
      const ids = idsOf(
        aProfile({
          media: [
            {
              key: 'aaaaaaaa',
              url: 'https://example.com/reel.mp4',
              caption: null,
              type: 'video',
              category: null,
            },
          ],
        }),
      );
      expect(ids).not.toContain('media');
    });
  });

  describe('catalog order', () => {
    it('opens on identity and closes on contact, whatever the entity', () => {
      for (const entityType of Object.values(EntityType)) {
        const ids = idsOf(aFullProfile(entityType));
        expect(ids[0]).toBe('identity');
        expect(ids[ids.length - 1]).toBe('contact');
      }
    });

    it('tells an individual story: what they built, then what they know', () => {
      expect(idsOf(aFullProfile(EntityType.INDIVIDUAL))).toEqual([
        'identity',
        'work:work0001',
        'work:work0001:stage:stage001',
        'capabilities',
        'timeline',
        'testimonials',
        'content',
        'media',
        'metrics',
        'offerings',
        'team',
        'contact',
      ]);
    });

    it('leads a company with what it sells', () => {
      expect(idsOf(aFullProfile(EntityType.COMPANY))).toEqual([
        'identity',
        'offerings',
        'work:work0001',
        'work:work0001:stage:stage001',
        'media',
        'metrics',
        'testimonials',
        'team',
        'capabilities',
        'timeline',
        'content',
        'contact',
      ]);
    });

    it('tells an organization the same story as a company', () => {
      expect(idsOf(aFullProfile(EntityType.ORGANIZATION))).toEqual(
        idsOf(aFullProfile(EntityType.COMPANY)),
      );
    });

    it('leads a product with what it does', () => {
      expect(idsOf(aFullProfile(EntityType.PRODUCT))).toEqual([
        'identity',
        'capabilities',
        'work:work0001',
        'work:work0001:stage:stage001',
        'media',
        'metrics',
        'offerings',
        'testimonials',
        'timeline',
        'team',
        'content',
        'contact',
      ]);
    });

    it('orders every section exactly once for every entity type', () => {
      const sections = [...sectionOrder(EntityType.INDIVIDUAL)].sort();

      for (const entityType of Object.values(EntityType)) {
        const ordered = sectionOrder(entityType);
        expect(new Set(ordered).size).toBe(ordered.length);
        expect([...ordered].sort()).toEqual(sections);
      }
    });

    it('keeps a stage with its work wherever works fall in the order', () => {
      const ids = idsOf(aFullProfile(EntityType.COMPANY));
      expect(ids.indexOf('work:work0001:stage:stage001')).toBe(
        ids.indexOf('work:work0001') + 1,
      );
    });
  });

  describe('a full profile', () => {
    it('projects one slide for every section that has a template', () => {
      // Every section is projectable: identity, works (+1 stage),
      // capabilities, timeline, offerings, metrics, testimonials, team,
      // content, media, contact.
      expect(idsOf(aFullProfile())).toHaveLength(12);
    });

    it('projects the images of media and leaves the videos out', () => {
      const slide = slideById(aFullProfile(), 'media');
      if (slide.template !== SlideTemplate.MEDIA) throw new Error('not media');

      expect(slide.payload.items).toEqual([
        {
          key: 'dddddddd',
          url: 'https://example.com/shot.png',
          caption: null,
          category: null,
        },
      ]);
      expect(JSON.stringify(projectSlides(aFullProfile()))).not.toContain(
        'reel.mp4',
      );
    });

    // A payload is a closed interface, so it has no index signature to read
    // keys through; `unknown` is the one honest way in and out of that.
    const entryKeys = (payload: unknown): string[] => {
      const obj = payload as Record<string, unknown>;
      const items = obj.items;
      return Array.isArray(items)
        ? Object.keys(items[0] as object).sort()
        : Object.keys(obj).sort();
    };

    it('allowlists every payload field by field', () => {
      const keysByTemplate: Partial<Record<SlideTemplate, string[]>> = {};
      for (const slide of projectSlides(aFullProfile())) {
        keysByTemplate[slide.template] = entryKeys(slide.payload);
      }

      expect(keysByTemplate[SlideTemplate.OFFERINGS]).toEqual([
        'cta',
        'description',
        'features',
        'highlighted',
        'icon',
        'key',
        'name',
        'price',
        'tags',
      ]);
      expect(keysByTemplate[SlideTemplate.METRICS]).toEqual([
        'category',
        'description',
        'icon',
        'key',
        'label',
        'value',
      ]);
      expect(keysByTemplate[SlideTemplate.TESTIMONIALS]).toEqual([
        'author',
        'avatarUrl',
        'featured',
        'key',
        'organization',
        'relationship',
        'role',
        'text',
      ]);
      expect(keysByTemplate[SlideTemplate.TEAM]).toEqual([
        'avatarUrl',
        'bio',
        'key',
        'links',
        'name',
        'role',
      ]);
      expect(keysByTemplate[SlideTemplate.CONTENT]).toEqual([
        'date',
        'description',
        'featured',
        'key',
        'tags',
        'thumbnailUrl',
        'title',
        'type',
        'url',
      ]);
      expect(keysByTemplate[SlideTemplate.MEDIA]).toEqual([
        'caption',
        'category',
        'key',
        'url',
      ]);
    });

    it('draws a hotspot from geometry and a label, and nothing more', () => {
      const slide = slideById(aFullProfile(), 'work:work0001');
      if (slide.template !== SlideTemplate.WORK) throw new Error('not work');

      const [shot] = slide.payload.screenshots;
      expect(Object.keys(shot).sort()).toEqual([
        'caption',
        'hotspots',
        'key',
        'url',
      ]);
      expect(Object.keys(shot.hotspots[0]).sort()).toEqual([
        'h',
        'key',
        'label',
        'w',
        'x',
        'y',
      ]);
    });

    it('carries no note anywhere inside any payload', () => {
      // Walks every value, so a note nested at any depth, under any template,
      // fails this — not only the hotspot the fixture happens to put it on.
      const noteKeys = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.flatMap(noteKeys);
        if (typeof value !== 'object' || value === null) return [];
        return Object.entries(value).flatMap(([key, child]) => [
          ...(key === 'note' ? [key] : []),
          ...noteKeys(child),
        ]);
      };
      const slides = projectSlides(aFullProfile());

      for (const slide of slides) {
        expect(noteKeys(slide.payload)).toEqual([]);
        expect(JSON.stringify(slide.payload)).not.toContain('AGENT-ONLY-NOTE');
      }
      // …while the agent does get it, beside the payload.
      expect(JSON.stringify(slides.map((s) => s.focus))).toContain(
        'AGENT-ONLY-NOTE',
      );
    });

    it('still leaks no secret once every section is populated', () => {
      const serialized = JSON.stringify(projectSlides(aFullProfile()));

      for (const secret of [
        'SECRET-API-KEY',
        'SECRET-RESUME-TEXT',
        'SECRET-RESUME.pdf',
        'SECRET-EMAIL',
        'SECRET-PHONE',
        'SECRET-BRIEF-TEXT',
      ]) {
        expect(serialized).not.toContain(secret);
      }
    });

    it('hands back item arrays that do not alias the record', () => {
      const record = aFullProfile();
      const slide = slideById(record, 'offerings');
      if (slide.template !== SlideTemplate.OFFERINGS) throw new Error('x');

      slide.payload.items[0].features.push('mutated');

      expect(record.offerings[0].features).toEqual(['One profile']);
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
      const ids = idsOf(aProfile());

      for (const section of [
        'capabilities',
        'timeline',
        'offerings',
        'metrics',
        'testimonials',
        'team',
        'content',
        'contact',
      ]) {
        expect(ids).not.toContain(section);
      }
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

    it('leaves room for all nine single-slide sections, not just two', () => {
      // The reason MAX_FIXED_SLIDES is 10 and not 4: with every section filled,
      // the works budget has to stop short by enough that identity and the
      // nine section slides still fit under MAX_SLIDES.
      const full = aFullProfile();
      full.works = oversized.works;

      const ids = idsOf(full);

      expect(ids.length).toBeLessThanOrEqual(MAX_SLIDES);
      for (const section of [
        'identity',
        'capabilities',
        'timeline',
        'offerings',
        'metrics',
        'testimonials',
        'team',
        'content',
        'media',
        'contact',
      ]) {
        expect(ids).toContain(section);
      }
    });
  });

  describe('focus menus', () => {
    const focusOf = (record: IProfileRecord, id: string) =>
      slideById(record, id).focus;

    it('names each capability by its key', () => {
      const record = aProfile({
        capabilities: [
          aCapability({ key: 'react001', name: 'React' }),
          aCapability({ key: 'nest0001', name: 'NestJS' }),
        ],
      });

      expect(focusOf(record, 'capabilities')).toEqual([
        { key: 'react001', label: 'React', note: null },
        { key: 'nest0001', label: 'NestJS', note: null },
      ]);
    });

    it('names each timeline entry by its title', () => {
      const record = aProfile({
        timeline: [
          aTimelineEntry({ key: 'job00001', label: 'Staff Engineer' }),
        ],
      });

      expect(focusOf(record, 'timeline')).toEqual([
        { key: 'job00001', label: 'Staff Engineer', note: null },
      ]);
    });

    it("lists a work's screenshots, each followed by its hotspots", () => {
      const record = aProfile({
        works: [
          aWork({
            key: 'work0001',
            screenshots: [
              aScreenshot({
                key: 'shot0001',
                caption: 'The board',
                hotspots: [
                  aHotspot({ key: 'hot00001', label: 'Export', note: 'CSV.' }),
                  aHotspot({ key: 'hot00002', label: 'Filter', note: 'Tags.' }),
                ],
              }),
              aScreenshot({ key: 'shot0002', caption: 'Settings' }),
            ],
          }),
        ],
      });

      expect(focusOf(record, 'work:work0001')).toEqual([
        { key: 'shot0001', label: 'The board', note: null },
        { key: 'shot0001.hot00001', label: 'Export', note: 'CSV.' },
        { key: 'shot0001.hot00002', label: 'Filter', note: 'Tags.' },
        { key: 'shot0002', label: 'Settings', note: null },
      ]);
    });

    it('labels an uncaptioned screenshot by its place among them', () => {
      const record = aProfile({
        works: [
          aWork({
            key: 'work0001',
            screenshots: [
              aScreenshot({ key: 'shot0001', caption: 'The board' }),
              aScreenshot({ key: 'shot0002', caption: null }),
              aScreenshot({ key: 'shot0003', caption: '   ' }),
            ],
          }),
        ],
      });

      expect(focusOf(record, 'work:work0001').map((f) => f.label)).toEqual([
        'The board',
        'Screenshot 2',
        'Screenshot 3',
      ]);
    });

    it('shows a legacy unkeyed screenshot but offers nothing to point at', () => {
      // Stored before screenshots were keyed, and so loaded without a key.
      const legacy = aScreenshot({ key: undefined, caption: 'Old' });
      const record = aProfile({
        works: [
          aWork({
            key: 'work0001',
            screenshots: [
              legacy,
              aScreenshot({ key: 'shot0002', caption: 'New' }),
            ],
          }),
        ],
      });

      const slide = slideById(record, 'work:work0001');
      if (slide.template !== SlideTemplate.WORK) throw new Error('not work');
      expect(slide.payload.screenshots.map((s) => s.key)).toEqual([
        null,
        'shot0002',
      ]);
      expect(slide.payload.screenshots[0].hotspots).toEqual([]);
      // The fallback label still counts it: "Screenshot N" is its place on screen.
      expect(slide.focus).toEqual([
        { key: 'shot0002', label: 'New', note: null },
      ]);
    });

    it('is empty for a work with no screenshots, and every other template', () => {
      const slides = projectSlides(aFullProfile());
      const withMenus = [
        SlideTemplate.CAPABILITIES,
        SlideTemplate.TIMELINE,
        SlideTemplate.WORK,
      ];

      for (const slide of slides) {
        if (!withMenus.includes(slide.template)) {
          expect(slide.focus).toEqual([]);
        }
      }
      expect(
        focusOf(
          aProfile({ works: [aWork({ key: 'work0001' })] }),
          'work:work0001',
        ),
      ).toEqual([]);
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
        // The owner's source description. Slides are derived from the sections
        // it produced, never from the brief itself.
        'SECRET-BRIEF-TEXT',
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
