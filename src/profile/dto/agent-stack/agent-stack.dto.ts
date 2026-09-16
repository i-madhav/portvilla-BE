import { ApiProperty } from '@nestjs/swagger';

import {
  AgentSpeakingSpeed,
  ListenMode,
  PipelineKind,
  ReplyLanguage,
  TurnPatience,
  type AgentStackSection,
  type AgentStackLanguage,
  type AgentStackStt,
  type AgentStackLlm,
  type AgentStackTts,
  type AgentStackTurnTaking,
} from '../../domain/profile.interface';

// Swagger shapes for the stored section as the owner reads it back. Nothing in
// it is secret, so the response DTO assigns the record's section directly; these
// classes exist so the generated spec shows the fields.

class AgentStackLanguageDto implements AgentStackLanguage {
  @ApiProperty({ example: 'en' }) primary!: string;
  @ApiProperty({ enum: ListenMode }) listen!: ListenMode;
  @ApiProperty({ enum: ReplyLanguage }) reply!: ReplyLanguage;
}

class AgentStackSttDto implements AgentStackStt {
  @ApiProperty({ example: 'deepgram/nova-3' }) model!: string;
  @ApiProperty({ type: [String] }) keyterms!: string[];
}

class AgentStackLlmDto implements AgentStackLlm {
  @ApiProperty({ example: 'openai/gpt-4o-mini' }) model!: string;
}

class AgentStackTtsDto implements AgentStackTts {
  @ApiProperty({
    example: 'cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
  })
  voice!: string;
  @ApiProperty({ enum: AgentSpeakingSpeed }) speed!: AgentSpeakingSpeed;
}

class AgentStackTurnTakingDto implements AgentStackTurnTaking {
  @ApiProperty() allowInterruptions!: boolean;
  @ApiProperty({ enum: TurnPatience }) patience!: TurnPatience;
}

export class AgentStackResponseDto implements AgentStackSection {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'confident',
    description: 'Ready-made preset in use, or null when customised.',
  })
  preset!: string | null;
  @ApiProperty({ enum: PipelineKind }) pipeline!: PipelineKind;
  @ApiProperty({ type: AgentStackLanguageDto })
  language!: AgentStackLanguageDto;
  @ApiProperty({ type: AgentStackSttDto }) stt!: AgentStackSttDto;
  @ApiProperty({ type: AgentStackLlmDto }) llm!: AgentStackLlmDto;
  @ApiProperty({ type: AgentStackTtsDto }) tts!: AgentStackTtsDto;
  @ApiProperty({ type: AgentStackTurnTakingDto })
  turnTaking!: AgentStackTurnTakingDto;
}
