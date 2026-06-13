import { SessionResponseDto } from '../dto/createSession';
import { ISessionRecord } from '../session.interface';

export class SessionMapper {
  static toResponseDto(record: ISessionRecord, livekitUrl: string): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.sessionId        = record.id;
    dto.livekitUrl       = livekitUrl;
    dto.participantToken = record.participantToken;
    dto.roomName         = record.roomName;
    dto.type             = record.type;
    dto.status           = record.status;
    dto.agentName        = record.agentName;
    return dto;
  }
}
