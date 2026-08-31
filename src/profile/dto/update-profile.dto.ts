import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { MAX_SECTION_ENTRIES } from '../domain/section-limits';

import { UpdateIdentityDto } from './sections/identity.dto';
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
import { UpdateAiSettingsDto } from './update-ai-settings.dto';
import { UpdateAgentPersonaDto } from './update-agent-persona.dto';
import { UpdateVisibilityDto } from './update-visibility.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({ type: UpdateIdentityDto })
  @ValidateNested()
  @Type(() => UpdateIdentityDto)
  @IsOptional()
  identity?: UpdateIdentityDto;

  @ApiPropertyOptional({
    type: [WorkEntryDto],
    description: 'Replaces entire works array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => WorkEntryDto)
  @IsOptional()
  works?: WorkEntryDto[];

  @ApiPropertyOptional({
    type: [TimelineEntryDto],
    description: 'Replaces entire timeline array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => TimelineEntryDto)
  @IsOptional()
  timeline?: TimelineEntryDto[];

  @ApiPropertyOptional({
    type: [CapabilityEntryDto],
    description: 'Replaces entire capabilities array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => CapabilityEntryDto)
  @IsOptional()
  capabilities?: CapabilityEntryDto[];

  @ApiPropertyOptional({
    type: [OfferingEntryDto],
    description: 'Replaces entire offerings array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => OfferingEntryDto)
  @IsOptional()
  offerings?: OfferingEntryDto[];

  @ApiPropertyOptional({
    type: [MetricEntryDto],
    description: 'Replaces entire metrics array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => MetricEntryDto)
  @IsOptional()
  metrics?: MetricEntryDto[];

  @ApiPropertyOptional({
    type: [TestimonialEntryDto],
    description: 'Replaces entire testimonials array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => TestimonialEntryDto)
  @IsOptional()
  testimonials?: TestimonialEntryDto[];

  @ApiPropertyOptional({
    type: [TeamMemberEntryDto],
    description: 'Replaces entire team array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => TeamMemberEntryDto)
  @IsOptional()
  team?: TeamMemberEntryDto[];

  @ApiPropertyOptional({
    type: [MediaEntryDto],
    description: 'Replaces entire media array.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_SECTION_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => MediaEntryDto)
  @IsOptional()
  media?: MediaEntryDto[];

  @ApiPropertyOptional({
    type: [ContentEntryDto],
    description: 'Replaces entire content array.',
  })
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

  @ApiPropertyOptional({ type: UpdateAiSettingsDto })
  @ValidateNested()
  @Type(() => UpdateAiSettingsDto)
  @IsOptional()
  aiSettings?: UpdateAiSettingsDto;

  @ApiPropertyOptional({ type: UpdateAgentPersonaDto })
  @ValidateNested()
  @Type(() => UpdateAgentPersonaDto)
  @IsOptional()
  agentPersona?: UpdateAgentPersonaDto;

  @ApiPropertyOptional({ type: UpdateVisibilityDto })
  @ValidateNested()
  @Type(() => UpdateVisibilityDto)
  @IsOptional()
  visibility?: UpdateVisibilityDto;
}
