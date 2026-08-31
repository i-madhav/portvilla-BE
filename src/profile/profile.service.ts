import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PROFILE_REPOSITORY } from './domain/profile-repository.interface';
import type { IProfileRepository } from './domain/profile-repository.interface';
import {
  ProfileVisibility,
  type IProfileRecord,
} from './domain/profile.interface';

import { ProfileDataResponseDto } from './dto/profile-data-response.dto';
import { PublicProfileResponseDto } from './dto/public-profile-response.dto';
import { ResumeUploadResponseDto } from './dto/resume-upload-response.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { UsernameAvailabilityDto } from './dto/username-availability.dto';
import { checkUsernameRule } from './domain/username.rules';
import {
  defaultAgentPersona,
  toAiSettings,
  toCapabilities,
  toContent,
  toIdentitySection,
  toMedia,
  toMetrics,
  toOfferings,
  toSocialSection,
  toTeam,
  toTestimonials,
  toTimeline,
  toWorks,
} from './mappers/profile-section.mapper';
import { toProfileUpdateFields } from './mappers/profile-update.mapper';
import { ResumeSuggestionsService } from './resume/resume-suggestions.service';
import { ResumeTextExtractor } from './resume/resume-text.extractor';
import { toUploadUrl } from './upload/upload.config';

/** Work factor for the password that gates a `protected` profile. */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    private readonly resumeTextExtractor: ResumeTextExtractor,
    private readonly resumeSuggestions: ResumeSuggestionsService,
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
      protectedPassword = await bcrypt.hash(
        dto.protectedPassword,
        BCRYPT_ROUNDS,
      );
    }

    const record = await this.profileRepository.create({
      userId,
      username: slug,
      visibility: dto.visibility ?? ProfileVisibility.PUBLIC,
      protectedPassword,
      identity: toIdentitySection(dto.identity),
      works: toWorks(dto.works),
      timeline: toTimeline(dto.timeline),
      capabilities: toCapabilities(dto.capabilities),
      offerings: toOfferings(dto.offerings),
      metrics: toMetrics(dto.metrics),
      testimonials: toTestimonials(dto.testimonials),
      team: toTeam(dto.team),
      media: toMedia(dto.media),
      content: toContent(dto.content),
      social: toSocialSection(dto.social),
      aiSettings: toAiSettings(dto.aiSettings),
      agentPersona: defaultAgentPersona(),
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
  private async findPublicCandidate(
    rawUsername: string,
  ): Promise<IProfileRecord> {
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

    const fields = toProfileUpdateFields(dto);
    if (dto.visibility) {
      Object.assign(fields, await this.toVisibilityFields(dto.visibility));
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

  /**
   * Visibility and its access password, which move together.
   *
   * Any change that is not "become protected with a password" clears the hash,
   * so a profile flipped to public and back cannot be unlocked with the old one.
   * Kept in the service rather than the update mapper because it is async and
   * mints a credential.
   */
  private async toVisibilityFields(
    dto: UpdateVisibilityDto,
  ): Promise<Record<string, unknown>> {
    if (
      dto.visibility === ProfileVisibility.PROTECTED &&
      dto.protectedPassword
    ) {
      return {
        visibility: dto.visibility,
        protectedPassword: await bcrypt.hash(
          dto.protectedPassword,
          BCRYPT_ROUNDS,
        ),
      };
    }
    return { visibility: dto.visibility, protectedPassword: null };
  }

  // ─── Uploads ───────────────────────────────────────────────────────────────

  /**
   * Store an uploaded resume and, best-effort, extract structured suggestions.
   *
   * Two stages, independently fallible:
   *  1. Text extraction → persisted to `identity.resume.parsedText`. Useful on
   *     its own (the agent can read it), so it stands even if stage 2 fails.
   *  2. Structured extraction → returned as `suggestions` for the user to
   *     review. NEVER written to the profile here.
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

    const parsedText = await this.resumeTextExtractor.extract(file);

    const record = await this.profileRepository.update(profileId, {
      'identity.resume.url': toUploadUrl('resumes', file.filename),
      'identity.resume.parsedText': parsedText,
    });
    this.logger.log(
      `uploadResume: resume saved (profileId=${profileId}, textChars=${parsedText?.length ?? 0})`,
    );

    return {
      profile: ProfileDataResponseDto.fromRecord(record),
      suggestions: await this.resumeSuggestions.draftFrom(parsedText),
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
}
