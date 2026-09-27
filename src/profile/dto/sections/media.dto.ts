import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { IsEntryKey } from '../entry-key.decorator';
import { IsImageUrl } from '../image-url.decorator';

export class MediaEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ example: 'https://example.com/photo.jpg' })
  @IsImageUrl()
  url!: string;

  @ApiPropertyOptional({
    example: 'Team offsite — Berlin 2024',
    nullable: true,
  })
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
