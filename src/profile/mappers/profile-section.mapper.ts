import {
  AgentSpeakingSpeed,
  AgentTechnicalDepth,
  AgentTone,
  AgentVerbosity,
  EntityType,
  LlmProvider,
} from '../domain/profile.interface';
import type {
  AgentPersonaSection,
  AiSettingsSection,
  CapabilityEntry,
  ContentEntry,
  EntryInput,
  IdentitySection,
  MediaEntry,
  MetricEntry,
  OfferingEntry,
  SocialSection,
  StageEntry,
  TeamMemberEntry,
  TestimonialEntry,
  TimelineEntry,
  WorkEntryInput,
} from '../domain/profile.interface';

import { IdentityDto } from '../dto/sections/identity.dto';
import { CapabilityEntryDto } from '../dto/sections/capabilities.dto';
import { ContentEntryDto } from '../dto/sections/content.dto';
import { MediaEntryDto } from '../dto/sections/media.dto';
import { MetricEntryDto } from '../dto/sections/metrics.dto';
import { OfferingEntryDto } from '../dto/sections/offerings.dto';
import { SocialDto } from '../dto/sections/social.dto';
import { TeamMemberEntryDto } from '../dto/sections/team.dto';
import { TestimonialEntryDto } from '../dto/sections/testimonials.dto';
import { TimelineEntryDto } from '../dto/sections/timeline.dto';
import { StageEntryDto, WorkEntryDto } from '../dto/sections/works.dto';
import { AiSettingsDto } from '../dto/update-ai-settings.dto';

/**
 * Wire shape → stored shape, for every profile section.
 *
 * Pure functions with no dependencies: each one fills the optional fields a
 * client may have omitted with the value the schema expects, and does nothing
 * else. `key` is passed straight through — the repository is what mints a
 * missing one, so nothing here has to care whether an entry is new.
 *
 * They live outside `ProfileService` because none of them needed anything from
 * it, and outside `domain/` because they know the DTO classes and `domain/` is
 * the layer that does not.
 */

export function toIdentitySection(dto: IdentityDto): IdentitySection {
  return {
    entityType: dto.entityType ?? EntityType.INDIVIDUAL,
    name: dto.name,
    tagline: dto.tagline ?? null,
    bio: dto.bio ?? null,
    about: dto.about ?? null,
    // Not taken from the DTO: the avatar is set only by the upload endpoint,
    // which stores a URL this server controls.
    primaryImage: null,
    coverImage: dto.coverImage ?? null,
    location: dto.location ?? null,
    foundedOrBorn: dto.foundedOrBorn ?? null,
    industry: dto.industry ?? null,
    availability: dto.availability ?? null,
    resume: { url: null, parsedText: null },
  };
}

export function toWorks(dto?: WorkEntryDto[]): WorkEntryInput[] {
  return (dto ?? []).map((w) => ({
    key: w.key,
    type: w.type,
    name: w.name,
    tagline: w.tagline ?? null,
    description: w.description ?? '',
    url: w.url ?? null,
    repoUrl: w.repoUrl ?? null,
    coverImage: w.coverImage ?? null,
    screenshots: (w.screenshots ?? []).map((s) => ({
      url: s.url,
      caption: s.caption ?? null,
    })),
    technologies: w.technologies ?? [],
    tags: w.tags ?? [],
    status: w.status ?? 'completed',
    highlights: w.highlights ?? [],
    featured: w.featured ?? false,
    codeSnippets: (w.codeSnippets ?? []).map((c) => ({
      language: c.language,
      code: c.code,
      description: c.description ?? null,
    })),
    date: w.date ?? null,
    stages: toStages(w.stages),
  }));
}

export function toStages(dto?: StageEntryDto[]): EntryInput<StageEntry>[] {
  return (dto ?? []).map((s) => ({
    key: s.key,
    label: s.label,
    status: s.status ?? 'completed',
    summary: s.summary,
    detail: s.detail ?? null,
    date: s.date ?? null,
    endDate: s.endDate ?? null,
    highlights: s.highlights ?? [],
  }));
}

export function toTimeline(
  dto?: TimelineEntryDto[],
): EntryInput<TimelineEntry>[] {
  return (dto ?? []).map((t) => ({
    key: t.key,
    category: t.category,
    date: t.date,
    endDate: t.endDate ?? null,
    label: t.label,
    organization: t.organization ?? null,
    organizationLogoUrl: t.organizationLogoUrl ?? null,
    description: t.description ?? null,
    highlight: t.highlight ?? false,
    url: t.url ?? null,
  }));
}

export function toCapabilities(
  dto?: CapabilityEntryDto[],
): EntryInput<CapabilityEntry>[] {
  return (dto ?? []).map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description ?? null,
    icon: c.icon ?? null,
    category: c.category ?? null,
    proficiency: c.proficiency ?? null,
    yearsOfExperience: c.yearsOfExperience ?? null,
  }));
}

export function toOfferings(
  dto?: OfferingEntryDto[],
): EntryInput<OfferingEntry>[] {
  return (dto ?? []).map((o) => ({
    key: o.key,
    name: o.name,
    description: o.description,
    icon: o.icon ?? null,
    price: o.price ?? null,
    features: o.features ?? [],
    highlighted: o.highlighted ?? false,
    tags: o.tags ?? [],
    cta: o.cta ? { label: o.cta.label, url: o.cta.url } : null,
  }));
}

export function toMetrics(dto?: MetricEntryDto[]): EntryInput<MetricEntry>[] {
  return (dto ?? []).map((m) => ({
    key: m.key,
    value: m.value,
    label: m.label,
    description: m.description ?? null,
    icon: m.icon ?? null,
    category: m.category ?? null,
  }));
}

export function toTestimonials(
  dto?: TestimonialEntryDto[],
): EntryInput<TestimonialEntry>[] {
  return (dto ?? []).map((t) => ({
    key: t.key,
    text: t.text,
    author: t.author,
    role: t.role ?? null,
    organization: t.organization ?? null,
    avatarUrl: t.avatarUrl ?? null,
    relationship: t.relationship,
    featured: t.featured ?? false,
  }));
}

export function toTeam(
  dto?: TeamMemberEntryDto[],
): EntryInput<TeamMemberEntry>[] {
  return (dto ?? []).map((m) => ({
    key: m.key,
    name: m.name,
    role: m.role,
    bio: m.bio ?? null,
    avatarUrl: m.avatarUrl ?? null,
    links: (m.links ?? []).map((l) => ({ platform: l.platform, url: l.url })),
  }));
}

export function toMedia(dto?: MediaEntryDto[]): EntryInput<MediaEntry>[] {
  return (dto ?? []).map((m) => ({
    key: m.key,
    url: m.url,
    caption: m.caption ?? null,
    type: m.type,
    category: m.category ?? null,
  }));
}

export function toContent(dto?: ContentEntryDto[]): EntryInput<ContentEntry>[] {
  return (dto ?? []).map((c) => ({
    key: c.key,
    type: c.type,
    title: c.title,
    url: c.url,
    description: c.description ?? null,
    thumbnailUrl: c.thumbnailUrl ?? null,
    date: c.date ?? null,
    tags: c.tags ?? [],
    featured: c.featured ?? false,
  }));
}

export function toSocialLinks(
  dto?: SocialDto['links'],
): SocialSection['links'] {
  return (dto ?? []).map((l) => ({
    platform: l.platform,
    url: l.url,
    label: l.label ?? null,
  }));
}

export function toSocialSection(dto?: SocialDto): SocialSection {
  return {
    links: toSocialLinks(dto?.links),
    email: dto?.email ?? null,
    phone: dto?.phone ?? null,
    calendarUrl: dto?.calendarUrl ?? null,
  };
}

export function toAiSettings(dto?: AiSettingsDto): AiSettingsSection {
  return {
    provider: dto?.provider ?? LlmProvider.OPENAI,
    apiKey: dto?.apiKey ?? null,
    model: dto?.model ?? null,
    baseUrl: dto?.baseUrl ?? null,
  };
}

/**
 * The persona a profile starts with. Not derived from any DTO — creation does
 * not accept persona fields, and the user tunes them later via `PATCH`.
 */
export function defaultAgentPersona(): AgentPersonaSection {
  return {
    agentName: 'Alex',
    tone: AgentTone.BALANCED,
    verbosity: AgentVerbosity.CONCISE,
    technicalDepth: AgentTechnicalDepth.MEDIUM,
    speakingSpeed: AgentSpeakingSpeed.NORMAL,
    voiceId: null,
  };
}
