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
  type BasicSection,
  type ProfessionalSection,
  type ExternalSection,
  type AiSettingsSection,
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
      basic: this.buildBasic(dto.basic),
      professional: this.buildProfessional(dto.professional),
      external: this.buildExternal(dto.external),
      aiSettings: this.buildAiSettings(dto.aiSettings),
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

    const { basic, professional, external, aiSettings, visibility } = dto;

    if (basic) {
      if (basic.name !== undefined) fields['basic.name'] = basic.name;
      if (basic.title !== undefined) fields['basic.title'] = basic.title;
      if (basic.introduction !== undefined) fields['basic.introduction'] = basic.introduction;
      if (basic.aboutMe !== undefined) fields['basic.aboutMe'] = basic.aboutMe;
    }

    if (professional) {
      if (professional.education !== undefined) fields['professional.education'] = professional.education.map(e => ({ ...e, endDate: e.endDate ?? null, description: e.description ?? '' }));
      if (professional.currentPosition !== undefined) fields['professional.currentPosition'] = professional.currentPosition ? { ...professional.currentPosition, description: professional.currentPosition.description ?? '' } : null;
      if (professional.experience !== undefined) fields['professional.experience'] = professional.experience.map(e => ({ ...e, endDate: e.endDate ?? null, description: e.description ?? '' }));
      if (professional.skills !== undefined) fields['professional.skills'] = professional.skills;
      if (professional.technologies !== undefined) fields['professional.technologies'] = professional.technologies;
      if (professional.interests !== undefined) fields['professional.interests'] = professional.interests;
      if (professional.achievements !== undefined) fields['professional.achievements'] = professional.achievements;
      if (professional.certifications !== undefined) fields['professional.certifications'] = professional.certifications.map(c => ({ ...c, url: c.url ?? null }));
      if (professional.awards !== undefined) fields['professional.awards'] = professional.awards;
      if (professional.additionalNotes !== undefined) fields['professional.additionalNotes'] = professional.additionalNotes;
    }

    if (external) {
      if (external.linkedin !== undefined) fields['external.linkedin'] = external.linkedin ?? null;
      if (external.github !== undefined) fields['external.github'] = external.github ?? null;
      if (external.twitter !== undefined) fields['external.twitter'] = external.twitter ?? null;
      if (external.personalWebsite !== undefined) fields['external.personalWebsite'] = external.personalWebsite ?? null;
      if (external.portfolioWebsite !== undefined) fields['external.portfolioWebsite'] = external.portfolioWebsite ?? null;
      if (external.researchPapers !== undefined) fields['external.researchPapers'] = external.researchPapers.map(p => ({ ...p, abstract: p.abstract ?? '' }));
      if (external.projects !== undefined) fields['external.projects'] = external.projects.map(p => ({ ...p, url: p.url ?? null, description: p.description ?? '', technologies: p.technologies ?? [] }));
      if (external.blogs !== undefined) fields['external.blogs'] = external.blogs;
      if (external.otherProfiles !== undefined) fields['external.otherProfiles'] = external.otherProfiles;
    }

    if (aiSettings) {
      fields['aiSettings.provider'] = aiSettings.provider;
      if (aiSettings.apiKey !== undefined) fields['aiSettings.apiKey'] = aiSettings.apiKey ?? null;
      if (aiSettings.model !== undefined) fields['aiSettings.model'] = aiSettings.model ?? null;
      if (aiSettings.baseUrl !== undefined) fields['aiSettings.baseUrl'] = aiSettings.baseUrl ?? null;
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
      'professional.resume.url': toUploadUrl('resumes', file.filename),
    });
    return ProfileDataResponseDto.fromRecord(record);
  }

  async uploadProfileImage(profileId: string, file: Express.Multer.File): Promise<ProfileDataResponseDto> {
    const record = await this.profileRepository.update(profileId, {
      'basic.profileImage': toUploadUrl('profile-images', file.filename),
    });
    return ProfileDataResponseDto.fromRecord(record);
  }

  async deleteProfile(userId: string): Promise<void> {
    const exists = await this.profileRepository.existsByUserId(userId);
    if (!exists) throw new NotFoundException('Profile not found.');
    await this.profileRepository.deleteByUserId(userId);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildBasic(dto: CreateProfileDto['basic']): BasicSection {
    return {
      name: dto.name,
      title: dto.title,
      profileImage: null,
      introduction: dto.introduction ?? '',
      aboutMe: dto.aboutMe ?? '',
    };
  }

  private buildProfessional(dto: CreateProfileDto['professional']): ProfessionalSection {
    return {
      resume: { url: null, parsedText: null },
      education: dto?.education?.map(e => ({ ...e, endDate: e.endDate ?? null, description: e.description ?? '' })) ?? [],
      currentPosition: dto?.currentPosition ? { ...dto.currentPosition, description: dto.currentPosition.description ?? '' } : null,
      experience: dto?.experience?.map(e => ({ ...e, endDate: e.endDate ?? null, description: e.description ?? '' })) ?? [],
      skills: dto?.skills ?? [],
      technologies: dto?.technologies ?? [],
      interests: dto?.interests ?? [],
      achievements: dto?.achievements ?? [],
      certifications: dto?.certifications?.map(c => ({ ...c, url: c.url ?? null })) ?? [],
      awards: dto?.awards ?? [],
      additionalNotes: dto?.additionalNotes ?? '',
    };
  }

  private buildExternal(dto: CreateProfileDto['external']): ExternalSection {
    return {
      linkedin: dto?.linkedin ?? null,
      github: dto?.github ?? null,
      twitter: dto?.twitter ?? null,
      personalWebsite: dto?.personalWebsite ?? null,
      portfolioWebsite: dto?.portfolioWebsite ?? null,
      researchPapers: dto?.researchPapers?.map(p => ({ ...p, abstract: p.abstract ?? '' })) ?? [],
      projects: dto?.projects?.map(p => ({ ...p, url: p.url ?? null, description: p.description ?? '', technologies: p.technologies ?? [] })) ?? [],
      blogs: dto?.blogs ?? [],
      otherProfiles: dto?.otherProfiles ?? [],
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
}
