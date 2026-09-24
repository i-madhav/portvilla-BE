import {
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  EntityType,
  LlmProvider,
  ProfileVisibility,
  type IProfileRecord,
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
