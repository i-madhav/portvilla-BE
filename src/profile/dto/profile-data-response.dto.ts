import { ApiProperty } from '@nestjs/swagger';

import { ProfileVisibility, LlmProvider } from '../domain/profile.interface';
import type {
  BasicSection,
  ProfessionalSection,
  ExternalSection,
  IProfileRecord,
} from '../domain/profile.interface';

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
  basic!: BasicSection;

  @ApiProperty()
  professional!: ProfessionalSection;

  @ApiProperty()
  external!: ExternalSection;

  @ApiProperty({ type: AiSettingsResponseDto })
  aiSettings!: AiSettingsResponseDto;

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
    dto.basic = record.basic;
    dto.professional = record.professional;
    dto.external = record.external;
    dto.aiSettings = {
      provider: record.aiSettings.provider,
      apiKeyConfigured: record.aiSettings.apiKey !== null,
      model: record.aiSettings.model,
      baseUrl: record.aiSettings.baseUrl,
    };
    dto.createdAt = record.createdAt;
    dto.updatedAt = record.updatedAt;
    return dto;
  }
}
