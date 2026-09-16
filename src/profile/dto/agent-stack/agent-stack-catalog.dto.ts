import { ApiProperty } from '@nestjs/swagger';

import {
  AVATAR,
  LANGUAGES,
  LLM_MODELS,
  PIPELINES,
  STT_MODELS,
  TTS_MODELS,
  VOICES,
  CUSTOM_CARTESIA_VOICE_REGEX,
  DEFAULT_AGENT_STACK,
  presetSummaries,
  type CatalogAvatar,
  type CatalogPresetSummary,
  type CatalogLanguage,
  type CatalogLlmModel,
  type CatalogPipeline,
  type CatalogSttModel,
  type CatalogTtsModel,
  type CatalogVoice,
} from '../../domain/agent-stack/catalog';

import { AgentStackResponseDto } from './agent-stack.dto';

/**
 * The catalog as the dashboard receives it — the domain data verbatim, plus the
 * defaults and the one custom-voice rule the client needs to validate a pasted
 * id before sending it.
 */
export class AgentStackCatalogDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  languages!: readonly CatalogLanguage[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  stt!: readonly CatalogSttModel[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  llm!: readonly CatalogLlmModel[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  ttsModels!: readonly CatalogTtsModel[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  voices!: readonly CatalogVoice[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description:
      'Ready-made stacks by name. Only id, label, tagline and language — the engine details stay server-side.',
  })
  presets!: readonly CatalogPresetSummary[];

  @ApiProperty({
    example: CUSTOM_CARTESIA_VOICE_REGEX.source,
    description: 'Regular expression a custom voice descriptor must match.',
  })
  customVoicePattern!: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  pipelines!: readonly CatalogPipeline[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  avatar!: CatalogAvatar;

  @ApiProperty({ type: AgentStackResponseDto })
  defaults!: AgentStackResponseDto;

  static build(): AgentStackCatalogDto {
    const dto = new AgentStackCatalogDto();
    dto.languages = LANGUAGES;
    dto.stt = STT_MODELS;
    dto.llm = LLM_MODELS;
    dto.ttsModels = TTS_MODELS;
    dto.voices = VOICES;
    dto.presets = presetSummaries();
    dto.customVoicePattern = CUSTOM_CARTESIA_VOICE_REGEX.source;
    dto.pipelines = PIPELINES;
    dto.avatar = AVATAR;
    dto.defaults = DEFAULT_AGENT_STACK;
    return dto;
  }
}
