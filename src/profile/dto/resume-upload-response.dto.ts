import { ApiProperty } from '@nestjs/swagger';

import {
  TimelineCategory,
  WorkType,
  type CapabilityEntry,
  type EntryInput,
  type TimelineEntry,
  type WorkEntryInput,
} from '../domain/profile.interface';
import type { ResumeExtraction } from '../../llm/resume-extraction.types';
import { ProfileDataResponseDto } from './profile-data-response.dto';

class ResumeIdentitySuggestionDto {
  @ApiProperty({ nullable: true }) tagline!: string | null;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty({ nullable: true }) location!: string | null;
  @ApiProperty({ nullable: true }) industry!: string | null;
}

/**
 * Draft entries extracted from a resume, shaped as profile entries so the
 * frontend can drop them straight into its editors. These are NEVER persisted
 * by the server — they are returned for the user to review and confirm.
 *
 * They are `EntryInput`s rather than stored entries: a suggestion has no `key`
 * until the user accepts it and the repository writes it.
 */
export class ResumeSuggestionsDto {
  @ApiProperty({ type: ResumeIdentitySuggestionDto, nullable: true })
  identity!: ResumeIdentitySuggestionDto | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  capabilities!: EntryInput<CapabilityEntry>[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  timeline!: EntryInput<TimelineEntry>[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  works!: WorkEntryInput[];

  /** Map the raw extraction onto complete profile entries with every field defaulted. */
  static fromExtraction(extraction: ResumeExtraction): ResumeSuggestionsDto {
    const dto = new ResumeSuggestionsDto();
    dto.identity = extraction.identity;

    dto.capabilities = extraction.capabilities.map((c) => ({
      name: c.name,
      description: null,
      icon: null,
      category: c.category,
      proficiency: null,
      yearsOfExperience: null,
    }));

    dto.timeline = extraction.timeline.map((t) => ({
      category:
        TIMELINE_CATEGORY_MAP[t.category.toLowerCase()] ??
        TimelineCategory.OTHER,
      date: t.date,
      endDate: t.endDate,
      label: t.label,
      organization: t.organization,
      organizationLogoUrl: null,
      description: t.description,
      highlight: false,
      url: null,
    }));

    dto.works = extraction.works.map((w) => ({
      type: WorkType.PROJECT,
      name: w.name,
      tagline: w.tagline,
      description: w.description,
      url: null,
      repoUrl: null,
      coverImage: null,
      screenshots: [],
      technologies: w.technologies,
      tags: [],
      status: 'completed',
      highlights: [],
      featured: false,
      codeSnippets: [],
      date: null,
      stages: [],
    }));

    return dto;
  }
}

const TIMELINE_CATEGORY_MAP: Record<string, TimelineCategory> = {
  career: TimelineCategory.CAREER,
  education: TimelineCategory.EDUCATION,
  certification: TimelineCategory.CERTIFICATION,
  award: TimelineCategory.AWARD,
  milestone: TimelineCategory.MILESTONE,
  product_launch: TimelineCategory.PRODUCT_LAUNCH,
  other: TimelineCategory.OTHER,
};

export class ResumeUploadResponseDto {
  @ApiProperty({ type: ProfileDataResponseDto })
  profile!: ProfileDataResponseDto;

  @ApiProperty({
    type: ResumeSuggestionsDto,
    nullable: true,
    description:
      'Draft entries for review, or null when extraction is unavailable or yielded nothing.',
  })
  suggestions!: ResumeSuggestionsDto | null;
}
