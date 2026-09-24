import { ApiProperty } from '@nestjs/swagger';

import { projectSlides } from '../domain/slide.projector';
import type { Slide } from '../domain/slide';
import type { IProfileRecord } from '../domain/profile.interface';
import { applyDraft } from '../generation/assemble';
import type {
  DraftWarning,
  GeneratedSection,
  GenerationResult,
  GenerationUsage,
  ProfileDraft,
  SectionStatus,
} from '../generation/generation.types';

/**
 * What one generation produced, and nothing more — this endpoint never writes.
 *
 * `draft` is exactly an `UpdateProfileDto` body: the owner accepts it by
 * sending it back to `PATCH /profiles/me`, per section if they like. There is
 * deliberately no accept endpoint. One write path means one validator, one
 * re-keying and one place where a profile changes.
 *
 * `preview` is built by the same `projectSlides()` that serves the voice worker,
 * over the record as it *would be* if the draft were accepted. So the deck the
 * owner reviews is the deck their visitors get, not an illustration of it.
 */
/** Wrapped rather than a bare array, so the preview can grow a field without
 *  changing the response's shape — the same reason `/profiles/me/preview`
 *  returns an object. */
export class DraftPreviewDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'The slide catalog this draft would produce, from the same projector ' +
      '`GET /profiles/me/preview` and the agent context use.',
  })
  slides!: Slide[];
}

export class ProfileDraftResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'An `UpdateProfileDto` body. Sections with nothing found are absent, ' +
      'not empty — an empty array through `PATCH` would delete what is there.',
  })
  draft!: ProfileDraft;

  @ApiProperty({ type: DraftPreviewDto })
  preview!: DraftPreviewDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: ['generated', 'empty', 'failed'],
    },
    description:
      '`empty` is a correct outcome: it means the description held no material ' +
      'for that section, not that anything went wrong.',
  })
  sections!: Record<GeneratedSection, SectionStatus>;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'Everything that was dropped and why, written for the owner to read.',
  })
  warnings!: DraftWarning[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Token counts and wall-clock time. Counts only, never content.',
  })
  usage!: GenerationUsage;

  static fromResult(
    record: IProfileRecord,
    result: GenerationResult,
  ): ProfileDraftResponseDto {
    const dto = new ProfileDraftResponseDto();
    dto.draft = result.draft;
    dto.preview = { slides: projectSlides(applyDraft(record, result.draft)) };
    dto.sections = result.sections;
    dto.warnings = result.warnings;
    dto.usage = result.usage;
    return dto;
  }
}
