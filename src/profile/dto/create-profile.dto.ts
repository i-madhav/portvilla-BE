import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ProfileVisibility } from '../domain/profile.interface';
import { BasicInfoDto } from './sections/basic.dto';
import { ProfessionalInfoDto } from './sections/professional.dto';
import { ExternalSourcesDto } from './sections/external.dto';
import { AiSettingsDto } from './update-ai-settings.dto';

export class CreateProfileDto {
  @ApiProperty({
    example: 'jane-doe',
    description:
      'URL-safe username for the shareable portfolio link (portvilla.in/username). ' +
      '3-30 characters, lowercase letters, numbers, and hyphens only. ' +
      'Cannot start or end with a hyphen.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/, {
    message:
      'username must be 3-30 characters, contain only lowercase letters, numbers, and hyphens, ' +
      'and cannot start or end with a hyphen.',
  })
  username!: string;

  @ApiPropertyOptional({ enum: ProfileVisibility, default: ProfileVisibility.PUBLIC })
  @IsEnum(ProfileVisibility)
  @IsOptional()
  visibility?: ProfileVisibility;

  @ApiPropertyOptional({
    example: 'mySecret123',
    description: 'Required when visibility is PROTECTED. Minimum 6 characters.',
  })
  @ValidateIf((o: CreateProfileDto) => o.visibility === ProfileVisibility.PROTECTED)
  @IsString()
  @MinLength(6)
  @IsOptional()
  protectedPassword?: string;

  @ApiProperty({ type: BasicInfoDto })
  @ValidateNested()
  @Type(() => BasicInfoDto)
  basic!: BasicInfoDto;

  @ApiPropertyOptional({ type: ProfessionalInfoDto })
  @ValidateNested()
  @Type(() => ProfessionalInfoDto)
  @IsOptional()
  professional?: ProfessionalInfoDto;

  @ApiPropertyOptional({ type: ExternalSourcesDto })
  @ValidateNested()
  @Type(() => ExternalSourcesDto)
  @IsOptional()
  external?: ExternalSourcesDto;

  @ApiPropertyOptional({ type: AiSettingsDto })
  @ValidateNested()
  @Type(() => AiSettingsDto)
  @IsOptional()
  aiSettings?: AiSettingsDto;
}
