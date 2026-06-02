import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

import { LlmProvider } from '../domain/profile.interface';

export class AiSettingsDto {
  @ApiProperty({ enum: LlmProvider, example: LlmProvider.GROQ })
  @IsEnum(LlmProvider)
  provider!: LlmProvider;

  @ApiPropertyOptional({ example: 'sk-...', nullable: true })
  @IsString()
  @IsOptional()
  apiKey?: string | null;

  @ApiPropertyOptional({ example: 'llama3-70b-8192', nullable: true })
  @IsString()
  @IsOptional()
  model?: string | null;

  @ApiPropertyOptional({ example: 'http://localhost:11434', nullable: true })
  @IsUrl()
  @IsOptional()
  baseUrl?: string | null;
}

export { AiSettingsDto as UpdateAiSettingsDto };
