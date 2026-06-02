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

export class EducationDto {
  @ApiProperty({ example: 'MIT' })
  @IsString()
  @IsNotEmpty()
  institution!: string;

  @ApiProperty({ example: 'Bachelor of Science' })
  @IsString()
  @IsNotEmpty()
  degree!: string;

  @ApiProperty({ example: 'Computer Science' })
  @IsString()
  @IsNotEmpty()
  field!: string;

  @ApiProperty({ example: '2015-09' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({ example: '2019-06', nullable: true })
  @IsString()
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional({ example: 'GPA 3.9, Dean\'s List' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CurrentPositionDto {
  @ApiProperty({ example: 'Staff Engineer' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  company!: string;

  @ApiProperty({ example: '2022-01' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({ example: 'Leading the platform team...' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class ExperienceDto {
  @ApiProperty({ example: 'Senior Engineer' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Startup Inc' })
  @IsString()
  @IsNotEmpty()
  company!: string;

  @ApiProperty({ example: '2019-07' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({ example: '2021-12', nullable: true })
  @IsString()
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional({ example: 'Built real-time data pipeline...' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CertificationDto {
  @ApiProperty({ example: 'AWS Solutions Architect' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Amazon Web Services' })
  @IsString()
  @IsNotEmpty()
  issuer!: string;

  @ApiProperty({ example: '2023-03' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({ example: 'https://aws.amazon.com/certification/verify', nullable: true })
  @IsUrl()
  @IsOptional()
  url?: string | null;
}

export class ProfessionalInfoDto {
  @ApiPropertyOptional({ type: [EducationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  @IsOptional()
  education?: EducationDto[];

  @ApiPropertyOptional({ type: CurrentPositionDto, nullable: true })
  @ValidateNested()
  @Type(() => CurrentPositionDto)
  @IsOptional()
  currentPosition?: CurrentPositionDto | null;

  @ApiPropertyOptional({ type: [ExperienceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  @IsOptional()
  experience?: ExperienceDto[];

  @ApiPropertyOptional({ example: ['TypeScript', 'Go', 'Python'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ example: ['React', 'NestJS', 'PostgreSQL'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  technologies?: string[];

  @ApiPropertyOptional({ example: ['Open-source', 'Distributed systems'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];

  @ApiPropertyOptional({ example: ['Reduced API latency by 40%'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  achievements?: string[];

  @ApiPropertyOptional({ type: [CertificationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  @IsOptional()
  certifications?: CertificationDto[];

  @ApiPropertyOptional({ example: ['Best Hack — HackMIT 2022'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  awards?: string[];

  @ApiPropertyOptional({ example: 'Open to remote roles in EU/US time zones.' })
  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
