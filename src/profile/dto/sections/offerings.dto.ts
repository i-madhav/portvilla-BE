import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OfferingCtaDto {
  @ApiProperty({ example: 'Get started' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: 'https://example.com/signup' })
  @IsUrl()
  url!: string;
}

export class OfferingEntryDto {
  @ApiProperty({ example: 'Pro Plan' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Everything you need to grow your business.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ example: 'Zap', description: 'Lucide icon name', nullable: true })
  @IsString()
  @IsOptional()
  icon?: string | null;

  @ApiPropertyOptional({ example: '$99/mo', nullable: true })
  @IsString()
  @IsOptional()
  price?: string | null;

  @ApiPropertyOptional({ example: ['Unlimited projects', 'Priority support'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  highlighted?: boolean;

  @ApiPropertyOptional({ example: ['recommended', 'popular'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ type: OfferingCtaDto, nullable: true })
  @ValidateNested()
  @Type(() => OfferingCtaDto)
  @IsOptional()
  cta?: OfferingCtaDto | null;
}
