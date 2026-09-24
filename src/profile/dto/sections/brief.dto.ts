import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { MAX_BRIEF_LENGTH } from '../../domain/section-limits';

/**
 * The owner's source description. Owner-facing only — see `BriefSection`.
 *
 * `null` clears it, an omitted field leaves it alone: the same three-way rule
 * every other object section follows.
 */
export class BriefDto {
  @ApiPropertyOptional({
    example:
      'Portvilla turns a portfolio into a voice agent that speaks for its owner…',
    nullable: true,
    maxLength: MAX_BRIEF_LENGTH,
    description:
      'The description this profile was (or will be) generated from. Never ' +
      'served to visitors or to the voice agent.',
  })
  @IsString()
  @MaxLength(MAX_BRIEF_LENGTH)
  @IsOptional()
  text?: string | null;
}
