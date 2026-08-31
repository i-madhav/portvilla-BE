import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IsEntryKey } from '../entry-key.decorator';

export class TeamLinkDto {
  @ApiProperty({ example: 'github' })
  @IsString()
  @IsNotEmpty()
  platform!: string;

  @ApiProperty({ example: 'https://github.com/janedoe' })
  @IsUrl()
  url!: string;
}

export class TeamMemberEntryDto {
  @IsEntryKey()
  key?: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Co-founder & CTO' })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiPropertyOptional({
    example: 'Jane leads all engineering at Acme.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string | null;

  @ApiPropertyOptional({ type: [TeamLinkDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamLinkDto)
  @IsOptional()
  links?: TeamLinkDto[];
}
