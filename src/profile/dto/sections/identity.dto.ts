import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

import { EntityType } from '../../domain/profile.interface';

export class IdentityDto {
  @ApiProperty({ enum: EntityType, default: EntityType.INDIVIDUAL })
  @IsEnum(EntityType)
  entityType!: EntityType;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Full-stack engineer', nullable: true })
  @IsString()
  @IsOptional()
  tagline?: string | null;

  @ApiPropertyOptional({ example: 'Passionate engineer with 8 years of experience building distributed systems.', nullable: true })
  @IsString()
  @IsOptional()
  bio?: string | null;

  @ApiPropertyOptional({ example: 'I love building tools that make developers more productive...', nullable: true })
  @IsString()
  @IsOptional()
  about?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', nullable: true })
  @IsUrl()
  @IsOptional()
  primaryImage?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg', nullable: true })
  @IsUrl()
  @IsOptional()
  coverImage?: string | null;

  @ApiPropertyOptional({ example: 'San Francisco, CA', nullable: true })
  @IsString()
  @IsOptional()
  location?: string | null;

  @ApiPropertyOptional({ example: '1994', nullable: true })
  @IsString()
  @IsOptional()
  foundedOrBorn?: string | null;

  @ApiPropertyOptional({ example: 'fintech', nullable: true })
  @IsString()
  @IsOptional()
  industry?: string | null;

  @ApiPropertyOptional({ example: 'Open to work', nullable: true })
  @IsString()
  @IsOptional()
  availability?: string | null;
}

export class UpdateIdentityDto {
  @ApiPropertyOptional({ enum: EntityType })
  @IsEnum(EntityType)
  @IsOptional()
  entityType?: EntityType;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  tagline?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  about?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsUrl()
  @IsOptional()
  primaryImage?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsUrl()
  @IsOptional()
  coverImage?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  location?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  foundedOrBorn?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  industry?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  availability?: string | null;
}
