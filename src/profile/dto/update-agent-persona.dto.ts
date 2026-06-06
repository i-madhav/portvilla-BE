import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { AgentTone, AgentVerbosity, AgentTechnicalDepth, AgentSpeakingSpeed } from '../domain/profile.interface';

export class UpdateAgentPersonaDto {
  @ApiPropertyOptional({ example: 'Alex', maxLength: 32 })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  agentName?: string;

  @ApiPropertyOptional({ enum: AgentTone, example: AgentTone.BALANCED })
  @IsEnum(AgentTone)
  @IsOptional()
  tone?: AgentTone;

  @ApiPropertyOptional({ enum: AgentVerbosity, example: AgentVerbosity.CONCISE })
  @IsEnum(AgentVerbosity)
  @IsOptional()
  verbosity?: AgentVerbosity;

  @ApiPropertyOptional({ enum: AgentTechnicalDepth, example: AgentTechnicalDepth.MEDIUM })
  @IsEnum(AgentTechnicalDepth)
  @IsOptional()
  technicalDepth?: AgentTechnicalDepth;

  @ApiPropertyOptional({ enum: AgentSpeakingSpeed, example: AgentSpeakingSpeed.NORMAL })
  @IsEnum(AgentSpeakingSpeed)
  @IsOptional()
  speakingSpeed?: AgentSpeakingSpeed;

  @ApiPropertyOptional({ example: 'eleven_monolingual_v1', nullable: true })
  @IsString()
  @IsOptional()
  voiceId?: string | null;
}
