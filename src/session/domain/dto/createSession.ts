import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, ValidateIf } from 'class-validator';

import { AgentName, SessionStatus, SessionType } from '../session.interface';

// ─── Request ──────────────────────────────────────────────────────────────────

export class CreateSessionDto {
  @ApiProperty({ enum: SessionType, example: SessionType.GUEST })
  @IsEnum(SessionType)
  type!: SessionType;

  @ApiPropertyOptional({
    example: 'johndoe',
    description:
      'Required when type is "user". Must be 3–30 lowercase alphanumeric characters.',
  })
  @ValidateIf((o: CreateSessionDto) => o.type === SessionType.USER)
  @IsString()
  @Matches(/^[a-z0-9_-]{3,30}$/, {
    message:
      'profileUsername must be 3–30 lowercase alphanumeric, underscore, or hyphen characters.',
  })
  profileUsername?: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export class SessionResponseDto {
  @ApiProperty({ example: '64a1b2c3d4e5f6789abcdef0' })
  sessionId!: string;

  @ApiProperty({ example: 'wss://your-project.livekit.cloud' })
  livekitUrl!: string;

  @ApiProperty({
    description:
      'LiveKit participant JWT — pass directly to the LiveKit SDK. ' +
      'Embedded in the token: room name, participant identity, canPublish/Subscribe grants, ' +
      'and the RoomConfiguration that auto-dispatches the correct agent on room creation.',
  })
  participantToken!: string;

  @ApiProperty({ example: 'portvilla-guest-a1b2c3d4e5f6' })
  roomName!: string;

  @ApiProperty({ enum: SessionType })
  type!: SessionType;

  @ApiProperty({ enum: SessionStatus, example: SessionStatus.PENDING })
  status!: SessionStatus;

  @ApiProperty({ enum: AgentName, example: AgentName.WELCOME })
  agentName!: AgentName;
}
