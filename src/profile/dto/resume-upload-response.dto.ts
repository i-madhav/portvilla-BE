import { ApiProperty } from '@nestjs/swagger';

import {
  TimelineCategory,
  WorkType,
  type CapabilityEntry,
  type TimelineEntry,
  type WorkEntry,
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
 * Draft entries extracted from a resume, shaped as full profile entries so the
 * frontend can drop them straight into its editors. These are NEVER persisted
 * by the server — they are returned for the user to review and confirm.
 */
export class ResumeSuggestionsDto {
  @ApiProperty({ type: ResumeIdentitySuggestionDto, nullable: true })
  identity!: ResumeIdentitySuggestionDto | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  capabilities!: CapabilityEntry[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  timeline!: TimelineEntry[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  works!: WorkEntry[];

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
