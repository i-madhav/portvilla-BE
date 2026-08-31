import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

import { TestimonialRelationship } from '../../domain/profile.interface';

import { IsEntryKey } from '../entry-key.decorator';

export class TestimonialEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({
    example: 'Jane is one of the most impactful engineers I have worked with.',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  author!: string;

  @ApiPropertyOptional({ example: 'VP of Engineering', nullable: true })
  @IsString()
  @IsOptional()
  role?: string | null;

  @ApiPropertyOptional({ example: 'Acme Corp', nullable: true })
  @IsString()
  @IsOptional()
  organization?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string | null;

  @ApiProperty({ enum: TestimonialRelationship })
  @IsEnum(TestimonialRelationship)
  relationship!: TestimonialRelationship;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}
