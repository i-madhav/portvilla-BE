import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

import { ContentType } from '../../domain/profile.interface';

import { IsEntryKey } from '../entry-key.decorator';

export class ContentEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ enum: ContentType })
  @IsEnum(ContentType)
  type!: ContentType;

  @ApiProperty({ example: 'Building AI Agents at Scale' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'https://dev.to/janedoe/building-ai-agents' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({
    example: 'A deep dive into orchestrating multiple LLM agents.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/thumbnail.jpg',
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({ example: '2024-03', nullable: true })
  @IsString()
  @IsOptional()
  date?: string | null;

  @ApiPropertyOptional({ example: ['AI', 'LLM', 'agents'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}
