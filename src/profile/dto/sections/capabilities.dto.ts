import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { CapabilityProficiency } from '../../domain/profile.interface';

export class CapabilityEntryDto {
  @ApiProperty({ example: 'TypeScript' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Strongly typed JavaScript superset', nullable: true })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ example: 'Code2', description: 'Lucide icon name', nullable: true })
  @IsString()
  @IsOptional()
  icon?: string | null;

  @ApiPropertyOptional({ example: 'frontend', nullable: true })
  @IsString()
  @IsOptional()
  category?: string | null;

  @ApiPropertyOptional({ enum: CapabilityProficiency, nullable: true })
  @IsEnum(CapabilityProficiency)
  @IsOptional()
  proficiency?: CapabilityProficiency | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  @IsNumber()
  @Min(0)
  @IsOptional()
  yearsOfExperience?: number | null;
}
