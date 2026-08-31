import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

import { TimelineCategory } from '../../domain/profile.interface';

import { IsEntryKey } from '../entry-key.decorator';

export class TimelineEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ enum: TimelineCategory })
  @IsEnum(TimelineCategory)
  category!: TimelineCategory;

  @ApiProperty({ example: '2022-01' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({ example: '2024-06', nullable: true })
  @IsString()
  @IsOptional()
  endDate?: string | null;

  @ApiProperty({ example: 'Senior Software Engineer at Acme Corp' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ example: 'Acme Corp', nullable: true })
  @IsString()
  @IsOptional()
  organization?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  organizationLogoUrl?: string | null;

  @ApiPropertyOptional({
    example: 'Led platform team of 6 engineers.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  highlight?: boolean;

  @ApiPropertyOptional({ example: 'https://acme.com', nullable: true })
  @IsUrl()
  @IsOptional()
  url?: string | null;
}
