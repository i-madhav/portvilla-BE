import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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
import { IdentityDto } from './sections/identity.dto';
import { WorkEntryDto } from './sections/works.dto';
import { TimelineEntryDto } from './sections/timeline.dto';
import { CapabilityEntryDto } from './sections/capabilities.dto';
import { OfferingEntryDto } from './sections/offerings.dto';
import { MetricEntryDto } from './sections/metrics.dto';
import { TestimonialEntryDto } from './sections/testimonials.dto';
import { TeamMemberEntryDto } from './sections/team.dto';
import { MediaEntryDto } from './sections/media.dto';
import { ContentEntryDto } from './sections/content.dto';
import { SocialDto } from './sections/social.dto';
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

  @ApiProperty({ type: IdentityDto })
  @ValidateNested()
  @Type(() => IdentityDto)
  identity!: IdentityDto;

  @ApiPropertyOptional({ type: [WorkEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkEntryDto)
  @IsOptional()
  works?: WorkEntryDto[];

  @ApiPropertyOptional({ type: [TimelineEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimelineEntryDto)
  @IsOptional()
  timeline?: TimelineEntryDto[];

  @ApiPropertyOptional({ type: [CapabilityEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CapabilityEntryDto)
  @IsOptional()
  capabilities?: CapabilityEntryDto[];

  @ApiPropertyOptional({ type: [OfferingEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferingEntryDto)
  @IsOptional()
  offerings?: OfferingEntryDto[];

  @ApiPropertyOptional({ type: [MetricEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetricEntryDto)
  @IsOptional()
  metrics?: MetricEntryDto[];

  @ApiPropertyOptional({ type: [TestimonialEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestimonialEntryDto)
  @IsOptional()
  testimonials?: TestimonialEntryDto[];

  @ApiPropertyOptional({ type: [TeamMemberEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamMemberEntryDto)
  @IsOptional()
  team?: TeamMemberEntryDto[];

  @ApiPropertyOptional({ type: [MediaEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaEntryDto)
  @IsOptional()
  media?: MediaEntryDto[];

  @ApiPropertyOptional({ type: [ContentEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentEntryDto)
  @IsOptional()
  content?: ContentEntryDto[];

  @ApiPropertyOptional({ type: SocialDto })
  @ValidateNested()
  @Type(() => SocialDto)
  @IsOptional()
  social?: SocialDto;

  @ApiPropertyOptional({ type: AiSettingsDto })
  @ValidateNested()
  @Type(() => AiSettingsDto)
  @IsOptional()
  aiSettings?: AiSettingsDto;
}
