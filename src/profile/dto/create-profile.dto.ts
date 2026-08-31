import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
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

import { MAX_SECTION_ENTRIES } from '../domain/section-limits';

import { ProfileVisibility } from '../domain/profile.interface';
import {
  USERNAME_REGEX,
  USERNAME_RULE_MESSAGE,
} from '../domain/username.rules';
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
  @Matches(USERNAME_REGEX, { message: USERNAME_RULE_MESSAGE })
  username!: string;

  @ApiPropertyOptional({
    enum: ProfileVisibility,
    default: ProfileVisibility.PUBLIC,
  })
  @IsEnum(ProfileVisibility)
  @IsOptional()
  visibility?: ProfileVisibility;

  @ApiPropertyOptional({
    example: 'mySecret123',
    description: 'Required when visibility is PROTECTED. Minimum 6 characters.',
  })
  @ValidateIf(
    (o: CreateProfileDto) => o.visibility === ProfileVisibility.PROTECTED,
  )
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
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => WorkEntryDto)
  @IsOptional()
  works?: WorkEntryDto[];

  @ApiPropertyOptional({ type: [TimelineEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => TimelineEntryDto)
  @IsOptional()
  timeline?: TimelineEntryDto[];

  @ApiPropertyOptional({ type: [CapabilityEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => CapabilityEntryDto)
  @IsOptional()
  capabilities?: CapabilityEntryDto[];

  @ApiPropertyOptional({ type: [OfferingEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => OfferingEntryDto)
  @IsOptional()
  offerings?: OfferingEntryDto[];

  @ApiPropertyOptional({ type: [MetricEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => MetricEntryDto)
  @IsOptional()
  metrics?: MetricEntryDto[];

  @ApiPropertyOptional({ type: [TestimonialEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => TestimonialEntryDto)
  @IsOptional()
  testimonials?: TestimonialEntryDto[];

  @ApiPropertyOptional({ type: [TeamMemberEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => TeamMemberEntryDto)
  @IsOptional()
  team?: TeamMemberEntryDto[];

  @ApiPropertyOptional({ type: [MediaEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => MediaEntryDto)
  @IsOptional()
  media?: MediaEntryDto[];

  @ApiPropertyOptional({ type: [ContentEntryDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
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
