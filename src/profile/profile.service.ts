import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import * as bcrypt from 'bcrypt';
import { PDFParse } from 'pdf-parse';

import { LlmService } from '../llm/llm.service';

import { PROFILE_REPOSITORY } from './domain/profile-repository.interface';
import type { IProfileRepository } from './domain/profile-repository.interface';
import {
  ProfileVisibility,
  EntityType,
  LlmProvider,
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
import { PublicProfileResponseDto } from './dto/public-profile-response.dto';
import {
  ResumeUploadResponseDto,
  ResumeSuggestionsDto,
} from './dto/resume-upload-response.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsernameAvailabilityDto } from './dto/username-availability.dto';
import { checkUsernameRule } from './domain/username.rules';
import { toUploadUrl } from './upload/upload.config';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Profile CRUD ──────────────────────────────────────────────────────────

  async createProfile(
    userId: string,
    dto: CreateProfileDto,
  ): Promise<ProfileDataResponseDto> {
    this.logger.debug(
      `createProfile: start (userId=${userId}, username=${dto.username})`,
    );
    if (await this.profileRepository.existsByUserId(userId)) {
      this.logger.warn(
        `createProfile: profile already exists (userId=${userId})`,
      );
      throw new ConflictException('A profile already exists for this account.');
    }

    const slug = dto.username.toLowerCase();
    if (
      checkUsernameRule(slug) !== null ||
      (await this.profileRepository.existsByUsername(slug))
    ) {
      this.logger.warn(`createProfile: username unavailable (${slug})`);
      throw new ConflictException('That username is not available.');
    }

    let protectedPassword: string | null = null;
    if (dto.visibility === ProfileVisibility.PROTECTED) {
      if (!dto.protectedPassword) {
        this.logger.warn(
          `createProfile: protectedPassword missing for PROTECTED visibility (userId=${userId})`,
        );
        throw new ConflictException(
          'protectedPassword is required when visibility is PROTECTED.',
        );
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

    this.logger.log(
      `createProfile: created (profileId=${record.id}, username=${slug}, userId=${userId})`,
    );
    return ProfileDataResponseDto.fromRecord(record);
  }

  /**
   * Reports whether a username can be claimed. Public — callable before a
   * profile exists. Returns a structured reason so the client can render the
   * right message rather than a generic "not available".
   *
   * A malformed candidate returns `available: false, reason: 'invalid'` rather
   * than throwing: a half-typed username during live validation is an expected
   * state, not a client error.
   */
  async checkUsernameAvailability(
    raw: string,
  ): Promise<UsernameAvailabilityDto> {
    const slug = (raw ?? '').trim().toLowerCase();
    const ruleFailure = checkUsernameRule(slug);
    if (ruleFailure !== null) {
      return { available: false, reason: ruleFailure };
    }
    const taken = await this.profileRepository.existsByUsername(slug);
    return taken
      ? { available: false, reason: 'taken' }
      : { available: true, reason: null };
  }

  // ─── Public profile view ─────────────────────────────────────────────────────

  /**
   * Fetch a profile for an anonymous visitor.
   *
   * - `public`    → the allowlisted public DTO.
   * - `private`   → 404. Not 403: a private profile is invisible, not a visibly
   *                 locked door. 404 is indistinguishable from "no such user".
   * - `protected` → 401 with `{ protected: true }` and NO body. The client shows
   *                 a password gate and calls `unlockPublicProfile`.
   */
  async getPublicProfile(
    rawUsername: string,
  ): Promise<PublicProfileResponseDto> {
    const record = await this.findPublicCandidate(rawUsername);

    if (record.visibility === ProfileVisibility.PROTECTED) {
      throw new UnauthorizedException({
        protected: true,
        message: 'This profile is password-protected.',
      });
    }
    return PublicProfileResponseDto.fromRecord(record);
  }

  /**
   * Exchange a password for a protected profile's public body.
   * Wrong password → 401. Non-protected profiles ignore the password and return
   * normally, so the client can call this uniformly.
   */
  async unlockPublicProfile(
    rawUsername: string,
    password: string,
  ): Promise<PublicProfileResponseDto> {
    const record = await this.findPublicCandidate(rawUsername);

    if (record.visibility === ProfileVisibility.PROTECTED) {
      const hash = await this.profileRepository.getProtectedPasswordHash(
        record.username,
      );
      const ok = hash ? await bcrypt.compare(password ?? '', hash) : false;
      if (!ok) {
        throw new UnauthorizedException({
          protected: true,
          message: 'Incorrect password.',
        });
      }
    }
    return PublicProfileResponseDto.fromRecord(record);
  }

  /**
   * Shared lookup for the public routes. Collapses "no such username" and
   * "exists but private" into a single 404 so neither leaks the other.
   */
  private async findPublicCandidate(rawUsername: string) {
    const slug = (rawUsername ?? '').trim().toLowerCase();
    const record = await this.profileRepository.findByUsername(slug);
    if (!record || record.visibility === ProfileVisibility.PRIVATE) {
      throw new NotFoundException('Profile not found.');
    }
    return record;
  }

  async getProfileData(userId: string): Promise<ProfileDataResponseDto> {
    this.logger.debug(`getProfileData: lookup (userId=${userId})`);
    const record = await this.profileRepository.findByUserId(userId);
    if (!record) {
      this.logger.warn(`getProfileData: profile not found (userId=${userId})`);
      throw new NotFoundException('Profile not found.');
    }
    return ProfileDataResponseDto.fromRecord(record);
  }

  async updateProfile(
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileDataResponseDto> {
    this.logger.debug(`updateProfile: start (profileId=${profileId})`);
    const fields: Record<string, unknown> = {};

    const {
      identity,
      works,
      timeline,
      capabilities,
      offerings,
      metrics,
      testimonials,
      team,
      media,
      content,
      social,
      aiSettings,
      agentPersona,
      visibility,
    } = dto;

    if (identity) {
      if (identity.entityType !== undefined)
        fields['identity.entityType'] = identity.entityType;
      if (identity.name !== undefined) fields['identity.name'] = identity.name;
      if (identity.tagline !== undefined)
        fields['identity.tagline'] = identity.tagline ?? null;
      if (identity.bio !== undefined)
        fields['identity.bio'] = identity.bio ?? null;
      if (identity.about !== undefined)
        fields['identity.about'] = identity.about ?? null;
      if (identity.primaryImage !== undefined)
        fields['identity.primaryImage'] = identity.primaryImage ?? null;
      if (identity.coverImage !== undefined)
        fields['identity.coverImage'] = identity.coverImage ?? null;
      if (identity.location !== undefined)
        fields['identity.location'] = identity.location ?? null;
      if (identity.foundedOrBorn !== undefined)
        fields['identity.foundedOrBorn'] = identity.foundedOrBorn ?? null;
      if (identity.industry !== undefined)
        fields['identity.industry'] = identity.industry ?? null;
      if (identity.availability !== undefined)
        fields['identity.availability'] = identity.availability ?? null;
    }

    if (works !== undefined) fields['works'] = this.buildWorks(works);
    if (timeline !== undefined)
      fields['timeline'] = this.buildTimeline(timeline);
    if (capabilities !== undefined)
      fields['capabilities'] = this.buildCapabilities(capabilities);
    if (offerings !== undefined)
      fields['offerings'] = this.buildOfferings(offerings);
    if (metrics !== undefined) fields['metrics'] = this.buildMetrics(metrics);
    if (testimonials !== undefined)
      fields['testimonials'] = this.buildTestimonials(testimonials);
    if (team !== undefined) fields['team'] = this.buildTeam(team);
    if (media !== undefined) fields['media'] = this.buildMedia(media);
    if (content !== undefined) fields['content'] = this.buildContent(content);

    if (social) {
      if (social.links !== undefined)
        fields['social.links'] = social.links.map((l) => ({
          platform: l.platform,
          url: l.url,
          label: l.label ?? null,
        }));
      if (social.email !== undefined)
        fields['social.email'] = social.email ?? null;
      if (social.phone !== undefined)
        fields['social.phone'] = social.phone ?? null;
      if (social.calendarUrl !== undefined)
        fields['social.calendarUrl'] = social.calendarUrl ?? null;
    }

    if (aiSettings) {
      fields['aiSettings.provider'] = aiSettings.provider;
      if (aiSettings.apiKey !== undefined)
        fields['aiSettings.apiKey'] = aiSettings.apiKey ?? null;
      if (aiSettings.model !== undefined)
        fields['aiSettings.model'] = aiSettings.model ?? null;
      if (aiSettings.baseUrl !== undefined)
        fields['aiSettings.baseUrl'] = aiSettings.baseUrl ?? null;
    }

    if (agentPersona) {
      if (agentPersona.agentName !== undefined)
        fields['agentPersona.agentName'] = agentPersona.agentName;
      if (agentPersona.tone !== undefined)
        fields['agentPersona.tone'] = agentPersona.tone;
      if (agentPersona.verbosity !== undefined)
        fields['agentPersona.verbosity'] = agentPersona.verbosity;
      if (agentPersona.technicalDepth !== undefined)
        fields['agentPersona.technicalDepth'] = agentPersona.technicalDepth;
      if (agentPersona.speakingSpeed !== undefined)
        fields['agentPersona.speakingSpeed'] = agentPersona.speakingSpeed;
      if (agentPersona.voiceId !== undefined)
        fields['agentPersona.voiceId'] = agentPersona.voiceId ?? null;
    }

    if (visibility) {
      fields['visibility'] = visibility.visibility;
      fields['protectedPassword'] =
        visibility.visibility === ProfileVisibility.PROTECTED &&
        visibility.protectedPassword
          ? await bcrypt.hash(visibility.protectedPassword, 10)
          : null;
    }

    // Log the section paths being written (never the values — this may include
    // 'protectedPassword' / 'aiSettings.apiKey' keys, whose values stay redacted).
    this.logger.debug(
      `updateProfile: writing ${Object.keys(fields).length} field(s): [${Object.keys(fields).join(', ')}]`,
    );
    const record = await this.profileRepository.update(profileId, fields);
    this.logger.log(`updateProfile: updated (profileId=${profileId})`);
    return ProfileDataResponseDto.fromRecord(record);
  }

  // Below this length the PDF almost certainly yielded no real text (a scanned or
  // image-only resume). Not worth an LLM call that would extract nothing.
  private static readonly MIN_RESUME_TEXT = 200;
  private static readonly MAX_PARSED_TEXT = 20000;

  /**
   * Store an uploaded resume and, best-effort, extract structured suggestions.
   *
   * Two stages, independently fallible:
   *  1. Text extraction (pdf-parse) → persisted to `identity.resume.parsedText`.
   *     Useful on its own (the agent can read it), so it stands even if stage 2 fails.
   *  2. Structured extraction (LLM) → returned as `suggestions` for the user to
   *     review. NEVER written to the profile here: a model's guess about someone's
   *     career is a draft to confirm, not a fact to publish.
   *
   * `suggestions` is null whenever extraction is unavailable or unproductive.
   */
  async uploadResume(
    profileId: string,
    file: Express.Multer.File,
  ): Promise<ResumeUploadResponseDto> {
    this.logger.debug(
      `uploadResume: storing resume (profileId=${profileId}, file=${file.filename})`,
    );

    const parsedText = await this.extractResumeText(file);

    const record = await this.profileRepository.update(profileId, {
      'identity.resume.url': toUploadUrl('resumes', file.filename),
      'identity.resume.parsedText': parsedText,
    });
    this.logger.log(
      `uploadResume: resume saved (profileId=${profileId}, textChars=${parsedText?.length ?? 0})`,
    );

    const suggestions = await this.buildResumeSuggestions(parsedText);

    return {
      profile: ProfileDataResponseDto.fromRecord(record),
      suggestions,
    };
  }

  /** pdf-parse the uploaded file from disk. Returns null on any extraction failure. */
  private async extractResumeText(
    file: Express.Multer.File,
  ): Promise<string | null> {
    try {
      const buffer = await readFile(file.path);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const text = result.text.trim();
        return text ? text.slice(0, ProfileService.MAX_PARSED_TEXT) : null;
      } finally {
        await parser.destroy();
      }
    } catch (err) {
      this.logger.warn(
        `extractResumeText: could not read PDF — ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Run structured extraction using a PLATFORM LLM key (from env), not the
   * user's — a new user in onboarding has no key configured, and it is not the
   * platform's to spend on their behalf without one. Absent config → null, so
   * the feature degrades to "type it yourself" instead of erroring.
   */
  private async buildResumeSuggestions(
    parsedText: string | null,
  ): Promise<ResumeSuggestionsDto | null> {
    if (!parsedText || parsedText.length < ProfileService.MIN_RESUME_TEXT)
      return null;

    const settings = this.platformLlmSettings();
    if (!settings) return null;

    const extraction = await this.llmService.extractResume(
      parsedText,
      settings,
    );
    return extraction ? ResumeSuggestionsDto.fromExtraction(extraction) : null;
  }

  /** Platform extraction credentials from env, or null when unconfigured. */
  private platformLlmSettings(): AiSettingsSection | null {
    const apiKey = this.configService.get<string>('RESUME_LLM_API_KEY');
    if (!apiKey) return null;

    const providerRaw = this.configService.get<string>('RESUME_LLM_PROVIDER');
    const provider = Object.values(LlmProvider).includes(
      providerRaw as LlmProvider,
    )
      ? (providerRaw as LlmProvider)
      : LlmProvider.OPENAI;

    return {
      provider,
      apiKey,
      model: this.configService.get<string>('RESUME_LLM_MODEL') ?? null,
      baseUrl: this.configService.get<string>('RESUME_LLM_BASE_URL') ?? null,
    };
  }

  async uploadProfileImage(
    profileId: string,
    file: Express.Multer.File,
  ): Promise<ProfileDataResponseDto> {
    this.logger.debug(
      `uploadProfileImage: storing image (profileId=${profileId}, file=${file.filename})`,
    );
    const record = await this.profileRepository.update(profileId, {
      'identity.primaryImage': toUploadUrl('profile-images', file.filename),
    });
    this.logger.log(`uploadProfileImage: image saved (profileId=${profileId})`);
    return ProfileDataResponseDto.fromRecord(record);
  }

  async deleteProfile(userId: string): Promise<void> {
    this.logger.debug(`deleteProfile: start (userId=${userId})`);
    const exists = await this.profileRepository.existsByUserId(userId);
    if (!exists) {
      this.logger.warn(`deleteProfile: profile not found (userId=${userId})`);
      throw new NotFoundException('Profile not found.');
    }
    await this.profileRepository.deleteByUserId(userId);
    this.logger.log(`deleteProfile: deleted (userId=${userId})`);
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
    return (dto ?? []).map((w) => ({
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
    }));
  }

  private buildTimeline(dto: CreateProfileDto['timeline']): TimelineEntry[] {
    return (dto ?? []).map((t) => ({
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

  private buildCapabilities(
    dto: CreateProfileDto['capabilities'],
  ): CapabilityEntry[] {
    return (dto ?? []).map((c) => ({
      name: c.name,
      description: c.description ?? null,
      icon: c.icon ?? null,
      category: c.category ?? null,
      proficiency: c.proficiency ?? null,
      yearsOfExperience: c.yearsOfExperience ?? null,
    }));
  }

  private buildOfferings(dto: CreateProfileDto['offerings']): OfferingEntry[] {
    return (dto ?? []).map((o) => ({
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
    return (dto ?? []).map((m) => ({
      value: m.value,
      label: m.label,
      description: m.description ?? null,
      icon: m.icon ?? null,
      category: m.category ?? null,
    }));
  }

  private buildTestimonials(
    dto: CreateProfileDto['testimonials'],
  ): TestimonialEntry[] {
    return (dto ?? []).map((t) => ({
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
    return (dto ?? []).map((m) => ({
      name: m.name,
      role: m.role,
      bio: m.bio ?? null,
      avatarUrl: m.avatarUrl ?? null,
      links: (m.links ?? []).map((l) => ({ platform: l.platform, url: l.url })),
    }));
  }

  private buildMedia(dto: CreateProfileDto['media']): MediaEntry[] {
    return (dto ?? []).map((m) => ({
      url: m.url,
      caption: m.caption ?? null,
      type: m.type,
      category: m.category ?? null,
    }));
  }

  private buildContent(dto: CreateProfileDto['content']): ContentEntry[] {
    return (dto ?? []).map((c) => ({
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
      links: (dto?.links ?? []).map((l) => ({
        platform: l.platform,
        url: l.url,
        label: l.label ?? null,
      })),
      email: dto?.email ?? null,
      phone: dto?.phone ?? null,
      calendarUrl: dto?.calendarUrl ?? null,
    };
  }

  private buildAiSettings(
    dto: CreateProfileDto['aiSettings'],
  ): AiSettingsSection {
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
