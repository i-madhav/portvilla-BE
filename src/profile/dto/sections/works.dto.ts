import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { WorkType, WORK_STATUSES } from '../../domain/profile.interface';
import {
  HOTSPOT_LABEL_MAX_LENGTH,
  HOTSPOT_NOTE_MAX_LENGTH,
  MAX_HOTSPOTS_PER_SCREENSHOT,
  MAX_STAGES_PER_WORK,
  STAGE_SUMMARY_MAX_LENGTH,
} from '../../domain/section-limits';

import { IsEntryKey } from '../entry-key.decorator';
import { FitsWithinImage } from '../fits-within-image.decorator';
import { IsImageUrl } from '../image-url.decorator';

/** Trims a string and leaves anything else for the type check to reject. */
const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class HotspotDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({
    example: 'Export button',
    maxLength: HOTSPOT_LABEL_MAX_LENGTH,
  })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(HOTSPOT_LABEL_MAX_LENGTH)
  label!: string;

  @ApiProperty({
    example: 'Exports the whole board as a CSV, filters included.',
    maxLength: HOTSPOT_NOTE_MAX_LENGTH,
    description:
      'The line the owner wrote about this region, and the only thing the ' +
      'agent may say about it. Agent-side only: never on a slide payload.',
  })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(HOTSPOT_NOTE_MAX_LENGTH)
  note!: string;

  @ApiProperty({
    example: 62.5,
    minimum: 0,
    maximum: 100,
    description: '% of the image width.',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @ApiProperty({
    example: 8,
    minimum: 0,
    maximum: 100,
    description: '% of the image height.',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @ApiProperty({
    example: 12,
    maximum: 100,
    description: '% of the image width; > 0, and `x + w` ≤ 100.',
  })
  @IsNumber()
  @IsPositive()
  @FitsWithinImage('x')
  w!: number;

  @ApiProperty({
    example: 6,
    maximum: 100,
    description: '% of the image height; > 0, and `y + h` ≤ 100.',
  })
  @IsNumber()
  @IsPositive()
  @FitsWithinImage('y')
  h!: number;
}

export class ScreenshotDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ example: 'https://example.com/screenshot.png' })
  @IsImageUrl()
  url!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  caption?: string | null;

  @ApiPropertyOptional({
    type: [HotspotDto],
    maxItems: MAX_HOTSPOTS_PER_SCREENSHOT,
    description:
      'Regions the agent can point at. Omitted means none. Replacing the ' +
      'image should clear them: their geometry belongs to the old one.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_HOTSPOTS_PER_SCREENSHOT)
  @ValidateNested({ each: true })
  @Type(() => HotspotDto)
  @IsOptional()
  hotspots?: HotspotDto[];
}

export class CodeSnippetDto {
  @ApiProperty({ example: 'typescript' })
  @IsString()
  @IsNotEmpty()
  language!: string;

  @ApiProperty({ example: 'const x = 1;' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string | null;
}

export class StageEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ example: 'Private beta' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ enum: [...WORK_STATUSES], default: 'completed' })
  @IsEnum(WORK_STATUSES)
  @IsOptional()
  status?: (typeof WORK_STATUSES)[number];

  @ApiProperty({
    example: 'We opened it to 50 hand-picked teams and watched what broke.',
    maxLength: STAGE_SUMMARY_MAX_LENGTH,
    description:
      'Narrated aloud, so it must fit one breath. Put the long version in `detail`.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(STAGE_SUMMARY_MAX_LENGTH)
  summary!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Served only when the visitor asks to go deeper.',
  })
  @IsString()
  @IsOptional()
  detail?: string | null;

  @ApiPropertyOptional({ example: '2024-03', nullable: true })
  @IsString()
  @IsOptional()
  date?: string | null;

  @ApiPropertyOptional({ example: '2024-06', nullable: true })
  @IsString()
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional({ example: ['500 signups in the first week'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];
}

export class WorkEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ enum: WorkType, default: WorkType.PROJECT })
  @IsEnum(WorkType)
  type!: WorkType;

  @ApiProperty({ example: 'PortVilla' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 'AI-powered portfolio platform',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  tagline?: string | null;

  @ApiProperty({
    example: 'A platform that generates interactive portfolios using AI.',
  })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'https://portvilla.in', nullable: true })
  @IsUrl()
  @IsOptional()
  url?: string | null;

  @ApiPropertyOptional({
    example: 'https://github.com/user/portvilla',
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  repoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsImageUrl()
  @IsOptional()
  coverImage?: string | null;

  @ApiPropertyOptional({ type: [ScreenshotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenshotDto)
  @IsOptional()
  screenshots?: ScreenshotDto[];

  @ApiPropertyOptional({ example: ['NestJS', 'React', 'MongoDB'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  technologies?: string[];

  @ApiPropertyOptional({ example: ['featured', 'open-source'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ enum: [...WORK_STATUSES], default: 'completed' })
  @IsEnum(WORK_STATUSES)
  @IsOptional()
  status?: (typeof WORK_STATUSES)[number];

  @ApiPropertyOptional({
    example: ['Reduced latency by 40%', 'Onboarded 500 users in first week'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({ type: [CodeSnippetDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CodeSnippetDto)
  @IsOptional()
  codeSnippets?: CodeSnippetDto[];

  @ApiProperty({
    example: '2024-03',
    description:
      'When this work happened. Required — a work with no time anchor is not ' +
      'narratable as part of an arc. Array order is still the only ordering; ' +
      'this is the time the agent speaks, not the position it shows in.',
  })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({
    type: [StageEntryDto],
    description:
      "The work's arc, in the order it should be narrated. Array order is the " +
      'only ordering — there is no order field.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_STAGES_PER_WORK)
  @ValidateNested({ each: true })
  @Type(() => StageEntryDto)
  @IsOptional()
  stages?: StageEntryDto[];
}
