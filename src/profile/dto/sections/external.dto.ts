import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ResearchPaperDto {
  @ApiPropertyOptional({ example: 'Attention Is All You Need' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'https://arxiv.org/abs/1706.03762' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 'We propose a new network architecture...' })
  @IsString()
  @IsOptional()
  abstract?: string;
}

export class ExternalProjectDto {
  @ApiPropertyOptional({ example: 'PortVilla' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'https://github.com/user/portvilla', nullable: true })
  @IsUrl()
  @IsOptional()
  url?: string | null;

  @ApiPropertyOptional({ example: 'AI-powered portfolio platform' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: ['NestJS', 'React', 'MongoDB'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  technologies?: string[];
}

export class OtherProfileDto {
  @ApiPropertyOptional({ example: 'HackerNews' })
  @IsString()
  @IsNotEmpty()
  platform!: string;

  @ApiPropertyOptional({ example: 'https://news.ycombinator.com/user?id=janedoe' })
  @IsUrl()
  url!: string;
}

export class ExternalSourcesDto {
  @ApiPropertyOptional({ example: 'https://linkedin.com/in/janedoe', nullable: true })
  @IsUrl()
  @IsOptional()
  linkedin?: string | null;

  @ApiPropertyOptional({ example: 'https://github.com/janedoe', nullable: true })
  @IsUrl()
  @IsOptional()
  github?: string | null;

  @ApiPropertyOptional({ example: 'https://twitter.com/janedoe', nullable: true })
  @IsUrl()
  @IsOptional()
  twitter?: string | null;

  @ApiPropertyOptional({ example: 'https://janedoe.dev', nullable: true })
  @IsUrl()
  @IsOptional()
  personalWebsite?: string | null;

  @ApiPropertyOptional({ example: 'https://portfolio.janedoe.dev', nullable: true })
  @IsUrl()
  @IsOptional()
  portfolioWebsite?: string | null;

  @ApiPropertyOptional({ type: [ResearchPaperDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResearchPaperDto)
  @IsOptional()
  researchPapers?: ResearchPaperDto[];

  @ApiPropertyOptional({ type: [ExternalProjectDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalProjectDto)
  @IsOptional()
  projects?: ExternalProjectDto[];

  @ApiPropertyOptional({ example: ['https://dev.to/janedoe'] })
  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  blogs?: string[];

  @ApiPropertyOptional({ type: [OtherProfileDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtherProfileDto)
  @IsOptional()
  otherProfiles?: OtherProfileDto[];
}
