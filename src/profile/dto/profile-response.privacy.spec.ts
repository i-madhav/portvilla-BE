import {
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  EntityType,
  LlmProvider,
  ProfileVisibility,
  WorkType,
  type IProfileRecord,
  type WorkEntry,
} from '../domain/profile.interface';
import { defaultAgentStack } from '../domain/agent-stack/catalog';

import { ProfileDataResponseDto } from './profile-data-response.dto';
import { ProfilePreviewResponseDto } from './profile-preview-response.dto';
import { PublicProfileResponseDto } from './public-profile-response.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BRIEF_TEXT = 'SECRET-BRIEF-TEXT';

/**
 * A profile whose brief is populated.
 *
 * The populated brief is the point: an assertion that a response does not
 * contain the brief proves nothing against a fixture whose brief is null.
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
    brief: { text: BRIEF_TEXT },
    aiSettings: {
      provider: LlmProvider.OPENAI,
      apiKey: null,
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

const HOTSPOT_NOTE = 'AGENT-ONLY-NOTE: exports the board as a CSV.';

/** A work whose one screenshot has a hotspot with a note on it. */
function aWorkWithAHotspot(): WorkEntry {
  return {
    key: 'work0001',
    type: WorkType.PROJECT,
    name: 'PortVilla',
    tagline: null,
    description: '',
    url: null,
    repoUrl: null,
    coverImage: null,
    screenshots: [
      {
        key: 'shot0001',
        url: 'https://example.com/board.png',
        caption: 'The board',
        hotspots: [
          {
            key: 'hot00001',
            label: 'Export button',
            note: HOTSPOT_NOTE,
            x: 80,
            y: 4,
            w: 12,
            h: 6,
          },
        ],
      },
    ],
    technologies: [],
    tags: [],
    status: 'completed',
    highlights: [],
    featured: false,
    codeSnippets: [],
    date: '2024-01',
    stages: [],
  };
}

/** Every property named `note`, at any depth. */
function noteKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(noteKeys);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(key === 'note' ? [key] : []),
    ...noteKeys(child),
  ]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * `brief` is the owner's raw source description — whatever they pasted, in
 * whatever state. Exactly one response is allowed to carry it, and these
 * assertions are over the whole serialized body rather than a field list, so a
 * section added to one of these DTOs later cannot smuggle it out.
 */
describe('brief is owner-only', () => {
  it('reaches the owner through GET /profiles/me', () => {
    const dto = ProfileDataResponseDto.fromRecord(aProfile());

    expect(dto.brief).toEqual({ text: BRIEF_TEXT });
  });

  it('survives a round trip as null when the owner has written none', () => {
    const dto = ProfileDataResponseDto.fromRecord(
      aProfile({ brief: { text: null } }),
    );

    expect(dto.brief).toEqual({ text: null });
  });

  it('never reaches a visitor through the public profile', () => {
    const dto = PublicProfileResponseDto.fromRecord(aProfile());

    expect(Object.keys(dto)).not.toContain('brief');
    expect(JSON.stringify(dto)).not.toContain(BRIEF_TEXT);
  });

  it('never reaches the owner-facing slide preview', () => {
    const dto = ProfilePreviewResponseDto.fromRecord(aProfile());

    expect(Object.keys(dto)).not.toContain('brief');
    expect(JSON.stringify(dto)).not.toContain(BRIEF_TEXT);
  });
});

/**
 * A hotspot `note` is the agent's line about a region (plan §15). The owner's
 * editor needs it; a visitor's screen must never get it, or the page reads
 * ahead of the voice.
 */
describe('hotspot notes are agent-side only', () => {
  const record = aProfile({ works: [aWorkWithAHotspot()] });

  it('never reach a visitor through the public profile', () => {
    const dto = PublicProfileResponseDto.fromRecord(record);

    expect(noteKeys(dto)).toEqual([]);
    expect(JSON.stringify(dto)).not.toContain(HOTSPOT_NOTE);
  });

  it('leave the public screenshot and hotspot otherwise whole', () => {
    const [shot] =
      PublicProfileResponseDto.fromRecord(record).works[0].screenshots;

    expect(shot).toEqual({
      key: 'shot0001',
      url: 'https://example.com/board.png',
      caption: 'The board',
      hotspots: [
        { key: 'hot00001', label: 'Export button', x: 80, y: 4, w: 12, h: 6 },
      ],
    });
  });

  it('still reach the owner through GET /profiles/me', () => {
    const dto = ProfileDataResponseDto.fromRecord(record);

    expect(dto.works[0].screenshots[0].hotspots[0].note).toBe(HOTSPOT_NOTE);
  });

  it('copy the rest of a public work, stages included, unchanged', () => {
    const work: WorkEntry = {
      ...aWorkWithAHotspot(),
      screenshots: [],
      technologies: ['NestJS'],
      stages: [
        {
          key: 'stage001',
          label: 'GA',
          status: 'completed',
          summary: 'Shipped.',
          detail: 'The long version.',
          date: '2024-06',
          endDate: null,
          highlights: ['500 teams'],
        },
      ],
    };

    const dto = PublicProfileResponseDto.fromRecord(
      aProfile({ works: [work] }),
    );

    expect(dto.works).toEqual([work]);
  });
});
