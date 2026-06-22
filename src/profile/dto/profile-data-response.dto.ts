import { ApiProperty } from '@nestjs/swagger';

import {
  ProfileVisibility,
  LlmProvider,
  AgentTone,
  AgentVerbosity,
  AgentTechnicalDepth,
  AgentSpeakingSpeed,
} from '../domain/profile.interface';
import type {
  IProfileRecord,
  IdentitySection,
  WorkEntry,
  TimelineEntry,
  CapabilityEntry,
  OfferingEntry,
  MetricEntry,
  TestimonialEntry,
  TeamMemberEntry,
  MediaEntry,
  ContentEntry,
  SocialSection,
} from '../domain/profile.interface';

export class AgentPersonaResponseDto {
  @ApiProperty({ example: 'Alex' })
  agentName!: string;

  @ApiProperty({ enum: AgentTone })
  tone!: AgentTone;

  @ApiProperty({ enum: AgentVerbosity })
  verbosity!: AgentVerbosity;

  @ApiProperty({ enum: AgentTechnicalDepth })
  technicalDepth!: AgentTechnicalDepth;

  @ApiProperty({ enum: AgentSpeakingSpeed })
  speakingSpeed!: AgentSpeakingSpeed;

  @ApiProperty({ nullable: true })
  voiceId!: string | null;
}

/** AI settings shape returned to the client — raw API key is never exposed. */
export class AiSettingsResponseDto {
  @ApiProperty({ enum: LlmProvider })
  provider!: LlmProvider;

  @ApiProperty({ description: 'True if an API key has been saved.' })
  apiKeyConfigured!: boolean;

  @ApiProperty({ nullable: true })
  model!: string | null;

  @ApiProperty({ nullable: true })
  baseUrl!: string | null;
}

/** Full profile record returned to the authenticated owner. */
export class ProfileDataResponseDto {
  @ApiProperty({ example: '6650a1b2c3d4e5f6a7b8c9d0' })
  id!: string;

  @ApiProperty({ example: '6650a1b2c3d4e5f6a7b8c9d1' })
  userId!: string;

  @ApiProperty({ example: 'jane-doe' })
  username!: string;

  @ApiProperty({ enum: ProfileVisibility })
  visibility!: ProfileVisibility;

  @ApiProperty()
  identity!: IdentitySection;

  @ApiProperty()
  works!: WorkEntry[];

  @ApiProperty()
  timeline!: TimelineEntry[];

  @ApiProperty()
  capabilities!: CapabilityEntry[];

  @ApiProperty()
  offerings!: OfferingEntry[];

  @ApiProperty()
  metrics!: MetricEntry[];

  @ApiProperty()
  testimonials!: TestimonialEntry[];

  @ApiProperty()
  team!: TeamMemberEntry[];

  @ApiProperty()
  media!: MediaEntry[];

  @ApiProperty()
  content!: ContentEntry[];

  @ApiProperty()
  social!: SocialSection;

  @ApiProperty({ type: AiSettingsResponseDto })
  aiSettings!: AiSettingsResponseDto;

  @ApiProperty({ type: AgentPersonaResponseDto })
  agentPersona!: AgentPersonaResponseDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromRecord(record: IProfileRecord): ProfileDataResponseDto {
    const dto = new ProfileDataResponseDto();
    dto.id = record.id;
    dto.userId = record.userId;
    dto.username = record.username;
    dto.visibility = record.visibility;
    dto.identity = record.identity;
    dto.works = record.works;
    dto.timeline = record.timeline;
    dto.capabilities = record.capabilities;
    dto.offerings = record.offerings;
    dto.metrics = record.metrics;
    dto.testimonials = record.testimonials;
    dto.team = record.team;
    dto.media = record.media;
    dto.content = record.content;
    dto.social = record.social;
    dto.aiSettings = {
      provider: record.aiSettings.provider,
      apiKeyConfigured: record.aiSettings.apiKey !== null,
      model: record.aiSettings.model,
      baseUrl: record.aiSettings.baseUrl,
    };
    dto.agentPersona = record.agentPersona;
    dto.createdAt = record.createdAt;
    dto.updatedAt = record.updatedAt;
    return dto;
  }
}
