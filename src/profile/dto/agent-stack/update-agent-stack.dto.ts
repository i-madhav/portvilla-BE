import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  AgentSpeakingSpeed,
  ListenMode,
  PipelineKind,
  ReplyLanguage,
  TurnPatience,
} from '../../domain/profile.interface';
import { MAX_KEYTERMS } from '../../domain/agent-stack/agent-stack.rules';

import { IsCatalogId } from './catalog-id.decorator';

// Every group and every field is optional: the client sends what changed and the
// service merges it over the stored section before judging the whole.

export class AgentStackLanguagePatchDto {
  @ApiPropertyOptional({
    example: 'hi',
    description: 'BCP-47 code from the catalog.',
  })
  @IsCatalogId('language')
  @IsOptional()
  primary?: string;

  @ApiPropertyOptional({ enum: ListenMode })
  @IsEnum(ListenMode)
  @IsOptional()
  listen?: ListenMode;

  @ApiPropertyOptional({ enum: ReplyLanguage })
  @IsEnum(ReplyLanguage)
  @IsOptional()
  reply?: ReplyLanguage;
}

export class AgentStackSttPatchDto {
  @ApiPropertyOptional({ example: 'deepgram/nova-3' })
  @IsCatalogId('stt')
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_KEYTERMS,
    description: 'Terms to recognise reliably. Replaces the stored list.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_KEYTERMS)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @IsOptional()
  keyterms?: string[];
}

export class AgentStackLlmPatchDto {
  @ApiPropertyOptional({ example: 'openai/gpt-4o-mini' })
  @IsCatalogId('llm')
  @IsOptional()
  model?: string;
}

export class AgentStackTtsPatchDto {
  @ApiPropertyOptional({
    example: 'cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
    description:
      'A catalog voice descriptor, or `cartesia/sonic-3:<uuid>` for a Cartesia library voice.',
  })
  @IsCatalogId('voice')
  @IsOptional()
  voice?: string;

  @ApiPropertyOptional({ enum: AgentSpeakingSpeed })
  @IsEnum(AgentSpeakingSpeed)
  @IsOptional()
  speed?: AgentSpeakingSpeed;
}

export class AgentStackTurnTakingPatchDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  allowInterruptions?: boolean;

  @ApiPropertyOptional({ enum: TurnPatience })
  @IsEnum(TurnPatience)
  @IsOptional()
  patience?: TurnPatience;
}

export class UpdateAgentStackDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'confident',
    description:
      'A catalog preset id applies that ready-made stack (keeping your language and ' +
      'keyterms). `null` detaches from the preset and keeps the current values. ' +
      'Editing stt/llm/tts/turnTaking also clears the preset.',
  })
  @ValidateIf((o: UpdateAgentStackDto) => o.preset !== null)
  @IsCatalogId('preset')
  @IsOptional()
  preset?: string | null;

  @ApiPropertyOptional({
    enum: PipelineKind,
    description:
      'Only `stt_llm_tts` is selectable today; the catalog says why the others are not.',
  })
  @IsEnum(PipelineKind)
  @IsOptional()
  pipeline?: PipelineKind;

  @ApiPropertyOptional({ type: AgentStackLanguagePatchDto })
  @ValidateNested()
  @Type(() => AgentStackLanguagePatchDto)
  @IsOptional()
  language?: AgentStackLanguagePatchDto;

  @ApiPropertyOptional({ type: AgentStackSttPatchDto })
  @ValidateNested()
  @Type(() => AgentStackSttPatchDto)
  @IsOptional()
  stt?: AgentStackSttPatchDto;

  @ApiPropertyOptional({ type: AgentStackLlmPatchDto })
  @ValidateNested()
  @Type(() => AgentStackLlmPatchDto)
  @IsOptional()
  llm?: AgentStackLlmPatchDto;

  @ApiPropertyOptional({ type: AgentStackTtsPatchDto })
  @ValidateNested()
  @Type(() => AgentStackTtsPatchDto)
  @IsOptional()
  tts?: AgentStackTtsPatchDto;

  @ApiPropertyOptional({ type: AgentStackTurnTakingPatchDto })
  @ValidateNested()
  @Type(() => AgentStackTurnTakingPatchDto)
  @IsOptional()
  turnTaking?: AgentStackTurnTakingPatchDto;
}
