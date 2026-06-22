import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class MediaEntryDto {
  @ApiProperty({ example: 'https://example.com/photo.jpg' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 'Team offsite — Berlin 2024', nullable: true })
  @IsString()
  @IsOptional()
  caption?: string | null;

  @ApiProperty({ enum: ['image', 'video'] })
  @IsEnum(['image', 'video'])
  type!: 'image' | 'video';

  @ApiPropertyOptional({ example: 'team', nullable: true })
  @IsString()
  @IsOptional()
  category?: string | null;
}

