import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PROFILE_REPOSITORY } from './domain/profile-repository.interface';
import type { IProfileRepository } from './domain/profile-repository.interface';
import {
  ProfileVisibility,
  EntityType,
  AgentTone,
  AgentVerbosity,
  AgentTechnicalDepth,
  AgentSpeakingSpeed,
  type IdentitySection,
  type WorkEntry,
  type TimelineEntry,
  type CapabilityEntry,
  type OfferingEntry,
  type MetricEntry,
  type TestimonialEntry,
  type TeamMemberEntry,
  type MediaEntry,
  type ContentEntry,
  type SocialSection,
  type AiSettingsSection,
  type AgentPersonaSection,
} from './domain/profile.interface';

import { ProfileDataResponseDto } from './dto/profile-data-response.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toUploadUrl } from './upload/upload.config';

// ─── Reserved usernames ───────────────────────────────────────────────────────
const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'auth', 'app', 'settings', 'dashboard', 'login',
  'register', 'signup', 'logout', 'profile', 'user', 'users', 'health',
  'me', 'static', 'public', 'private', 'support', 'help', 'about',
  'contact', 'terms', 'privacy',
]);

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profileRepository: IProfileRepository,
  ) {}

  // ─── Profile CRUD ──────────────────────────────────────────────────────────

  async createProfile(userId: string, dto: CreateProfileDto): Promise<ProfileDataResponseDto> {
    if (await this.profileRepository.existsByUserId(userId)) {
      throw new ConflictException('A profile already exists for this account.');
    }

    const slug = dto.username.toLowerCase();
    if (RESERVED_USERNAMES.has(slug) || await this.profileRepository.existsByUsername(slug)) {
      throw new ConflictException('That username is not available.');
    }

    let protectedPassword: string | null = null;
    if (dto.visibility === ProfileVisibility.PROTECTED) {
      if (!dto.protectedPassword) {
        throw new ConflictException('protectedPassword is required when visibility is PROTECTED.');
      }
      protectedPassword = await bcrypt.hash(dto.protectedPassword, 10);
    }

    const record = await this.profileRepository.create({
      userId,
      username: slug,
      visibility: dto.visibility ?? ProfileVisibility.PUBLIC,
      protectedPassword,
      identity: this.buildIdentity(dto.identity),
      works: this.buildWorks(dto.works),
      timeline: this.buildTimeline(dto.timeline),
      capabilities: this.buildCapabilities(dto.capabilities),
      offerings: this.buildOfferings(dto.offerings),
      metrics: this.buildMetrics(dto.metrics),
      testimonials: this.buildTestimonials(dto.testimonials),
      team: this.buildTeam(dto.team),
      media: this.buildMedia(dto.media),
      content: this.buildContent(dto.content),
      social: this.buildSocial(dto.social),
      aiSettings: this.buildAiSettings(dto.aiSettings),
      agentPersona: this.buildAgentPersona(),
    });

    return ProfileDataResponseDto.fromRecord(record);
  }

  async getProfileData(userId: string): Promise<ProfileDataResponseDto> {
    const record = await this.profileRepository.findByUserId(userId);
    if (!record) throw new NotFoundException('Profile not found.');
    return ProfileDataResponseDto.fromRecord(record);
  }

  async updateProfile(profileId: string, dto: UpdateProfileDto): Promise<ProfileDataResponseDto> {
    const fields: Record<string, unknown> = {};

    const { identity, works, timeline, capabilities, offerings, metrics, testimonials, team, media, content, social, aiSettings, agentPersona, visibility } = dto;

    if (identity) {
      if (identity.entityType !== undefined) fields['identity.entityType'] = identity.entityType;
      if (identity.name !== undefined) fields['identity.name'] = identity.name;
      if (identity.tagline !== undefined) fields['identity.tagline'] = identity.tagline ?? null;
      if (identity.bio !== undefined) fields['identity.bio'] = identity.bio ?? null;
      if (identity.about !== undefined) fields['identity.about'] = identity.about ?? null;
      if (identity.primaryImage !== undefined) fields['identity.primaryImage'] = identity.primaryImage ?? null;
      if (identity.coverImage !== undefined) fields['identity.coverImage'] = identity.coverImage ?? null;
      if (identity.location !== undefined) fields['identity.location'] = identity.location ?? null;
      if (identity.foundedOrBorn !== undefined) fields['identity.foundedOrBorn'] = identity.foundedOrBorn ?? null;
      if (identity.industry !== undefined) fields['identity.industry'] = identity.industry ?? null;
      if (identity.availability !== undefined) fields['identity.availability'] = identity.availability ?? null;
    }

    if (works !== undefined) fields['works'] = this.buildWorks(works);
    if (timeline !== undefined) fields['timeline'] = this.buildTimeline(timeline);
    if (capabilities !== undefined) fields['capabilities'] = this.buildCapabilities(capabilities);
    if (offerings !== undefined) fields['offerings'] = this.buildOfferings(offerings);
    if (metrics !== undefined) fields['metrics'] = this.buildMetrics(metrics);
    if (testimonials !== undefined) fields['testimonials'] = this.buildTestimonials(testimonials);
    if (team !== undefined) fields['team'] = this.buildTeam(team);
    if (media !== undefined) fields['media'] = this.buildMedia(media);
    if (content !== undefined) fields['content'] = this.buildContent(content);

    if (social) {
      if (social.links !== undefined) fields['social.links'] = social.links.map(l => ({ platform: l.platform, url: l.url, label: l.label ?? null }));
      if (social.email !== undefined) fields['social.email'] = social.email ?? null;
      if (social.phone !== undefined) fields['social.phone'] = social.phone ?? null;
      if (social.calendarUrl !== undefined) fields['social.calendarUrl'] = social.calendarUrl ?? null;
    }

    if (aiSettings) {
      fields['aiSettings.provider'] = aiSettings.provider;
      if (aiSettings.apiKey !== undefined) fields['aiSettings.apiKey'] = aiSettings.apiKey ?? null;
      if (aiSettings.model !== undefined) fields['aiSettings.model'] = aiSettings.model ?? null;
      if (aiSettings.baseUrl !== undefined) fields['aiSettings.baseUrl'] = aiSettings.baseUrl ?? null;
    }

    if (agentPersona) {
      if (agentPersona.agentName !== undefined) fields['agentPersona.agentName'] = agentPersona.agentName;
      if (agentPersona.tone !== undefined) fields['agentPersona.tone'] = agentPersona.tone;
      if (agentPersona.verbosity !== undefined) fields['agentPersona.verbosity'] = agentPersona.verbosity;
      if (agentPersona.technicalDepth !== undefined) fields['agentPersona.technicalDepth'] = agentPersona.technicalDepth;
      if (agentPersona.speakingSpeed !== undefined) fields['agentPersona.speakingSpeed'] = agentPersona.speakingSpeed;
      if (agentPersona.voiceId !== undefined) fields['agentPersona.voiceId'] = agentPersona.voiceId ?? null;
    }

    if (visibility) {
      fields['visibility'] = visibility.visibility;
      fields['protectedPassword'] = visibility.visibility === ProfileVisibility.PROTECTED && visibility.protectedPassword
        ? await bcrypt.hash(visibility.protectedPassword, 10)
        : null;
    }

    const record = await this.profileRepository.update(profileId, fields);
    return ProfileDataResponseDto.fromRecord(record);
  }

  async uploadResume(profileId: string, file: Express.Multer.File): Promise<ProfileDataResponseDto> {
    const record = await this.profileRepository.update(profileId, {
      'identity.resume.url': toUploadUrl('resumes', file.filename),
    });
    return ProfileDataResponseDto.fromRecord(record);
  }

  async uploadProfileImage(profileId: string, file: Express.Multer.File): Promise<ProfileDataResponseDto> {
    const record = await this.profileRepository.update(profileId, {
      'identity.primaryImage': toUploadUrl('profile-images', file.filename),
    });
    return ProfileDataResponseDto.fromRecord(record);
  }

  async deleteProfile(userId: string): Promise<void> {
    const exists = await this.profileRepository.existsByUserId(userId);
    if (!exists) throw new NotFoundException('Profile not found.');
    await this.profileRepository.deleteByUserId(userId);
  }

  // ─── Private section builders ──────────────────────────────────────────────

  private buildIdentity(dto: CreateProfileDto['identity']): IdentitySection {
    return {
      entityType: dto.entityType ?? EntityType.INDIVIDUAL,
      name: dto.name,
      tagline: dto.tagline ?? null,
      bio: dto.bio ?? null,
      about: dto.about ?? null,
      primaryImage: null,
      coverImage: dto.coverImage ?? null,
      location: dto.location ?? null,
      foundedOrBorn: dto.foundedOrBorn ?? null,
      industry: dto.industry ?? null,
      availability: dto.availability ?? null,
      resume: { url: null, parsedText: null },
    };
  }

  private buildWorks(dto: CreateProfileDto['works']): WorkEntry[] {
    return (dto ?? []).map(w => ({
      type: w.type,
      name: w.name,
      tagline: w.tagline ?? null,
      description: w.description ?? '',
      url: w.url ?? null,
      repoUrl: w.repoUrl ?? null,
      coverImage: w.coverImage ?? null,
      screenshots: (w.screenshots ?? []).map(s => ({ url: s.url, caption: s.caption ?? null })),
      technologies: w.technologies ?? [],
      tags: w.tags ?? [],
      status: w.status ?? 'completed',
      highlights: w.highlights ?? [],
      featured: w.featured ?? false,
      codeSnippets: (w.codeSnippets ?? []).map(c => ({ language: c.language, code: c.code, description: c.description ?? null })),
      date: w.date ?? null,
    }));
  }

  private buildTimeline(dto: CreateProfileDto['timeline']): TimelineEntry[] {
    return (dto ?? []).map(t => ({
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

  private buildCapabilities(dto: CreateProfileDto['capabilities']): CapabilityEntry[] {
    return (dto ?? []).map(c => ({
      name: c.name,
      description: c.description ?? null,
      icon: c.icon ?? null,
      category: c.category ?? null,
      proficiency: c.proficiency ?? null,
      yearsOfExperience: c.yearsOfExperience ?? null,
    }));
  }

  private buildOfferings(dto: CreateProfileDto['offerings']): OfferingEntry[] {
    return (dto ?? []).map(o => ({
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

  private buildMetrics(dto: CreateProfileDto['metrics']): MetricEntry[] {
    return (dto ?? []).map(m => ({
      value: m.value,
      label: m.label,
      description: m.description ?? null,
      icon: m.icon ?? null,
      category: m.category ?? null,
    }));
  }

  private buildTestimonials(dto: CreateProfileDto['testimonials']): TestimonialEntry[] {
    return (dto ?? []).map(t => ({
      text: t.text,
      author: t.author,
      role: t.role ?? null,
      organization: t.organization ?? null,
      avatarUrl: t.avatarUrl ?? null,
      relationship: t.relationship,
      featured: t.featured ?? false,
    }));
  }

  private buildTeam(dto: CreateProfileDto['team']): TeamMemberEntry[] {
    return (dto ?? []).map(m => ({
      name: m.name,
      role: m.role,
      bio: m.bio ?? null,
      avatarUrl: m.avatarUrl ?? null,
      links: (m.links ?? []).map(l => ({ platform: l.platform, url: l.url })),
    }));
  }

  private buildMedia(dto: CreateProfileDto['media']): MediaEntry[] {
    return (dto ?? []).map(m => ({
      url: m.url,
      caption: m.caption ?? null,
      type: m.type,
      category: m.category ?? null,
    }));
  }

  private buildContent(dto: CreateProfileDto['content']): ContentEntry[] {
    return (dto ?? []).map(c => ({
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

  private buildSocial(dto: CreateProfileDto['social']): SocialSection {
    return {
      links: (dto?.links ?? []).map(l => ({ platform: l.platform, url: l.url, label: l.label ?? null })),
      email: dto?.email ?? null,
      phone: dto?.phone ?? null,
      calendarUrl: dto?.calendarUrl ?? null,
    };
  }

  private buildAiSettings(dto: CreateProfileDto['aiSettings']): AiSettingsSection {
    return {
      provider: dto?.provider ?? ('openai' as AiSettingsSection['provider']),
      apiKey: dto?.apiKey ?? null,
      model: dto?.model ?? null,
      baseUrl: dto?.baseUrl ?? null,
    };
  }

  private buildAgentPersona(): AgentPersonaSection {
    return {
      agentName: 'Alex',
      tone: AgentTone.BALANCED,
      verbosity: AgentVerbosity.CONCISE,
      technicalDepth: AgentTechnicalDepth.MEDIUM,
      speakingSpeed: AgentSpeakingSpeed.NORMAL,
      voiceId: null,
    };
  }
}
