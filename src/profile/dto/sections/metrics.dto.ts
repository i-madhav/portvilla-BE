import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { IsEntryKey } from '../entry-key.decorator';

export class MetricEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ example: '5k+' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ example: 'GitHub Stars' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({
    example: 'Across all open-source repositories.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({
    example: 'Star',
    description: 'Lucide icon name',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  icon?: string | null;

  @ApiPropertyOptional({ example: 'open-source', nullable: true })
  @IsString()
  @IsOptional()
  category?: string | null;
}
