import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { WorkType } from '../../domain/profile.interface';

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

export class WorkEntryDto {
  @ApiProperty({ enum: WorkType, default: WorkType.PROJECT })
  @IsEnum(WorkType)
  type!: WorkType;

  @ApiProperty({ example: 'PortVilla' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'AI-powered portfolio platform', nullable: true })
  @IsString()
  @IsOptional()
  tagline?: string | null;

  @ApiProperty({ example: 'A platform that generates interactive portfolios using AI.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'https://portvilla.in', nullable: true })
  @IsUrl()
  @IsOptional()
  url?: string | null;

  @ApiPropertyOptional({ example: 'https://github.com/user/portvilla', nullable: true })
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

  @ApiPropertyOptional({ enum: ['active', 'completed', 'in-progress', 'archived'], default: 'completed' })
  @IsEnum(['active', 'completed', 'in-progress', 'archived'])
  @IsOptional()
  status?: 'active' | 'completed' | 'in-progress' | 'archived';

  @ApiPropertyOptional({ example: ['Reduced latency by 40%', 'Onboarded 500 users in first week'] })
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
}
