import { NotFoundException } from '@nestjs/common';

import {
  AgentSpeakingSpeed,
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  EntityType,
  LlmProvider,
  ProfileVisibility,
  WorkType,
  type IProfileRecord,
  type WorkEntry,
} from '../profile/domain/profile.interface';
import type { IProfileRepository } from '../profile/domain/profile-repository.interface';
import { SlideTemplate } from '../profile/domain/slide';

import { AgentService } from './agent.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * A profile with every secret populated.
 *
 * The secrets are the point: the allowlist tests below prove nothing if the
 * fields they check for are null in the fixture.
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
      tagline: 'Builds things',
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
      model: 'gpt-secret',
      baseUrl: 'https://SECRET-BASE-URL.example.com',
    },
    agentPersona: {
      agentName: 'Alex',
      tone: AgentTone.CASUAL,
      verbosity: AgentVerbosity.DETAILED,
      technicalDepth: AgentTechnicalDepth.HIGH,
      speakingSpeed: AgentSpeakingSpeed.FAST,
      voiceId: 'voice-9',
    },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function aWork(overrides: Partial<WorkEntry> = {}): WorkEntry {
  return {
    key: 'aaaaaaaa',
    type: WorkType.PRODUCT,
    name: 'Atlas',
    tagline: null,
    description: 'A mapping tool.',
    url: null,
    repoUrl: null,
    coverImage: null,
    screenshots: [],
    technologies: [],
    tags: [],
    status: 'active',
    highlights: [],
    featured: false,
    codeSnippets: [],
    date: null,
    stages: [],
    ...overrides,
  };
}

/** A repository holding exactly one profile, addressed by username. */
function repositoryWith(record: IProfileRecord | null): IProfileRepository {
  return {
    findByUsername: (username: string) =>
      Promise.resolve(record && record.username === username ? record : null),
  } as unknown as IProfileRepository;
}

function serviceFor(record: IProfileRecord | null): AgentService {
  return new AgentService(repositoryWith(record));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentService.getContext', () => {
  describe('visibility', () => {
    it('serves a public profile', async () => {
      const context = await serviceFor(aProfile()).getContext('jane');
      expect(context.username).toBe('jane');
    });

    it.each([
      ['private', ProfileVisibility.PRIVATE],
      // A protected profile has no agent: the worker holds no proof the visitor
      // passed the password gate, so narrating it would be a way around it.
      ['protected', ProfileVisibility.PROTECTED],
    ])('404s a %s profile', async (_label, visibility) => {
      await expect(
        serviceFor(aProfile({ visibility })).getContext('jane'),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s an unknown username with the same message, leaking neither case', async () => {
      const unknown = serviceFor(null)
        .getContext('nobody')
        .catch((e: Error) => e.message);
      const hidden = serviceFor(
        aProfile({ visibility: ProfileVisibility.PRIVATE }),
      )
        .getContext('jane')
        .catch((e: Error) => e.message);

      expect(await unknown).toBe(await hidden);
    });
  });

  describe('lookup', () => {
    it('trims and lowercases the username, as the public route does', async () => {
      const service = serviceFor(aProfile());
      await expect(service.getContext('  JANE  ')).resolves.toMatchObject({
        username: 'jane',
      });
    });
  });

  describe('response', () => {
    it('carries the persona the worker needs to speak', async () => {
      const context = await serviceFor(aProfile()).getContext('jane');

      expect(context.persona).toEqual({
        agentName: 'Alex',
        tone: AgentTone.CASUAL,
        verbosity: AgentVerbosity.DETAILED,
        technicalDepth: AgentTechnicalDepth.HIGH,
        speakingSpeed: AgentSpeakingSpeed.FAST,
        voiceId: 'voice-9',
      });
    });

    it('carries the derived catalog, works followed by their own stages', async () => {
      const work = aWork({
        stages: [
          {
            key: 'bbbbbbbb',
            label: 'Private beta',
            status: 'completed',
            summary: 'Fifty teams, invite only.',
            detail: 'The invite list came from the waitlist.',
            date: null,
            endDate: null,
            highlights: [],
          },
        ],
      });
      const context = await serviceFor(aProfile({ works: [work] })).getContext(
        'jane',
      );

      expect(context.slides.map((s) => s.id)).toEqual([
        'identity',
        'work:aaaaaaaa',
        'work:aaaaaaaa:stage:bbbbbbbb',
      ]);
      expect(context.slides[2].template).toBe(SlideTemplate.WORK_STAGE);
      expect(context.slides[2].talkTrack).toEqual({
        summary: 'Fifty teams, invite only.',
        detail: 'The invite list came from the waitlist.',
      });
    });

    /**
     * The allowlist test. This response leaves the process, so the assertion is
     * over the whole serialized body rather than a field list — a section added
     * to the DTO later cannot smuggle a secret past it.
     */
    it.each([
      ['the provider API key', 'SECRET-API-KEY'],
      ['the LLM base url', 'SECRET-BASE-URL'],
      ['the resume url', 'SECRET-RESUME.pdf'],
      ['the parsed resume text', 'SECRET-RESUME-TEXT'],
      ['the owner email', 'SECRET-EMAIL'],
      ['the owner phone', 'SECRET-PHONE'],
    ])('never serves %s', async (_label, secret) => {
      const context = await serviceFor(
        aProfile({ works: [aWork()] }),
      ).getContext('jane');

      expect(JSON.stringify(context)).not.toContain(secret);
    });

    it('serves the catalog and persona, and nothing else at the top level', async () => {
      const context = await serviceFor(aProfile()).getContext('jane');

      expect(Object.keys(context).sort()).toEqual([
        'persona',
        'slides',
        'username',
      ]);
    });
  });
});
