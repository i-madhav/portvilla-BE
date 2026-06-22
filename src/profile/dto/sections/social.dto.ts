import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SocialLinkDto {
  @ApiProperty({ example: 'github' })
  @IsString()
  @IsNotEmpty()
  platform!: string;

  @ApiProperty({ example: 'https://github.com/janedoe' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 'GitHub', nullable: true })
  @IsString()
  @IsOptional()
  label?: string | null;
}

export class SocialDto {
  @ApiPropertyOptional({ type: [SocialLinkDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  @IsOptional()
  links?: SocialLinkDto[];

  @ApiPropertyOptional({ example: 'jane@example.com', nullable: true })
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @ApiPropertyOptional({ example: '+1-555-555-5555', nullable: true })
  @IsString()
  @IsOptional()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'https://cal.com/janedoe', nullable: true })
  @IsUrl()
  @IsOptional()
  calendarUrl?: string | null;
}
