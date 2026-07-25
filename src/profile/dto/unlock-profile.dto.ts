import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Body for POST /profiles/public/:username/unlock. */
export class UnlockProfileDto {
  @ApiProperty({ description: 'The profile access password.' })
  @IsString()
  @MinLength(1)
  password!: string;
}
