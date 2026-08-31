import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { WorkType, WORK_STATUSES } from '../../domain/profile.interface';
import {
  MAX_STAGES_PER_WORK,
  STAGE_SUMMARY_MAX_LENGTH,
} from '../../domain/section-limits';

import { IsEntryKey } from '../entry-key.decorator';

export class ScreenshotDto {
  @ApiProperty({ example: 'https://example.com/screenshot.png' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  caption?: string | null;
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
  @IsUrl()
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

  @ApiPropertyOptional({ example: '2024-03', nullable: true })
  @IsString()
  @IsOptional()
  date?: string | null;

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
