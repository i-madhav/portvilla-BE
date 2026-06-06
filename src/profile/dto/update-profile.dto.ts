import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { UpdateBasicDto } from './update-basic.dto';
import { UpdateProfessionalDto } from './update-professional.dto';
import { UpdateExternalDto } from './update-external.dto';
import { UpdateAiSettingsDto } from './update-ai-settings.dto';
import { UpdateAgentPersonaDto } from './update-agent-persona.dto';
import { UpdateVisibilityDto } from './update-visibility.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({ type: UpdateBasicDto })
  @ValidateNested()
  @Type(() => UpdateBasicDto)
  @IsOptional()
  basic?: UpdateBasicDto;

  @ApiPropertyOptional({ type: UpdateProfessionalDto })
  @ValidateNested()
  @Type(() => UpdateProfessionalDto)
  @IsOptional()
  professional?: UpdateProfessionalDto;

  @ApiPropertyOptional({ type: UpdateExternalDto })
  @ValidateNested()
  @Type(() => UpdateExternalDto)
  @IsOptional()
  external?: UpdateExternalDto;

  @ApiPropertyOptional({ type: UpdateAiSettingsDto })
  @ValidateNested()
  @Type(() => UpdateAiSettingsDto)
  @IsOptional()
  aiSettings?: UpdateAiSettingsDto;

  @ApiPropertyOptional({ type: UpdateAgentPersonaDto })
  @ValidateNested()
  @Type(() => UpdateAgentPersonaDto)
  @IsOptional()
  agentPersona?: UpdateAgentPersonaDto;

  @ApiPropertyOptional({ type: UpdateVisibilityDto })
  @ValidateNested()
  @Type(() => UpdateVisibilityDto)
  @IsOptional()
  visibility?: UpdateVisibilityDto;
}
