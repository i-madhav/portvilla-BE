import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { MAX_BRIEF_LENGTH } from '../domain/section-limits';

/**
 * The floor under a description worth spending a generation on.
 *
 * Two hundred characters is roughly three sentences. Below that there is no
 * fact sheet to build — the model would pad, and padding is what the grounding
 * checks then throw away, at full price. The frontend shows this as guidance
 * before the button is enabled rather than as an error after.
 */
export const MIN_DESCRIPTION_LENGTH = 200;

export class GenerateProfileDto {
  @ApiProperty({
    minLength: MIN_DESCRIPTION_LENGTH,
    maxLength: MAX_BRIEF_LENGTH,
    example:
      'Portvilla turns a portfolio into a voice agent that speaks for its owner…',
    description:
      'The owner’s own description of what this profile is for. It is the ' +
      'only input: entity type and name come from the profile itself. Treated ' +
      'strictly as data — anything in it that reads like an instruction is not one.',
  })
  @IsString()
  @MinLength(MIN_DESCRIPTION_LENGTH)
  @MaxLength(MAX_BRIEF_LENGTH)
  description!: string;
}
